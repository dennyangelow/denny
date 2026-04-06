// migrate-to-r2.mjs
// Мигрира всички файлове от Supabase Storage → Cloudflare R2
// и обновява URL-овете в базата автоматично.
//
// УПОТРЕБА:
//   1. npm install @aws-sdk/client-s3 @supabase/supabase-js node-fetch dotenv
//   2. Попълни .env.migration (виж по-долу)
//   3. node migrate-to-r2.mjs
//
// .env.migration съдържание:
// ─────────────────────────────────────────────
// SUPABASE_URL=https://okcwzkthrndzmc​abemir.supabase.co
// SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
//
// R2_ACCOUNT_ID=your_cloudflare_account_id
// R2_ACCESS_KEY_ID=your_r2_access_key
// R2_SECRET_ACCESS_KEY=your_r2_secret_key
// R2_BUCKET_NAME=your-bucket-name
// R2_PUBLIC_URL=https://pub-XXXX.r2.dev   ← от Cloudflare R2 dashboard
// ─────────────────────────────────────────────

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import { readFileSync } from 'fs'
import { extname } from 'path'

// ── Зареди .env.migration ─────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync('.env.migration', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
)

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} = env

// ── Клиенти ───────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

// ── Помощни функции ───────────────────────────────────────────────────────────

function getContentType(filename) {
  const ext = extname(filename).toLowerCase()
  const map = {
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.webp': 'image/webp',
    '.gif':  'image/gif',
    '.pdf':  'application/pdf',
    '.svg':  'image/svg+xml',
  }
  return map[ext] || 'application/octet-stream'
}

// Взима пътя след /public/ от Supabase URL
// Пример: https://xxx.supabase.co/storage/v1/object/public/images/products/file.jpg
//      → images/products/file.jpg
function supabaseUrlToPath(url) {
  if (!url) return null
  const marker = '/object/public/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length)
}

// Проверява дали файлът вече съществува в R2 (за да не качваме два пъти)
async function existsInR2(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }))
    return true
  } catch {
    return false
  }
}

