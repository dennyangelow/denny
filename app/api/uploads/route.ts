// app/api/upload/route.ts — Upload снимки към Supabase Storage

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const BUCKET = 'images'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file   = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'products'

    if (!file) {
      return NextResponse.json({ error: 'Няма файл' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Само JPEG, PNG, WebP или GIF' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Файлът е над 5MB' }, { status: 400 })
    }

    // Уникално файлово име
    const ext       = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const timestamp = Date.now()
    const random    = Math.random().toString(36).slice(2, 8)
    const filename  = `${folder}/${timestamp}-${random}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer      = new Uint8Array(arrayBuffer)

    // Провери дали bucket съществува
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const bucketExists = buckets?.some(b => b.name === BUCKET)

    if (!bucketExists) {
      // Опит да се създаде bucket автоматично
      const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET, {
        public: true,
        allowedMimeTypes: ALLOWED_TYPES,
        fileSizeLimit: MAX_SIZE,
      })
      if (createError) {
        return NextResponse.json({
          error: `Storage bucket "${BUCKET}" не съществува. Създай го в Supabase Dashboard → Storage → New bucket → name: "images", Public: ✓`,
        }, { status: 500 })
      }
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
        cacheControl: '31536000',
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({
        error: `Upload грешка: ${uploadError.message}`,
      }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(filename)

    return NextResponse.json({ url: publicUrl, path: filename })
  } catch (err: any) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: err.message || 'Неизвестна грешка' }, { status: 500 })
  }
}
