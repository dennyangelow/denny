// ФАЙЛ: app/api/leads/route.ts — v17
//
// ПОПРАВКИ v17 (спрямо v16):
//   1. Сървърна валидация чрез lib/validation.ts (serverValidate)
//      - Блокира disposable имейли (mailinator, yopmail, tempmail и др.)
//      - Блокира очевидно фалшиви имейли (test@, aaa@, 1234@...)
//      - Валидира BG телефон формат ако е подаден
//      - Валидира имена ако са подадени
//      - Връща { error, field } с HTTP 400 → frontend показва грешката inline
//   2. Всичко от v16 е запазено непроменено

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'
import { rateLimit, getIP } from '@/lib/rate-limit'
import { welcomeEmail } from '@/lib/email-templates'
import { syncContactWithRetry } from '@/lib/systemeio'
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

    // ── Разширена сървърна валидация ──────────────────────────────────────────
    // Хваща disposable домейни, фалшиви patterns, невалидни телефони
    // Работи независимо от frontend — последна линия на защита
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

    let resendEnabled    = true
    let systemeioEnabled = true
    try {
      const { data: rows } = await supabaseAdmin
        .from('settings').select('key, value')
        .in('key', ['resend_enabled', 'systemeio_enabled'])
      for (const row of rows || []) {
        if (row.key === 'resend_enabled')    resendEnabled    = row.value !== 'false'
        if (row.key === 'systemeio_enabled') systemeioEnabled = row.value !== 'false'
      }
    } catch { /* defaults */ }

    // ── Взимаме съществуващия запис ПРЕДИ upsert ──────────────────────────────
    // Целта: да не презаписваме name/phone с null ако вече имат стойност
    const { data: existingLead } = await supabaseAdmin
      .from('leads')
      .select('id, name, phone, systemeio_contact_id, systemeio_email_invalid')
      .eq('email', cleanEmail)
      .single()

    // При upsert: пазим съществуващото name/phone ако новото е null
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

    if (resendEnabled && process.env.RESEND_API_KEY) {
      const { subject, html } = welcomeEmail({ email: cleanEmail, name: upsertName ?? undefined, slug })
      await new Resend(process.env.RESEND_API_KEY).emails
        .send({ from: 'Denny Angelow <denny@dennyangelow.com>', to: cleanEmail, subject, html })
        .catch(err => console.error('[Resend]', err))
    }

    let systemeioStatus: 'ok' | 'skipped' | 'error' | 'invalid_email' = 'skipped'
    let systemeioError: string | undefined

    const apiKey = process.env.systemeio_api
    if (systemeioEnabled && apiKey) {
      const currentContactId = existingLead?.systemeio_contact_id || null
      const isEmailInvalid   = existingLead?.systemeio_email_invalid || false

      if (isEmailInvalid) {
        systemeioStatus = 'invalid_email'
      } else {
        const result = await syncContactWithRetry({
          apiKey,
          email:         cleanEmail,
          name:          upsertName,
          phone:         upsertPhone,
          contactId:     currentContactId,
          naruchnikSlug: slug,
        })

        if (result.ok) {
          systemeioStatus = 'ok'
          await supabaseAdmin.from('leads').update({
            systemeio_synced:        true,
            systemeio_email_invalid: false,
            systemeio_contact_id:    result.contactId || currentContactId || null,
            systemeio_synced_at:     now,
            updated_at:              now,
          }).eq('email', cleanEmail)
        } else if (result.emailInvalid) {
          systemeioStatus = 'invalid_email'
          systemeioError  = result.error
          await supabaseAdmin.from('leads').update({
            systemeio_synced:        false,
            systemeio_email_invalid: true,
            updated_at:              now,
          }).eq('email', cleanEmail)
        } else {
          systemeioStatus = 'error'
          systemeioError  = result.error
          console.error('[leads] Systeme.io FAIL:', result.error)
          await supabaseAdmin.from('leads').update({
            systemeio_synced: false,
            updated_at:       now,
          }).eq('email', cleanEmail)
          try {
            await supabaseAdmin.from('settings').upsert(
              { key: 'systemeio_last_error', value: `${now} | ${cleanEmail} | ${result.error}`, updated_at: now },
              { onConflict: 'key' }
            )
          } catch { /* silent */ }
        }
      }
    }

    return NextResponse.json({
      success: true,
      systemeio: systemeioStatus,
      ...(systemeioError ? { systemeioError } : {}),
    })
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
  const synced     = searchParams.get('synced')

  let query = supabaseAdmin
    .from('leads').select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (subscribed !== null) query = query.eq('subscribed', subscribed === 'true')
  if (synced     !== null) query = query.eq('systemeio_synced', synced === 'true')

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leads: data, total: count })
}
