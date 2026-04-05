// app/api/leads/route.ts — v5 със Systeme.io sync

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'
import { rateLimit, getIP } from '@/lib/rate-limit'
import { welcomeEmail } from '@/lib/email-templates'

// ── Systeme.io helper ──────────────────────────────────────────────────────
async function syncToSystemeIO(data: {
  email: string
  name?: string | null
  phone?: string | null
  slug?: string
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.SYSTEMEIO_API_KEY
  if (!apiKey) return { ok: false, error: 'SYSTEMEIO_API_KEY не е настроен' }

  try {
    // Systeme.io разделя firstName / lastName
    const nameParts  = (data.name || '').trim().split(/\s+/)
    const firstName  = nameParts[0] || ''
    const lastName   = nameParts.slice(1).join(' ') || ''

    const payload: Record<string, unknown> = {
      email: data.email,
      firstName,
      lastName,
      fields: [] as { slug: string; value: string }[],
    }

    if (data.phone) {
      (payload.fields as { slug: string; value: string }[]).push(
        { slug: 'phone', value: data.phone }
      )
    }
    if (data.slug) {
      (payload.fields as { slug: string; value: string }[]).push(
        { slug: 'source', value: data.slug }
      )
    }

    const res = await fetch('https://api.systeme.io/api/contacts', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key':     apiKey,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `Systeme.io ${res.status}: ${text}` }
    }

    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

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
    const { email, name, phone, source, utm_source, utm_campaign, naruchnik_slug } = body

    if (!email || !email.includes('@') || email.length > 255) {
      return NextResponse.json({ error: 'Невалиден имейл' }, { status: 400 })
    }

    const slug        = naruchnik_slug || 'super-domati'
    const now         = new Date().toISOString()
    const cleanEmail  = email.toLowerCase().trim()
    const cleanName   = name?.trim() || null
    const cleanPhone  = phone?.trim() || null

    // ── Стъпка 1: Вземи настройките (resend_enabled, systemeio_enabled) ────
    let resendEnabled    = true  // default ON
    let systemeioEnabled = true  // default ON

    try {
      const { data: settingsRows } = await supabaseAdmin
        .from('settings')
        .select('key, value')
        .in('key', ['resend_enabled', 'systemeio_enabled'])

      for (const row of settingsRows || []) {
        if (row.key === 'resend_enabled')    resendEnabled    = row.value !== 'false'
        if (row.key === 'systemeio_enabled') systemeioEnabled = row.value !== 'false'
      }
    } catch {
      // Ако settings таблицата не отговори — продължаваме с defaults
    }

    // ── Стъпка 2: Upsert в Supabase leads ─────────────────────────────────
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .upsert(
        {
          email:          cleanEmail,
          name:           cleanName,
          phone:          cleanPhone,
          source:         source || 'naruchnik',
          naruchnik_slug: slug,
          utm_source:     utm_source || null,
          utm_campaign:   utm_campaign || null,
          downloaded_at:  now,
          subscribed:     true,
          last_email_sent_at: now,
          updated_at:     now,
        },
        { onConflict: 'email', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (error && error.code !== '23505') throw error

    // ── Стъпка 3: Добави slug към naruchnici[] масива ──────────────────────
    if (lead) {
      await supabaseAdmin.rpc('add_naruchnik', {
        p_email: cleanEmail,
        p_slug:  slug,
      }).throwOnError()
    }

    // ── Стъпка 4: Email log ────────────────────────────────────────────────
    if (lead) {
      try {
        await supabaseAdmin.from('email_logs').insert({
          lead_id:       lead.id,
          sequence_name: 'naruchnik',
          step_number:   1,
          sent_at:       now,
        })
      } catch (logError) {
        console.warn('Email log failed, but continuing...', logError)
      }
    }

    // ── Стъпка 5: Resend welcome имейл ────────────────────────────────────
    if (resendEnabled) {
      const apiKey = process.env.RESEND_API_KEY
      if (apiKey) {
        const resend = new Resend(apiKey)
        const { subject, html } = welcomeEmail({
          email: cleanEmail,
          name:  cleanName ?? undefined,
          slug,
        })
        await resend.emails.send({
          from:    'Denny Angelow <denny@dennyangelow.com>',
          to:      cleanEmail,
          subject,
          html,
        }).catch(err => console.error('Resend error:', err))
      } else {
        console.warn('RESEND_API_KEY не е настроен')
      }
    }

    // ── Стъпка 6: Sync към Systeme.io ─────────────────────────────────────
    let systemeioStatus: 'ok' | 'skipped' | 'error' = 'skipped'
    let systemeioError: string | undefined

    if (systemeioEnabled) {
      const result = await syncToSystemeIO({
        email: cleanEmail,
        name:  cleanName,
        phone: cleanPhone,
        slug,
      })
      systemeioStatus = result.ok ? 'ok' : 'error'
      systemeioError  = result.error
      if (!result.ok) {
        // Само логваме — НЕ блокираме успешния отговор
        console.error('Systeme.io sync failed:', result.error)
      }
    }

    return NextResponse.json({
      success: true,
      systemeio: systemeioStatus,
      ...(systemeioError ? { systemeioError } : {}),
    })
  } catch (error: any) {
    console.error('Lead error:', error)
    return NextResponse.json(
      { error: error?.message || error?.code || String(error) },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page       = Math.max(1, parseInt(searchParams.get('page')  || '1'))
  const limit      = Math.min(1000, parseInt(searchParams.get('limit') || '500'))
  const tag        = searchParams.get('tag')
  const subscribed = searchParams.get('subscribed')

  let query = supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (tag)             query = query.contains('tags', [tag])
  if (subscribed !== null) query = query.eq('subscribed', subscribed === 'true')

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leads: data, total: count })
}
