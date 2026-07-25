// lib/storage.ts
// Абстракционен слой за Storage — Supabase или Cloudflare R2
// Превключването става с env var STORAGE_PROVIDER=supabase|r2
//
// В Vercel → Settings → Environment Variables:
//   STORAGE_PROVIDER=r2          ← Cloudflare R2 (препоръчително)
//   STORAGE_PROVIDER=supabase    ← Supabase Storage (стар начин)
//
// R2 env vars (само ако STORAGE_PROVIDER=r2):
//   R2_ACCOUNT_ID
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET_NAME
//   R2_PUBLIC_URL   ← https://pub-XXX.r2.dev

import { S3Client, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { supabaseAdmin } from '@/lib/supabase'
import { extname } from 'path'

// ── Типове ────────────────────────────────────────────────────────────────────
export type StorageProvider = 'supabase' | 'r2'

export interface UploadResult {
  url:      string
  provider: StorageProvider
}

// ── Кой провайдър е активен ───────────────────────────────────────────────────
export function getActiveProvider(): StorageProvider {
  const p = process.env.STORAGE_PROVIDER?.toLowerCase()
  return p === 'r2' ? 'r2' : 'supabase'
}

// ── Транслитерация (кирилица → латиница) + slugify за SEO файлови имена ────
const CYRILLIC_MAP: Record<string, string> = {
  а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ж:'zh', з:'z', и:'i', й:'y',
  к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u',
  ф:'f', х:'h', ц:'ts', ч:'ch', ш:'sh', щ:'sht', ъ:'a', ь:'', ю:'yu', я:'ya',
}

export function slugify(text: string): string {
  const translit = text
    .toLowerCase()
    .split('')
    .map(ch => CYRILLIC_MAP[ch] ?? ch)
    .join('')
  return translit
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '') // маха accents от латиница
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// ── Content-type helper ───────────────────────────────────────────────────────
function getContentType(filename: string): string {
  const ext = extname(filename).toLowerCase()
  const map: Record<string, string> = {
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.webp': 'image/webp',
    '.gif':  'image/gif',
    '.svg':  'image/svg+xml',
    '.pdf':  'application/pdf',
  }
  return map[ext] || 'application/octet-stream'
}

// ── Supabase upload ───────────────────────────────────────────────────────────
function getSupabaseBucketAndPath(
  folder: string,
  filename: string
): { bucket: string; path: string } {
  const imageFolders = ['products', 'marketing', 'banners', 'testimonials', 'special-sections', 'affiliate', 'naruchnici', 'misc']
  if (imageFolders.includes(folder)) {
    return { bucket: 'images', path: `${folder}/${filename}` }
  }
  return { bucket: 'uploads', path: `${folder}/${filename}` }
}

async function uploadToSupabase(
  buffer: Buffer,
  filename: string,
  folder: string,
  contentType: string
): Promise<UploadResult> {
  const { bucket, path } = getSupabaseBucketAndPath(folder, filename)

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, buffer, { contentType, upsert: false })

  if (error) throw new Error(`Supabase upload грешка: ${error.message}`)

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(path)

  return { url: publicUrl, provider: 'supabase' }
}

// ── R2 upload ─────────────────────────────────────────────────────────────────
let _r2Client: S3Client | null = null

function getR2Client(): S3Client {
  if (_r2Client) return _r2Client

  const accountId = process.env.R2_ACCOUNT_ID
  const accessKey = process.env.R2_ACCESS_KEY_ID
  const secretKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKey || !secretKey) {
    throw new Error('Липсват R2 env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY')
  }

  _r2Client = new S3Client({
    region:   'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  })

  return _r2Client
}

async function uploadToR2(
  buffer: Buffer,
  filename: string,
  folder: string,
  contentType: string
): Promise<UploadResult> {
  const bucket    = process.env.R2_BUCKET_NAME
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '')

  if (!bucket || !publicUrl) {
    throw new Error('Липсват R2 env vars: R2_BUCKET_NAME, R2_PUBLIC_URL')
  }

  // Запазваме същата структура като Supabase: images/products/file.jpg
  const imageFolders = ['products', 'marketing', 'banners', 'testimonials', 'special-sections', 'affiliate', 'naruchnici', 'misc']
  const prefix = imageFolders.includes(folder) ? 'images' : 'uploads'
  const key    = `${prefix}/${folder}/${filename}`

  const r2 = getR2Client()
  await r2.send(new PutObjectCommand({
    Bucket:       bucket,
    Key:          key,
    Body:         buffer,
    ContentType:  contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }))

  return { url: `${publicUrl}/${key}`, provider: 'r2' }
}

