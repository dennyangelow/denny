// app/api/upload-pdf/route.ts
// Качва PDF в Supabase Storage → връща публичния URL
// Поставете файла в: app/api/upload-pdf/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,   // service role — може да пише в storage
)

const BUCKET  = 'naruchnici'   // Supabase Storage bucket (създай го ако не съществува)
const MAX_MB  = 20

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Няма файл' }, { status: 400 })
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Само PDF файлове са разрешени' }, { status: 400 })
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      return NextResponse.json({ error: `Максимум ${MAX_MB} MB` }, { status: 400 })
    }

    // Уникално име: timestamp + оригинално име (без интервали)
    const safeName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '')
    const path     = `pdf/${Date.now()}-${safeName}`

    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType:  'application/pdf',
        cacheControl: '3600',
        upsert:       false,
      })

    if (uploadError) {
      console.error('[upload-pdf] storage error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // Вземи публичния URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(path)

    return NextResponse.json({ url: publicUrl })

  } catch (err: any) {
    console.error('[upload-pdf] fatal:', err)
    return NextResponse.json({ error: err.message || 'Неочаквана грешка' }, { status: 500 })
  }
}
