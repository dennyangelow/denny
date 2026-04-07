// app/api/upload-pdf/route.ts
// Качва PDF — Supabase или R2 според STORAGE_PROVIDER env var

import { NextRequest, NextResponse } from 'next/server'
import { uploadPdf } from '@/lib/storage'

const MAX_MB = 20

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

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadPdf(buffer, file.name)

    console.log(`[upload-pdf] ✓ ${result.provider} → ${result.url}`)
    return NextResponse.json({ url: result.url, provider: result.provider })

  } catch (err: any) {
    console.error('[upload-pdf] error:', err)
    return NextResponse.json(
      { error: err.message || 'Неочаквана грешка' },
      { status: 500 }
    )
  }
}