// ── PDF upload към R2 ─────────────────────────────────────────────────────────
// ── Преименуване на обект в R2 (copy + delete) ─────────────────────────────
// ✅ Използва се от еднократния migration скрипт (scripts/migrate-image-names.ts),
//    за да преименува вече качени снимки с описателни SEO имена, без да минава
//    през браузъра — директно вътре в R2.
export async function renameR2Object(oldKey: string, newKey: string): Promise<void> {
  const bucket = process.env.R2_BUCKET_NAME
  if (!bucket) throw new Error('Липсва R2_BUCKET_NAME')

  const r2 = getR2Client()
  const encodedSource = oldKey.split('/').map(encodeURIComponent).join('/')

  await r2.send(new CopyObjectCommand({
    Bucket:            bucket,
    CopySource:        `${bucket}/${encodedSource}`,
    Key:                newKey,
    MetadataDirective: 'COPY',
  }))
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: oldKey }))
}

async function uploadPdfToR2(
  buffer: Buffer,
  filename: string,
): Promise<UploadResult> {
  const bucket    = process.env.R2_BUCKET_NAME
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '')

  if (!bucket || !publicUrl) {
    throw new Error('Липсват R2 env vars: R2_BUCKET_NAME, R2_PUBLIC_URL')
  }

  const key = `naruchnici/pdf/${filename}`
  const r2  = getR2Client()

  await r2.send(new PutObjectCommand({
    Bucket:       bucket,
    Key:          key,
    Body:         buffer,
    ContentType:  'application/pdf',
    CacheControl: 'public, max-age=31536000, immutable',
  }))

  return { url: `${publicUrl}/${key}`, provider: 'r2' }
}

// ── Публичен API ──────────────────────────────────────────────────────────────

/**
 * Качва изображение на активния провайдър.
 * Използва се от /api/upload/route.ts
 * ✅ nameHint (напр. slug-а или името на продукта) прави файловото име
 *    описателно за SEO: armonika-pk-25-32-a1b2c.webp вместо случайни символи.
 */
export async function uploadImage(
  buffer: Buffer,
  originalFilename: string,
  folder: string,
  nameHint?: string
): Promise<UploadResult> {
  const ext      = extname(originalFilename).toLowerCase() || '.jpg'
  const rand     = Math.random().toString(36).slice(2, 7)
  const base     = nameHint ? slugify(nameHint) : ''
  const filename = base ? `${base}-${rand}${ext}` : `${Date.now()}-${rand}${ext}`
  const ct       = getContentType(filename)
  const provider = getActiveProvider()

  console.log(`[storage] upload image → ${provider} | folder: ${folder}`)

  if (provider === 'r2') {
    return uploadToR2(buffer, filename, folder, ct)
  }
  return uploadToSupabase(buffer, filename, folder, ct)
}

/**
 * Качва PDF на активния провайдър.
 * Използва се от /api/upload-pdf/route.ts
 */
export async function uploadPdf(
  buffer: Buffer,
  originalFilename: string
): Promise<UploadResult> {
  const safeName = originalFilename
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
  const filename = `${Date.now()}-${safeName}`
  const provider = getActiveProvider()

  console.log(`[storage] upload pdf → ${provider}`)

  if (provider === 'r2') {
    return uploadPdfToR2(buffer, filename)
  }

  // Supabase PDF upload
  const path = `pdf/${filename}`
  const { error } = await supabaseAdmin.storage
    .from('naruchnici')
    .upload(path, buffer, { contentType: 'application/pdf', upsert: false })

  if (error) throw new Error(`Supabase PDF upload грешка: ${error.message}`)

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('naruchnici')
    .getPublicUrl(path)

  return { url: publicUrl, provider: 'supabase' }
}
