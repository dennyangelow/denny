// app/api/upload/route.ts
// ФИКС: Проверява bucket-а динамично + поддържа images/ и uploads/ bucket

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

// Всички позволени папки — добавяй тук при нужда
const VALID_FOLDERS = ['products', 'testimonials', 'settings', 'handbooks', 'marketing', 'banners', 'misc']

// ФИКС: Маркетинг снимките отиват в bucket 'images', folder 'marketing'
// Продукти → 'images/products', всичко друго → 'uploads'
function getBucketAndPath(folder: string, filename: string): { bucket: string; path: string } {
  if (['products', 'marketing', 'banners', 'testimonials', 'special-sections'].includes(folder)) {
    return { bucket: 'images', path: `${folder}/${filename}` }
  }
  return { bucket: 'uploads', path: `${folder}/${filename}` }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const rawFolder = (formData.get('folder') as string) || 'products'

    // Санитизация на folder
    const folder = VALID_FOLDERS.includes(rawFolder) ? rawFolder : 'misc'

    if (!file) {
      return NextResponse.json({ error: 'Няма избран файл' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Невалиден формат. Използвай JPG, PNG или WebP' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Файлът е твърде голям (макс 5MB)' },
        { status: 400 }
      )
    }

    // Генериране на уникално name
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
    const { bucket, path } = getBucketAndPath(folder, uniqueFilename)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Качване в Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error(`Supabase upload error (bucket: ${bucket}, path: ${path}):`, uploadError)
      return NextResponse.json(
        { error: `Upload грешка: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Публичен URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(path)

    return NextResponse.json({ url: publicUrl })
  } catch (err: any) {
    console.error('Upload error:', err)
    return NextResponse.json(
      { error: `Сървърна грешка: ${err?.message || 'Неизвестна'}` },
      { status: 500 }
    )
  }
}
