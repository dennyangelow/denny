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

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
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
 */
export async function uploadImage(
  buffer: Buffer,
  originalFilename: string,
  folder: string
): Promise<UploadResult> {
  const ext      = extname(originalFilename).toLowerCase() || '.jpg'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`
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
