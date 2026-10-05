// app/api/carts/track/route.ts — v2
//
// POST — upsert на "чернова" количка веднага щом клиентът въведе валиден
//        имейл в checkout формата, докато все още пише (преди submit).
// DELETE — маркира draft-а като converted, викано веднага след успешна
//          поръчка, за да не получи клиентът излишен reminder имейл.
//
// ✅ v2 (сигурност/устойчивост — ендпойнтът е публичен, без вход):
//   • Rate limit по IP (в паметта на инстанцията — забавяне, не гаранция).
//   • Имейлът се валидира с регулярен израз и дължина ≤ 254 (v1: само includes('@')).
//   • name/phone/items/total се ограничават (v1: приемаше всякакъв размер на JSON).
//   • Остава "best effort": грешка тук никога не чупи checkout-а (отговор 200).
//
// ⚠️ Към момента НЯМА cron, който праща напомняния за изоставени колички, затова
//    данните само се събират. Ако по-късно добавиш такъв, пращай напомняния само
//    към адреси, за които има съгласие (GDPR) — иначе този публичен ендпойнт ще
//    може да се ползва за изпращане на писма до чужди адреси.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, getIP } from '@/lib/rate-limit'

const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAX_ITEMS  = 50
const MAX_JSON   = 20_000   // символа в сериализирания списък с артикули

function cleanEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const e = v.toLowerCase().trim()
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null
}

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimit(`cart-track:${getIP(req)}`, { limit: 20, window: 600 })
    if (!rl.success) {
      return NextResponse.json({ success: false, error: 'rate_limited' }, { status: 429 })
    }

    const body = await req.json().catch(() => ({}))
    const email = cleanEmail(body?.email)
    if (!email) {
      return NextResponse.json({ error: 'Невалиден имейл' }, { status: 400 })
    }

    const name  = typeof body.name  === 'string' ? body.name.trim().slice(0, 120)  : null
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 40)  : null

    let items: unknown[] = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : []
    if (JSON.stringify(items).length > MAX_JSON) items = []

    const totalNum = Number(body.total)
    const total = Number.isFinite(totalNum) && totalNum >= 0 && totalNum <= 1_000_000 ? totalNum : 0

    const { error } = await supabaseAdmin
      .from('abandoned_carts')
      .upsert(
        {
          email,
          name:       name || null,
          phone:      phone || null,
          items,
          total,
          updated_at: new Date().toISOString(),
          converted:  false,
          reminded_at: null, // нов draft при промяна на количката → нов шанс за reminder
        },
        { onConflict: 'email' }
      )

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    // Best-effort endpoint — грешка тук никога не бива да чупи checkout-а
    console.error('[carts/track] POST error:', error?.message || error)
    return NextResponse.json({ success: false }, { status: 200 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const rl = rateLimit(`cart-track-del:${getIP(req)}`, { limit: 20, window: 600 })
    if (!rl.success) {
      return NextResponse.json({ success: false, error: 'rate_limited' }, { status: 429 })
    }

    const body = await req.json().catch(() => ({}))
    const email = cleanEmail(body?.email)
    if (!email) return NextResponse.json({ success: false }, { status: 200 })

    await supabaseAdmin
      .from('abandoned_carts')
      .update({ converted: true, updated_at: new Date().toISOString() })
      .eq('email', email)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[carts/track] DELETE error:', error?.message || error)
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
