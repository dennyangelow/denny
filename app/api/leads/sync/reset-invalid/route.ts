// app/api/leads/sync/reset-invalid/route.ts — v2
//
// ПОПРАВКА: count се взима от отделна .select('*', { count: 'exact', head: true }) заявка
// Старият код разчиташе на count от .select('id', { count: 'exact' }) след .update()
// което не работи правилно в Supabase и хвърляше "invalidCount is not defined"

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const ids: string[] | undefined = body.ids

    const now = new Date().toISOString()

    // 1. Първо вземаме броя ПРЕДИ ресета (за да върнем точен count)
    let countQuery = supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })

    if (ids && ids.length > 0) {
      countQuery = countQuery.in('id', ids)
    } else {
      countQuery = countQuery.eq('systemeio_email_invalid', true)
    }

    const { count: resetCount } = await countQuery

    // 2. Правим update-а
    let updateQuery = supabaseAdmin
      .from('leads')
      .update({
        systemeio_email_invalid: false,
        systemeio_synced:        false,
        updated_at:              now,
      })

    if (ids && ids.length > 0) {
      updateQuery = updateQuery.in('id', ids)
    } else {
      updateQuery = updateQuery.eq('systemeio_email_invalid', true)
    }

    const { error } = await updateQuery

    if (error) {
      console.error('[reset-invalid] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const count = resetCount ?? ids?.length ?? 0
    console.info(`[reset-invalid] Ресетнати ${count} контакта`)

    return NextResponse.json({
      success: true,
      reset:   count,
      message: `${count} контакта ресетнати — готови за нов sync`,
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
