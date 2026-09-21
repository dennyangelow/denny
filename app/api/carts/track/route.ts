// app/api/carts/track/route.ts
//
// POST — upsert на "чернова" количка веднага щом клиентът въведе валиден
//        имейл в checkout формата, докато все още пише (преди submit).
// DELETE — маркира draft-а като converted, викано веднага след успешна
//          поръчка, за да не получи клиентът излишен reminder имейл.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { email, name, items, total } = await req.json()
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Невалиден имейл' }, { status: 400 })
    }

    const cleanEmail = email.toLowerCase().trim()
    const now = new Date().toISOString()

    const { error } = await supabaseAdmin
      .from('abandoned_carts')
      .upsert(
        {
          email:      cleanEmail,
          name:       name || null,
          items:      items || [],
          total:      total || 0,
          updated_at: now,
          converted:  false,
          reminded_at: null, // нов draft при промяна на количката → нов шанс за reminder
        },
        { onConflict: 'email' }
      )

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    // Best-effort endpoint — грешка тук никога не бива да чупи checkout-а
    console.error('[carts/track] POST error:', error)
    return NextResponse.json({ success: false }, { status: 200 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ success: false }, { status: 200 })

    await supabaseAdmin
      .from('abandoned_carts')
      .update({ converted: true, updated_at: new Date().toISOString() })
      .eq('email', email.toLowerCase().trim())

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[carts/track] DELETE error:', error)
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
