// scripts/migrate-image-names.ts — v2
// ✅ Обобщен migration скрипт — преименува снимки в R2 с описателни SEO имена
//    за: Наръчници (cover_image_url), Собствени продукти (image_url + gallery_urls),
//    Специални секции (image_url + logo_url).
//    Афилиейт продуктите НЕ са включени тук по подразбиране — вече са преименувани
//    с v1 на скрипта. Ако искаш да ги минеш пак, добави 'affiliate_products' в TABLES по-долу.
//
// Пускане (Node 20.6+):
//   npx tsx --env-file=.env scripts/migrate-image-names.ts
// По подразбиране DRY RUN. Реално със:
//   $env:DRY_RUN="false"; npx tsx --env-file=.env scripts/migrate-image-names.ts   (PowerShell)
//   DRY_RUN=false npx tsx --env-file=.env scripts/migrate-image-names.ts           (bash/WSL)
//
// Кои таблици да мине — по избор чрез TABLES env var (comma-separated),
// иначе по подразбиране трите по-долу:
//   $env:TABLES="naruchnici"; ...   (само наръчници, напр.)

import { supabaseAdmin }           from '@/lib/supabase'
import { renameR2Object, slugify } from '@/lib/storage'

const DRY_RUN = process.env.DRY_RUN !== 'false'
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') || ''

type GalleryEntry = string | { url: string; alt?: string }

interface TableConfig {
  table:              string
  idField:            string
  nameField:          'name' | 'title' // ✅ реалната колона в тази таблица
  nameOf:             (row: any) => string
  // единични snimka полета — [{ field, tag }]; tag се добавя към новото име
  // (напр. tag: '' за главна снимка, tag: 'logo' за лого)
  singleImageFields:  { field: string; tag: string }[]
  galleryField?:      string
}

// ✅ По подразбиране — трите таблици от тази задача. affiliate_products
//    вече е обходена от v1 на скрипта, затова не е тук по подразбиране.
const DEFAULT_TABLES = ['naruchnici', 'products', 'special_sections']

const ALL_CONFIGS: Record<string, TableConfig> = {
  affiliate_products: {
    table: 'affiliate_products', idField: 'id', nameField: 'name',
    nameOf: r => r.slug || r.name,
    singleImageFields: [{ field: 'image_url', tag: '' }],
    galleryField: 'gallery_urls',
  },
  products: {
    table: 'products', idField: 'id', nameField: 'name',
    nameOf: r => r.slug || r.name,
    singleImageFields: [{ field: 'image_url', tag: '' }],
    galleryField: 'gallery_urls',
  },
  naruchnici: {
    table: 'naruchnici', idField: 'id', nameField: 'title',
    nameOf: r => r.slug || r.title,
    singleImageFields: [{ field: 'cover_image_url', tag: '' }],
  },
  special_sections: {
    table: 'special_sections', idField: 'id', nameField: 'title',
    nameOf: r => r.slug || r.title,
    singleImageFields: [
      { field: 'image_url', tag: '' },
      { field: 'logo_url',  tag: 'logo' },
    ],
  },
}

function keyFromUrl(url: string): string | null {
  if (!R2_PUBLIC_URL || !url.startsWith(R2_PUBLIC_URL + '/')) return null
  return url.slice(R2_PUBLIC_URL.length + 1)
}

function buildNewKey(oldKey: string, baseName: string, tag: string): string {
  const dotIdx   = oldKey.lastIndexOf('.')
  const ext      = dotIdx >= 0 ? oldKey.slice(dotIdx) : ''
  const slashIdx = oldKey.lastIndexOf('/')
  const dir      = slashIdx >= 0 ? oldKey.slice(0, slashIdx + 1) : ''
  const base     = slugify(baseName)
  const rand     = Math.random().toString(36).slice(2, 7)
  const suffix   = tag ? `-${tag}` : ''
  return `${dir}${base}${suffix}-${rand}${ext}`
}

