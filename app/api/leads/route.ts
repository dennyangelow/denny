// ФАЙЛ: app/api/leads/route.ts — v20
//
// ПОПРАВКИ v20 (спрямо v19):
//   ✅ Welcome имейлът вече минава през enrollAndRunFirstStep() (lib/
//      automations.ts) вместо директен sendEmail() тук. Докато workflow-a
//      "Naruchnik — Welcome серия" (виж migrations/001_workflows.sql) е
//      неактивен в базата — поведението е ИДЕНТИЧНО на v19 (fallback по-
//      долу праща старото welcomeEmail() директно). Активираш ли
//      workflow-а от Настройки → Автоматизации, автоматично минаваш на
//      конфигурируемата серия (welcome + followup 2/5/10), без нова
//      промяна тук.
//
// ПОПРАВКИ v19 (спрямо v18):
//   ✅ email_logs се пишеше БЕЗУСЛОВНО при всеки нов/обновен lead — сега
//      само СЛЕД успешен sendEmail() await.
//
// ПОПРАВКИ v18 (спрямо v17):
//   1. ПЪЛНО премахване на Systeme.io.
//   2. Изпращането минава през lib/mailer.ts (sendEmail) → Amazon SES.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, getIP } from '@/lib/rate-limit'
import { welcomeEmail } from '@/lib/email-templates'
import { sendEmail } from '@/lib/mailer'
import { serverValidate } from '@/lib/validation'
import { enrollAndRunFirstStep } from '@/lib/automations'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = rateLimit(`leads:${ip}`, { limit: 5, window: 600 })
  if (!rl.success) {
    return NextResponse.json(
      { error: `Твърде много заявки. Изчакай ${rl.resetIn} секунди.` },
      { status: 429, headers: { 'Retry-After': String(rl.resetIn) } }
    )
  }

  try {
    const body = await req.json()
    const { email, name, phone, source, utm_source, utm_campaign, utm_medium, naruchnik_slug } = body

    if (!email || !email.includes('@') || email.length > 255) {
      return NextResponse.json({ error: 'Невалиден имейл', field: 'email' }, { status: 400 })
    }

    const emailDomain = email.split('@')[1] || ''
    if (/[а-яА-ЯёЁ]/.test(emailDomain)) {
      return NextResponse.json({ error: 'Невалиден имейл адрес', field: 'email' }, { status: 400 })
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9\-_.]*\.[a-zA-Z]{2,}$/.test(emailDomain)) {
      return NextResponse.json({ error: 'Невалиден имейл адрес', field: 'email' }, { status: 400 })
    }

    if (phone && /[а-яёА-ЯЁa-zA-Z]/.test(phone)) {
      return NextResponse.json({ error: 'Телефонът трябва да съдържа само цифри', field: 'phone' }, { status: 400 })
    }

    const validation = serverValidate({ email, name, phone })
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error, field: validation.field }, { status: 400 })
    }

    const slug       = naruchnik_slug || 'super-domati'
    const now        = new Date().toISOString()
    const cleanEmail = email.toLowerCase().trim()
    const cleanName  = name?.trim()  || null
    const cleanPhone = phone?.trim() || null

    // ── Глобален toggle за изпращане (settings таблица) ───────────────────────
    let emailSendingEnabled = true
    try {
      const { data: row } = await supabaseAdmin
        .from('settings').select('value')
        .eq('key', 'resend_enabled')
        .single()
      if (row) emailSendingEnabled = row.value !== 'false'
    } catch { /* default: enabled */ }

    const { data: existingLead } = await supabaseAdmin
      .from('leads')
      .select('id, name, phone')
      .eq('email', cleanEmail)
      .single()

    const upsertName  = cleanName  || existingLead?.name  || null
    const upsertPhone = cleanPhone || existingLead?.phone || null

    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .upsert(
        {
          email:              cleanEmail,
          name:               upsertName,
          phone:              upsertPhone,
          source:             source || 'naruchnik',
          naruchnik_slug:     slug,
          utm_source:         utm_source   || null,
          utm_medium:         utm_medium   || null,
          utm_campaign:       utm_campaign || null,
          downloaded_at:      now,
          subscribed:         true,
          last_email_sent_at: now,
          updated_at:         now,
        },
        { onConflict: 'email', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (error && error.code !== '23505') throw error

    if (lead) {
      await supabaseAdmin
        .rpc('add_naruchnik', { p_email: cleanEmail, p_slug: slug })
        .throwOnError()
    }

    if (emailSendingEnabled && lead) {
      // ✅ enrollAndRunFirstStep проверява дали има АКТИВЕН workflow за
      //    'naruchnik_download' — ако да, записва lead-а и праща стъпка 1
      //    (welcome) веднага синхронно тук, следващите стъпки поема
      //    hourly tick-а (виж app/api/automations/tick/route.ts).
      try {
        await enrollAndRunFirstStep('naruchnik_download', lead.id, { naruchnik_slug: slug })
      } catch (err) {
        console.error('[automations] enrollAndRunFirstStep failed:', err)
      }

      // ── Fallback — старото директно изпращане, само ако workflow-ът
      //    НЕ е активиран. Премахни целия този блок, щом активираш
      //    workflow-а трайно от Настройки → Автоматизации.
      const { count: activeWorkflowCount } = await supabaseAdmin
        .from('workflows')
        .select('id', { count: 'exact', head: true })
        .eq('trigger_type', 'naruchnik_download')
        .eq('active', true)

      if (!activeWorkflowCount) {
        const { subject, html } = welcomeEmail({ email: cleanEmail, name: upsertName ?? undefined, slug })
        try {
          await sendEmail({ to: cleanEmail, subject, html })
          await supabaseAdmin.from('email_logs').insert({
            lead_id: lead.id, sequence_name: 'naruchnik', step_number: 1, sent_at: now,
          })
        } catch (err) {
          console.error('[sendEmail welcome fallback]', err)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[leads] Fatal:', error)
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page       = Math.max(1, parseInt(searchParams.get('page')  || '1'))
  const limit      = Math.min(1000, parseInt(searchParams.get('limit') || '500'))
  const subscribed = searchParams.get('subscribed')

  let query = supabaseAdmin
    .from('leads').select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (subscribed !== null) query = query.eq('subscribed', subscribed === 'true')

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leads: data, total: count })
}
