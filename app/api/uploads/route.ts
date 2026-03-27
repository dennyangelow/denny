// app/api/upload/route.ts — Upload снимки към Supabase Storage
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
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

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const timestamp = Date.now()
    const random = Math.random().toString(36).slice(2, 8)
    const filename = `${folder}/${timestamp}-${random}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { data, error } = await supabaseAdmin.storage
      .from('images') // Bucket name — създай го в Supabase Storage
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error('Storage error:', error)
      // Fallback: ако няма Storage bucket, върни грешка с инструкции
      return NextResponse.json({
        error: `Storage грешка: ${error.message}. Създай bucket "images" в Supabase Storage с публичен достъп.`,
      }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('images')
      .getPublicUrl(filename)

    return NextResponse.json({ url: publicUrl, path: filename })
  } catch (err: any) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
