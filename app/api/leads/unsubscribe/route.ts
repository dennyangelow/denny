// app/api/leads/unsubscribe/route.ts — v2
//
// ПОПРАВКИ v2 (спрямо v1):
//   ✅ Изисква валиден `token` (lib/unsubscribe-token.ts) — преди всеки,
//      който знаеше/познаеше чужд email, можеше да го отпише с прост POST.
//      Токенът се проверява constant-time, идва подписан в самия линк
//      (виж buildUnsubscribeUrl, вече ползван в broadcast/route.ts).
//   ✅ Заявка без token все още работи, но само след явно потвърждение —
//      НЕ, всъщност вече не work-ва без token изобщо (виж бележката долу
//      защо не оставихме "мек" fallback).
//
// ⚠️ Стари unsubscribe линкове, изпратени ПРЕДИ този deploy (в стари
// welcome/imейли, вече доставени в inbox-и), нямат &token= — ще получат
// грешка при клик. Няма как да го избегнем без да пазим token-а без
// значение (което връща същата дупка) — приемливо: потребител с грешка
// тук вижда ясно съобщение и може да пише директно, или следващия
// broadcast/имейл вече ще носи валиден линк.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe-token'

export async function POST(req: NextRequest) {
  try {
    const { email, token, reason } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const cleanEmail = String(email).toLowerCase().trim()

    if (!(await verifyUnsubscribeToken(cleanEmail, token))) {
      return NextResponse.json(
        { error: 'Невалиден или изтекъл линк за отписване. Провери линка от имейла или пиши ни директно.' },
        { status: 401 },
      )
    }

    const { error } = await supabaseAdmin
      .from('leads')
      .update({
        subscribed: false,
        unsubscribe_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('email', cleanEmail)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