async function migrateRow(cfg: TableConfig, row: any): Promise<void> {
  const baseName = cfg.nameOf(row) || 'item'
  const updates: Record<string, any> = {}
  let touched = false

  // ── Единични snimka полета (главна снимка, лого и т.н.) ─────────────────
  for (const { field, tag } of cfg.singleImageFields) {
    const url = row[field]
    if (!url) continue
    const oldKey = keyFromUrl(url)
    if (!oldKey) {
      console.log(`  ${field}: (не е в R2, пропускам) ${url}`)
      continue
    }
    const newKey = buildNewKey(oldKey, baseName, tag)
    const newUrl = `${R2_PUBLIC_URL}/${newKey}`
    console.log(`  ${field}: ${oldKey}  →  ${newKey}`)
    if (!DRY_RUN) {
      await renameR2Object(oldKey, newKey)
      updates[field] = newUrl
    }
    touched = true
  }

  // ── Галерия (ако таблицата поддържа) ─────────────────────────────────────
  if (cfg.galleryField && Array.isArray(row[cfg.galleryField]) && row[cfg.galleryField].length > 0) {
    const newGallery: GalleryEntry[] = []
    let i = 0
    for (const entry of row[cfg.galleryField] as GalleryEntry[]) {
      i++
      const url = typeof entry === 'string' ? entry : entry.url
      const alt = typeof entry === 'string' ? undefined : entry.alt
      const oldKey = url ? keyFromUrl(url) : null
      if (!oldKey) {
        console.log(`  ${cfg.galleryField} #${i}: (не е в R2, пропускам) ${url}`)
        newGallery.push(entry)
        continue
      }
      const newKey = buildNewKey(oldKey, baseName, `${i + 1}`)
      const newUrl = `${R2_PUBLIC_URL}/${newKey}`
      console.log(`  ${cfg.galleryField} #${i}: ${oldKey}  →  ${newKey}`)
      if (!DRY_RUN) await renameR2Object(oldKey, newKey)
      newGallery.push(alt ? { url: newUrl, alt } : { url: newUrl })
      touched = true
    }
    if (!DRY_RUN) updates[cfg.galleryField] = newGallery
  }

  if (touched && !DRY_RUN && Object.keys(updates).length > 0) {
    const { error } = await supabaseAdmin
      .from(cfg.table)
      .update(updates)
      .eq(cfg.idField, row[cfg.idField])

    if (error) console.error(`  ✗ DB грешка: ${error.message}`)
    else console.log(`  ✓ базата обновена`)
  }
}

async function migrateTable(cfg: TableConfig): Promise<void> {
  console.log(`\n━━━ Таблица: ${cfg.table} ━━━`)

  const selectCols = [
    cfg.idField, 'slug', cfg.nameField,
    ...cfg.singleImageFields.map(f => f.field),
    ...(cfg.galleryField ? [cfg.galleryField] : []),
  ].join(', ')

  const { data: rows, error } = await supabaseAdmin.from(cfg.table).select(selectCols)

  if (error) {
    console.error(`Грешка при четене от ${cfg.table}:`, error.message)
    return
  }
  if (!rows || rows.length === 0) {
    console.log(`  (няма записи)`)
    return
  }

  for (const row of rows as any[]) {
    console.log(`\n${cfg.nameOf(row)}:`)
    try {
      await migrateRow(cfg, row)
    } catch (err: any) {
      console.error(`  ✗ грешка:`, err.message)
    }
  }
}

async function main() {
  if (!R2_PUBLIC_URL) {
    console.error('Липсва R2_PUBLIC_URL в env — провери .env')
    process.exit(1)
  }

  const tableNames = (process.env.TABLES?.split(',').map(s => s.trim()).filter(Boolean)) || DEFAULT_TABLES
  const configs = tableNames.map(name => {
    const cfg = ALL_CONFIGS[name]
    if (!cfg) { console.error(`Непозната таблица в TABLES: ${name}`); process.exit(1) }
    return cfg
  })

  console.log(
    DRY_RUN
      ? `🔍 DRY RUN — само показва плана, нищо не се пипа.\n   Таблици: ${tableNames.join(', ')}\n   (пусни с DRY_RUN=false за реални промени)`
      : `🚀 Реални промени — таблици: ${tableNames.join(', ')}\n`
  )

  for (const cfg of configs) {
    await migrateTable(cfg)
  }

  console.log(
    DRY_RUN
      ? '\n✅ DRY RUN завърши. Ако планът изглежда добре, пусни отново с DRY_RUN=false.'
      : '\n✅ Миграцията приключи.'
  )
}

main().catch(err => { console.error(err); process.exit(1) })
