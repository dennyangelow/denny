// app/api/leads/sync/reset-invalid/route.ts — v1
//
// Ресетва systemeio_email_invalid = false за конкретни или всички контакти
// Позволява да се опита повторен sync след погрешно маркиране

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const ids: string[] | undefined = body.ids  // ако са подадени конкретни IDs

    const now = new Date().toISOString()

    let query = supabaseAdmin
      .from('leads')
      .update({
        systemeio_email_invalid: false,
        systemeio_synced:        false,
        updated_at:              now,
      })

    if (ids && ids.length > 0) {
      // Ресет само на конкретни
      query = query.in('id', ids)
    } else {
      // Ресет на всички невалидни
      query = query.eq('systemeio_email_invalid', true)
    }

    const { error, count } = await query.select('id', { count: 'exact' })

    if (error) {
      console.error('[reset-invalid] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.info(`[reset-invalid] Ресетнати ${count ?? 'unknown'} контакта`)

    return NextResponse.json({
      success: true,
      reset:   count ?? 0,
      message: `${count ?? 0} контакта ресетнати — готови за нов sync`,
    })
  } catch (err: any) {
    console.error('[reset-invalid] Fatal:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET — брой невалидни
export async function GET() {
  const { count } = await supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('systemeio_email_invalid', true)

  return NextResponse.json({ invalidCount: count ?? 0 })
}
