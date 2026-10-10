// app/api/admin/email-templates/[key]/route.ts — v2
//
// ПОПРАВКИ v2 (спрямо v1) — Мега план: свободна библиотека, не 6 фиксирани ключа:
//   ✅ PATCH вече НЕ изисква ключът да е в TEMPLATE_KEYS — всяка стъпка от
//      builder-а може да създаде НОВ темплейт (уникален ключ, генериран от
//      базата при insert в workflow_steps/email_templates), не само 6-те
//      стари. TEMPLATE_KEYS остава само за показване на "познатите" етикети
//      в UI-а (label/vars) — ключ извън списъка просто няма готов label.
//   ✅ DELETE вече проверява дали темплейтът се ползва в АКТИВНА стъпка на
//      автоматизация, преди да трие — иначе тази стъпка би останала без
//      съдържание (lib/automations.ts v6 вече няма код fallback, виж
//      SQL migration-а "Мега план"). Ако се ползва → 409 с ясно съобщение
//      кои стъпки го ползват, вместо тихо чупене при следващото изпращане.
//
// ⚠️ Автентикацията се очаква от middleware (както останалите admin routes —
//    виж бележката в app/api/admin/naruchnici/[id]/seo/route.ts).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const MAX_KEY_LEN      = 80
const MAX_SUBJECT_LEN  = 200
const MAX_BODY_LEN     = 20000
const KEY_PATTERN      = /^[a-z0-9_]+$/   // пази се четим/безопасен за URL/DB, без нужда от TEMPLATE_KEYS whitelist

export async function PATCH(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  if (!params.key || params.key.length > MAX_KEY_LEN || !KEY_PATTERN.test(params.key)) {
    return NextResponse.json({ error: 'Невалиден темплейт key (само малки латински букви, цифри и _)' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Невалидно тяло на заявката' }, { status: 400 })
  }

  const subject  = typeof body.subject   === 'string' ? body.subject.trim().slice(0, MAX_SUBJECT_LEN)   : ''
  const bodyHtml = typeof body.body_html === 'string' ? body.body_html.trim().slice(0, MAX_BODY_LEN) : ''

  if (!subject || !bodyHtml) {
    return NextResponse.json({ error: 'Темата и съдържанието (body_html) са задължителни' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('email_templates')
    .upsert(
      { template_key: params.key, subject, body_html: bodyHtml, updated_at: new Date().toISOString() },
      { onConflict: 'template_key' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { key: string } }
) {
  // ✅ v2 — guard: не трием темплейт, който активна стъпка все още сочи.
  //    lib/automations.ts v6 чете ВИНАГИ от email_templates (без код
  //    fallback) — изтриване тук би оставило тази стъпка без съдържание
  //    при следващото ѝ изпълнение (грешка "темплейт липсва в библиотеката").
  const { data: usedBy } = await supabaseAdmin
    .from('workflow_steps')
    .select('step_number, workflows(name)')
    .eq('template_key', params.key)
    .eq('active', true)

  if (usedBy && usedBy.length > 0) {
    const names = usedBy.map((s: any) => `"${s.workflows?.name || '?'}" (стъпка ${s.step_number})`).join(', ')
    return NextResponse.json(
      { error: `Темплейтът се ползва в: ${names}. Премахни/смени стъпката там първо.` },
      { status: 409 }
    )
  }

  const { error } = await supabaseAdmin
    .from('email_templates')
    .delete()
    .eq('template_key', params.key)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
