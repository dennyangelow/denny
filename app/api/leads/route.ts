// ФАЙЛ: app/api/leads/route.ts — v18
//
// ПОПРАВКИ v18 (спрямо v17):
//   1. ПЪЛНО премахване на Systeme.io — вече няма syncContactWithRetry,
//      systemeio_api env var, systemeio_enabled setting, нито
//      systemeio_* колони се пипат при insert/update тук.
//   2. Изпращането минава през lib/mailer.ts (sendEmail) вместо директно
//      през Resend SDK — sendEmail() ползва Amazon SES отдолу.
//   3. Всичко останало от v17 (валидация, rate limit, upsert логика)
//      е запазено непроменено.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, getIP } from '@/lib/rate-limit'
import { welcomeEmail } from '@/lib/email-templates'
import { sendEmail } from '@/lib/mailer'
import { serverValidate } from '@/lib/validation'

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

    // ── Основна проверка ──────────────────────────────────────────────────────
    if (!email || !email.includes('@') || email.length > 255) {
      return NextResponse.json({ error: 'Невалиден имейл', field: 'email' }, { status: 400 })
    }

    // ── Директна защита — кирилски домейн ─────────────────────────────────────
    const emailDomain = email.split('@')[1] || ''
    if (/[а-яА-ЯёЁ]/.test(emailDomain)) {
      return NextResponse.json({ error: 'Невалиден имейл адрес', field: 'email' }, { status: 400 })
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9\-_.]*\.[a-zA-Z]{2,}$/.test(emailDomain)) {
      return NextResponse.json({ error: 'Невалиден имейл адрес', field: 'email' }, { status: 400 })
    }

    // ── Директна защита — букви в телефон ─────────────────────────────────────
    if (phone && /[а-яёА-ЯЁa-zA-Z]/.test(phone)) {
      return NextResponse.json({ error: 'Телефонът трябва да съдържа само цифри', field: 'phone' }, { status: 400 })
    }

    // ── Разширена сървърна валидация ──────────────────────────────────────────
    const validation = serverValidate({ email, name, phone })
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error, field: validation.field },
        { status: 400 }
      )
    }

    const slug       = naruchnik_slug || 'super-domati'
    const now        = new Date().toISOString()
    const cleanEmail = email.toLowerCase().trim()
    const cleanName  = name?.trim()  || null
    const cleanPhone = phone?.trim() || null

    // ── Глобален toggle за изпращане (settings таблица) ───────────────────────
    // Ключът е останал 'resend_enabled' по историческа причина, но сега
    // управлява изпращането като цяло (през SES), не конкретно Resend.
    let emailSendingEnabled = true
    try {
      const { data: row } = await supabaseAdmin
        .from('settings').select('value')
        .eq('key', 'resend_enabled')
        .single()
      if (row) emailSendingEnabled = row.value !== 'false'
    } catch { /* default: enabled */ }

    // ── Взимаме съществуващия запис ПРЕДИ upsert ──────────────────────────────
    const { data: existingLead } = await supabaseAdmin
      .from('leads')
      .select('id, name, phone')
      .eq('email', cleanEmail)
      .single()

    const upsertName  = cleanName  || existingLead?.name  || null
    const upsertPhone = cleanPhone || existingLead?.phone || null

    // Upsert — при конфликт на email обновяваме данните
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
      try {
        await supabaseAdmin.from('email_logs').insert({
          lead_id: lead.id, sequence_name: 'naruchnik', step_number: 1, sent_at: now,
        })
      } catch { /* non-critical */ }
    }

    if (emailSendingEnabled) {
      const { subject, html } = welcomeEmail({ email: cleanEmail, name: upsertName ?? undefined, slug })
      await sendEmail({ to: cleanEmail, subject, html })
        .catch(err => console.error('[sendEmail welcome]', err))
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