// Изтегля от Supabase и качва в R2
async function migrateFile(supabaseUrl) {
  const path = supabaseUrlToPath(supabaseUrl)
  if (!path) {
    console.warn(`  ⚠ Пропускам (не е Supabase URL): ${supabaseUrl}`)
    return supabaseUrl // Връщаме оригиналния URL непроменен
  }

  const r2Key = path // Запазваме същата структура: images/products/file.jpg

  // Ако вече е качено — само връщаме новия URL
  if (await existsInR2(r2Key)) {
    console.log(`  ✓ Вече в R2: ${r2Key}`)
    return `${R2_PUBLIC_URL}/${r2Key}`
  }

  // Изтегляме от Supabase
  const res = await fetch(supabaseUrl)
  if (!res.ok) {
    console.error(`  ✗ Грешка при изтегляне (${res.status}): ${supabaseUrl}`)
    return supabaseUrl // Не сменяме URL при грешка
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  const filename = path.split('/').pop()
  const contentType = getContentType(filename)

  // Качваме в R2
  await r2.send(new PutObjectCommand({
    Bucket:      R2_BUCKET_NAME,
    Key:         r2Key,
    Body:        buffer,
    ContentType: contentType,
    // Cache-Control за по-добра производителност
    CacheControl: 'public, max-age=31536000, immutable',
  }))

  const newUrl = `${R2_PUBLIC_URL}/${r2Key}`
  console.log(`  ↑ Качено: ${r2Key}`)
  return newUrl
}

// ── Дефиниция на таблици и колони за миграция ─────────────────────────────────
const TABLES = [
  { table: 'products',           idCol: 'id', urlCols: ['image_url'] },
  { table: 'naruchnici',         idCol: 'id', urlCols: ['cover_image_url', 'pdf_url'] },
  { table: 'special_sections',   idCol: 'id', urlCols: ['image_url'] },
  { table: 'promo_banners',      idCol: 'id', urlCols: ['image_url'] },
  { table: 'marketing_settings', idCol: 'id', urlCols: ['image_url', 'logo_url'] },
  { table: 'affiliate_products', idCol: 'id', urlCols: ['image_url'] },
]

// Добавяме и директната миграция на Storage bucket файлове
// (файлове в uploads/misc и images/* папките)
const BUCKETS = ['images', 'uploads', 'naruchnici']

// ── Главна функция ────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Започвам миграция Supabase Storage → Cloudflare R2\n')
  console.log(`   Supabase: ${SUPABASE_URL}`)
  console.log(`   R2 Bucket: ${R2_BUCKET_NAME}`)
  console.log(`   R2 Public URL: ${R2_PUBLIC_URL}\n`)

  let totalFiles   = 0
  let totalUpdated = 0
  let totalErrors  = 0

  // ── Стъпка 1: Мигрираме URL-овете в таблиците ──────────────────────────
  console.log('═'.repeat(60))
  console.log('СТЪПКА 1: Миграция на URL-ове в таблиците')
  console.log('═'.repeat(60))

  for (const { table, idCol, urlCols } of TABLES) {
    console.log(`\n📋 Таблица: ${table}`)

    // Вземаме само редовете с Supabase URL-ове
    const selectCols = [idCol, ...urlCols].join(', ')
    const { data: rows, error } = await supabase
      .from(table)
      .select(selectCols)

    if (error) {
      console.error(`  ✗ Грешка при четене на ${table}:`, error.message)
      totalErrors++
      continue
    }

    if (!rows || rows.length === 0) {
      console.log('  (празна таблица)')
      continue
    }

    for (const row of rows) {
      const updates = {}
      let hasChanges = false

      for (const col of urlCols) {
        const oldUrl = row[col]
        if (!oldUrl) continue
        // Пропускаме URL-ове, които вече са в R2 или не са Supabase
        if (!oldUrl.includes('supabase.co/storage')) continue

        totalFiles++
        console.log(`\n  [${table}.${col}] ${oldUrl.split('/').pop()}`)

        const newUrl = await migrateFile(oldUrl)
        if (newUrl !== oldUrl) {
          updates[col] = newUrl
          hasChanges = true
        }
      }

      if (hasChanges) {
        const { error: updateError } = await supabase
          .from(table)
          .update(updates)
          .eq(idCol, row[idCol])

        if (updateError) {
          console.error(`  ✗ Грешка при update на ${table} id=${row[idCol]}:`, updateError.message)
          totalErrors++
        } else {
          console.log(`  ✅ Обновен ред id=${row[idCol]}`)
          totalUpdated++
        }
      }
    }
  }

  // ── Стъпка 2: Мигрираме всички файлове от Storage buckets ──────────────
  // (файлове, които може да не са в таблиците — напр. misc папки)
  console.log('\n' + '═'.repeat(60))
  console.log('СТЪПКА 2: Директна миграция на Storage bucket файлове')
  console.log('═'.repeat(60))

  for (const bucket of BUCKETS) {
    console.log(`\n🪣 Bucket: ${bucket}`)
    await migrateBucketFolder(bucket, '')
  }

  // ── Резултат ────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('✅ МИГРАЦИЯТА ЗАВЪРШИ')
  console.log('═'.repeat(60))
  console.log(`   Файлове обработени:  ${totalFiles}`)
  console.log(`   Редове обновени:     ${totalUpdated}`)
  console.log(`   Грешки:              ${totalErrors}`)
  console.log('\n⚠️  СЛЕДВАЩИ СТЪПКИ:')
  console.log('   1. Провери сайта — изображенията трябва да се зареждат от R2')
  console.log('   2. Обнови NEXT_PUBLIC_SUPABASE_URL в кода ако имаш hardcoded URL-ове')
  console.log('   3. След като всичко работи — изтрий файловете от Supabase Storage')
}

// Рекурсивно обхожда папка в Supabase Storage
async function migrateBucketFolder(bucket, folder) {
  const path = folder || undefined
  const { data: items, error } = await supabase.storage
    .from(bucket)
    .list(path, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })

  if (error) {
    // Ако bucket-ът не съществува — пропускаме тихо
    if (error.message?.includes('not found') || error.statusCode === 404) return
    console.error(`  ✗ Грешка при list на ${bucket}/${folder}:`, error.message)
    return
  }

  if (!items || items.length === 0) return

  for (const item of items) {
    const itemPath = folder ? `${folder}/${item.name}` : item.name

    if (!item.metadata) {
      // Папка — влизаме рекурсивно
      await migrateBucketFolder(bucket, itemPath)
    } else {
      // Файл — мигрираме го
      const supabaseUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${itemPath}`
      await migrateFile(supabaseUrl)
    }
  }
}

main().catch(err => {
  console.error('\n💥 Фатална грешка:', err)
  process.exit(1)
})
