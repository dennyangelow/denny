// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'general'

    // 1. Основни проверки
    if (!file) {
      return NextResponse.json({ error: 'Моля, изберете файл.' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Неподдържан формат. Използвайте JPG, PNG или WebP.' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Снимката е твърде голяма (макс. 5MB).' }, { status: 400 })
    }

    // 2. Почистване на оригиналното име на файла (премахваме странни символи)
    const cleanFileName = file.name
      .toLowerCase()
      .replace(/\s+/g, '-') // Сменяме интервалите с тирета
      .replace(/[^a-z0-9.-]/g, '') // Премахваме всичко останало

    const ext = cleanFileName.split('.').pop() || 'jpg'
    const timestamp = Date.now()
    const filename = `${folder}/${timestamp}-${cleanFileName}`

    // 3. Подготовка на буфера
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // 4. Качване в Supabase Storage
    const { data, error: uploadError } = await supabaseAdmin.storage
      .from('images') // Увери се, че имаш Bucket с това име
      .upload(filename, buffer, {
        contentType: file.type,
        cacheControl: '3600', // Кеширане за 1 час
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage error:', uploadError)
      return NextResponse.json({ 
        error: `Грешка при качване: ${uploadError.message}. Уверете се, че bucket "images" съществува в Supabase.` 
      }, { status: 500 })
    }

    // 5. Генериране на публичния URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('images')
      .getPublicUrl(filename)

    return NextResponse.json({ 
      url: publicUrl, 
      path: filename,
      name: cleanFileName 
    })

  } catch (err: any) {
    console.error('Upload catch error:', err)
    return NextResponse.json({ error: 'Възникна грешка при обработката на файла.' }, { status: 500 })
  }
}