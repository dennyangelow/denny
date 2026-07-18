// app/api/customers/[phone]/notes/route.ts
// POST → добавя нова бележка в хронологията (не презаписва предишни)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(
  req: NextRequest,
  { params }: { params: { phone: string } }
) {
  try {
    const phone = decodeURIComponent(params.phone)
    const body  = await req.json()

    if (!body.note || !String(body.note).trim()) {
      return NextResponse.json({ error: 'Бележката е празна' }, { status: 400 })
    }

    const { data: profileRows, error: profileError } = await supabaseAdmin
      .rpc('get_customer_profile', { p_phone: phone })
    if (profileError) throw profileError

    const customerId = profileRows?.[0]?.customer_id
    if (!customerId) {
      return NextResponse.json({ error: 'Клиентът не е намерен — отвори профила първо' }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin
      .from('customer_notes')
      .insert({
        customer_id:  customerId,
        note:         String(body.note).trim(),
        call_outcome: body.call_outcome || null,
        author:       body.author || null,
        pinned:       !!body.pinned,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, note: data })
  } catch (error: any) {
    console.error('POST /api/customers/[phone]/notes error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
