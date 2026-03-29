// app/api/upload/route.ts — Upload снимки към Supabase Storage
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const BUCKET = 'images'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'products'

    // (По желание) Веднага след: const folder = ... || 'products'
const validFolders = ['products', 'testimonials', 'settings', 'handbooks'];
const finalFolder = validFolders.includes(folder) ? folder : 'misc';

    if (!file) {
      return NextResponse.json({ error: 'Няма избран файл' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Невалиден формат. Използвай JPG, PNG или WebP' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Файлът е твърде голям (макс 5MB)' }, { status: 400 })
    }

    // Генериране на уникално име
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Качване в Supabase
    const { data, error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // Вземане на публичен URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(filename)

    return NextResponse.json({ url: publicUrl })
  } catch (err: any) {
    console.error('Upload error:', err)
    // Връщаме JSON, за да не гърми браузъра с "Unexpected token <"
    return NextResponse.json({ error: 'Сървърна грешка при качване' }, { status: 500 })
  }
}