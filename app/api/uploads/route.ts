// app/api/uploads/route.ts
// Качва изображения — Supabase или R2 според STORAGE_PROVIDER env var

import { NextRequest, NextResponse } from 'next/server'
import { uploadImage } from '@/lib/storage'

const ALLOWED_TYPES  = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE       = 5 * 1024 * 1024 // 5MB
const VALID_FOLDERS  = ['products', 'testimonials', 'settings', 'handbooks', 'marketing',
                        'banners', 'misc', 'affiliate', 'naruchnici', 'special-sections']

export async function POST(req: NextRequest) {
  try {
    const formData  = await req.formData()
    const file      = formData.get('file') as File | null
    const rawFolder = (formData.get('folder') as string) || 'products'
    const folder    = VALID_FOLDERS.includes(rawFolder) ? rawFolder : 'misc'

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

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadImage(buffer, file.name, folder)

    console.log(`[upload] ✓ ${result.provider} → ${result.url}`)
    return NextResponse.json({ url: result.url, provider: result.provider })

  } catch (err: any) {
    console.error('[upload] error:', err)
    return NextResponse.json(
      { error: `Сървърна грешка: ${err?.message || 'Неизвестна'}` },
      { status: 500 }
    )
  }
}
