// app/api/earnings/route.ts
// Лог на реално получените плащания (Atlas Terra комисионна + афилиейт от AgroApteki)
// ⚠️ ВАЖНО: не забравяй да добавиш /api/earnings в middleware.ts (matcher-а),
//    за да е защитен от admin auth — по същия начин както другите /api/own-products,
//    /api/affiliate-products route-ове. Иначе е публично достъпен.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const source = req.nextUrl.searchParams.get('source') // 'atlas_terra' | 'affiliate' | null

    let query = supabaseAdmin
      .from('earnings_log')
      .select('*')
      .order('paid_date', { ascending: false })

    if (source === 'atlas_terra' || source === 'affiliate') {
      query = query.eq('source', source)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ entries: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { source, payer, amount, paid_date, period_start, period_end, note } = body

    if (!source || !['atlas_terra', 'affiliate'].includes(source)) {
      return NextResponse.json({ error: 'Невалиден source' }, { status: 400 })
    }
    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Невалидна сума' }, { status: 400 })
    }
    if (!paid_date) {
      return NextResponse.json({ error: 'Липсва дата на плащане' }, { status: 400 })
    }

    const insertPayload = {
      source,
      payer:        payer || null,
      amount:       Number(amount),
      paid_date,
      period_start: period_start || null,
      period_end:   period_end || null,
      note:         note || null,
    }

    const { data, error } = await supabaseAdmin
      .from('earnings_log')
      .insert(insertPayload)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ entry: data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Липсва id' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('earnings_log')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
