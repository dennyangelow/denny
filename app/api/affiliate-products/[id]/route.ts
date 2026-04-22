// app/api/affiliate-clicks/route.ts
// ✅ POST — логва клик към affiliate партньор в affiliate_clicks таблицата
// ✅ Публичен route (без auth) — извиква се от клиента при клик

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { partner, product_slug } = body

    if (!partner) {
      return NextResponse.json({ error: 'partner е задължителен' }, { status: 400 })
    }

    const ip         = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null
    const userAgent  = req.headers.get('user-agent') || null
    const referrer   = req.headers.get('referer') || null

    const { error } = await supabaseAdmin
      .from('affiliate_clicks')
      .insert({
        partner,
        product_slug: product_slug || null,
        ip_address:   ip,
        user_agent:   userAgent,
        referrer,
      })

    if (error) {
      console.error('affiliate_clicks insert error:', error)
      // Не връщаме грешка на клиента — кликът продължава към партньора
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
