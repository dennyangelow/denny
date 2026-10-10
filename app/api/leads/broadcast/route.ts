// app/api/leads/broadcast/route.ts — v3
// Изпращането минава през lib/mailer.ts (Amazon SES).
//
// ПОПРАВКИ v3 (спрямо v2) — реален bug, намерен при прегледа:
//   ⚠️ COOLDOWN-ът (`let lastBroadcast` — обикновена module-level променлива)
//      НЕ работи надеждно в serverless среда (Vercel):
//      1. ПРАЗНИНА (TOCTOU race): две почти едновременни POST заявки минават
//         ПРЕДИ нито една да е обновила lastBroadcast → и двете тръгват да
//         пращат broadcast едновременно → всеки абонат получава писмото
//         ДВА ПЪТИ. Автоматизациите (lib/automations.ts) имат точно за това
//         claim()-based lease защита — тук я нямаше изобщо.
//      2. ПАМЕТТА НЕ Е СПОДЕЛЕНА между инстанции/cold starts: Vercel може да
//         стартира нов process за всяка заявка (или след известно бездействие) —
//         lastBroadcast тогава пак е 0, все едно cooldown-ът изобщо не
//         съществува. Т.е. 10-минутният cooldown реално защитаваше само "една
//         и съща топла инстанция, бързо последователни заявки" — тънка защита.
//   ✅ ФИКС: cooldown-ът вече се пази в `settings` таблицата (key
//      'last_broadcast_at'), споделена между всички инстанции. "Claim"-ваме
//      слота с UPDATE, условен на старата стойност (compare-and-swap, same
//      трик както at-most-once semantics другаде в проекта) — ако заявка Б
//      дойде секунда след заявка А, UPDATE-ът на Б вижда вече новия timestamp
//      на А и НЕ минава условието → Б получава ясна грешка "вече тече
//      broadcast / изчакай", вместо тихо да изпрати дубликат.
//
// ПОПРАВКИ v2 (запазени):
//   ✅ Unsubscribe линкът в footer-а носи подписан &token= (lib/
//      unsubscribe-token.ts) — /api/leads/unsubscribe/route.ts v2 изисква
//      валиден token, иначе всеки линк с чужд email щеше да отписва
//      произволен контакт без проверка.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail } from '@/lib/mailer'
import { buildUnsubscribeUrl } from '@/lib/unsubscribe-token'

const COOLDOWN_MS = 10 * 60 * 1000
const SETTINGS_KEY = 'last_broadcast_at'

/**
 * Опитва се да "резервира" broadcast слота в `settings` таблицата.
 * Връща { ok:true } ако заявката е първата за последните COOLDOWN_MS,
 * или { ok:false, resetIn } ако друга заявка вече го държи.
 *
 * Не е 100% атомарно без истинска DB транзакция/row-lock, но затваря
 * почти целия race-прозорец от стария in-memory вариант: условният UPDATE
 * (.eq/.lt на старата стойност) гарантира, че само ЕДНА от две едновременни
 * заявки вижда засегнат ред → печели claim-а.
 */
async function claimBroadcastSlot(): Promise<{ ok: true } | { ok: false; resetIn: number }> {
  const nowIso = new Date().toISOString()
  const cutoffIso = new Date(Date.now() - COOLDOWN_MS).toISOString()

  const { data: existing } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle()

  if (!existing) {
    // Първи broadcast изобщо — insert-ваме реда.
    const { error } = await supabaseAdmin
      .from('settings')
      .insert({ key: SETTINGS_KEY, value: nowIso })
    if (error) {
      // Race: друга заявка е insert-нала междувременно (unique violation) → третираме като "зает слот"
      return { ok: false, resetIn: Math.ceil(COOLDOWN_MS / 1000) }
    }
    return { ok: true }
  }

  const lastAt = existing.value
  if (lastAt && lastAt > cutoffIso) {
    const remainingMs = COOLDOWN_MS - (Date.now() - new Date(lastAt).getTime())
    return { ok: false, resetIn: Math.max(1, Math.ceil(remainingMs / 1000)) }
  }

  // Условен UPDATE: само ако стойността в базата е все още старата, която
  // прочетохме (= никой друг не е claim-нал слота междувременно).
  const { data: claimed, error } = await supabaseAdmin
    .from('settings')
    .update({ value: nowIso })
    .eq('key', SETTINGS_KEY)
    .eq('value', lastAt)
    .select('key')

  if (error || !claimed || claimed.length === 0) {
    // Друга заявка е спечелила състезанието междувременно.
    return { ok: false, resetIn: Math.ceil(COOLDOWN_MS / 1000) }
  }

  return { ok: true }
}

export async function POST(req: NextRequest) {
  const claim = await claimBroadcastSlot()
  if (!claim.ok) {
    return NextResponse.json(
      { error: `Изчакай още ${claim.resetIn} секунди преди следващото изпращане` },
      { status: 429 }
    )
  }

  try {
    const { subject, body, tags, onlySubscribed = true } = await req.json()
    if (!subject?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Темата и съдържанието са задължителни' }, { status: 400 })
    }

    let query = supabaseAdmin.from('leads').select('email, name')
    if (onlySubscribed) query = query.eq('subscribed', true)
    if (tags && tags.length > 0) query = query.overlaps('tags', tags)

    const { data: leads, error } = await query
    if (error) throw error
    if (!leads || leads.length === 0) {
      return NextResponse.json({ error: 'Няма подходящи абонати' }, { status: 400 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dennyangelow.com'
    let sent      = 0
    const errors: string[] = []

    // По-малки батчове и по-дълга пауза заради SES rate limit (1/сек в sandbox,
    // по-висок след production access, но пак остава смислено да не бием на месо)
    const BATCH = 5
    for (let i = 0; i < leads.length; i += BATCH) {
      const batch = leads.slice(i, i + BATCH)
      for (const lead of batch) {
        try {
          const personalBody = body.replace(/\{\{name\}\}/g, lead.name || 'приятелю')
          const unsubUrl = await buildUnsubscribeUrl(siteUrl, lead.email)
          await sendEmail({
            to:      lead.email,
            subject,
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
                ${personalBody.replace(/\n/g, '<br>')}
                <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
                <p style="font-size:12px;color:#9ca3af">
                  Ако не желаеш да получаваш повече имейли:
                  <a href="${unsubUrl}" style="color:#9ca3af">отпиши се тук</a>.
                </p>
              </div>
            `,
          })
          sent++
        } catch (e: any) {
          errors.push(`${lead.email}: ${e.message}`)
        }
        await new Promise(r => setTimeout(r, 150))
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      total: leads.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    console.error('Broadcast error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
