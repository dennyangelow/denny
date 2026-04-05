// app/api/leads/route.ts — v7

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'
import { rateLimit, getIP } from '@/lib/rate-limit'
import { welcomeEmail } from '@/lib/email-templates'

// ── Systeme.io ──────────────────────────────────────────────────────────────
async function syncToSystemeIO(data: {
  email: string
  name?: string | null
  phone?: string | null
  slug?: string
}): Promise<{ ok: boolean; error?: string; status?: number }> {
  const apiKey = process.env.systemeio_api

  if (!apiKey) {
    console.error('[Systeme.io] systemeio_api не е зададен в Environment Variables')
    return { ok: false, error: 'systemeio_api липсва в env vars' }
  }

  const nameParts = (data.name || '').trim().split(/\s+/)
  const firstName = nameParts[0] || ''
  const lastName  = nameParts.slice(1).join(' ') || ''
  const tags      = [{ name: 'naruchnik' }, ...(data.slug ? [{ name: data.slug }] : [])]
  const fields    = data.phone ? [{ slug: 'phone', value: data.phone }] : []

  const payload = { email: data.email, firstName, lastName, tags, fields }

  try {
    console.log('[Systeme.io] POST contact:', data.email)
    const res = await fetch('https://api.systeme.io/api/contacts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body:    JSON.stringify(payload),
    })
    console.log('[Systeme.io] Status:', res.status)

    if (res.ok) return { ok: true, status: res.status }

    if (res.status === 409) {
      // Контактът съществува → намери го и добави тага
      return patchExistingContact(apiKey, data.email, tags)
    }

    const text = await res.text()
    console.error('[Systeme.io] Error:', text.slice(0, 400))
    return { ok: false, status: res.status, error: `HTTP ${res.status}: ${text.slice(0, 300)}` }
  } catch (err: any) {
    console.error('[Systeme.io] Network error:', err.message)
    return { ok: false, error: err.message }
  }
}

async function patchExistingContact(
  apiKey: string,
  email: string,
  tags: { name: string }[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.systeme.io/api/contacts?email=${encodeURIComponent(email)}&limit=10`,
      { headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' } }
    )
    if (!res.ok) return { ok: false, error: `Search ${res.status}` }

    const json    = await res.json()
    const contact = (json.items || json['hydra:member'] || [])
      .find((c: any) => c.email?.toLowerCase() === email.toLowerCase())

    if (!contact?.id) return { ok: false, error: 'Контактът не е намерен след 409' }

    console.log('[Systeme.io] PATCH id:', contact.id)
    const patch = await fetch(`https://api.systeme.io/api/contacts/${contact.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/merge-patch+json', 'X-API-Key': apiKey },
      body:    JSON.stringify({ tags }),
    })
    if (patch.ok) return { ok: true }
    const t = await patch.text()
    return { ok: false, error: `PATCH ${patch.status}: ${t.slice(0, 200)}` }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

async function syncWithRetry(
  data: Parameters<typeof syncToSystemeIO>[0],
  retries = 2
): Promise<{ ok: boolean; error?: string }> {
  for (let i = 0; i <= retries; i++) {
    const result = await syncToSystemeIO(data)
    if (result.ok) return result
    if (result.status && [400, 401, 403].includes(result.status)) return result
    if (i < retries) await new Promise(r => setTimeout(r, 600 * (i + 1)))
  }
  return { ok: false, error: 'Max retries' }
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

    const slug       = naruchnik_slug || 'super-domati'
    const now        = new Date().toISOString()
    const cleanEmail = email.toLowerCase().trim()
    const cleanName  = name?.trim() || null
    const cleanPhone = phone?.trim() || null

    console.log('[leads] Нова заявка:', cleanEmail, '| slug:', slug)

    // ── Настройки ──────────────────────────────────────────────────────────
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

    // ── Supabase upsert ────────────────────────────────────────────────────
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .upsert(
        {
          email: cleanEmail, name: cleanName, phone: cleanPhone,
          source: source || 'naruchnik', naruchnik_slug: slug,
          utm_source: utm_source || null, utm_campaign: utm_campaign || null,
          downloaded_at: now, subscribed: true,
          last_email_sent_at: now, updated_at: now,
        },
        { onConflict: 'email', ignoreDuplicates: false }
      )
      .select().single()

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

    // ── Resend ─────────────────────────────────────────────────────────────
    if (resendEnabled && process.env.RESEND_API_KEY) {
      const { subject, html } = welcomeEmail({ email: cleanEmail, name: cleanName ?? undefined, slug })
      await new Resend(process.env.RESEND_API_KEY).emails
        .send({ from: 'Denny Angelow <denny@dennyangelow.com>', to: cleanEmail, subject, html })
        .catch(err => console.error('[Resend]', err))
    }

    // ── Systeme.io ─────────────────────────────────────────────────────────
    let systemeioStatus: 'ok' | 'skipped' | 'error' = 'skipped'
    let systemeioError: string | undefined

    if (systemeioEnabled) {
      const result = await syncWithRetry({ email: cleanEmail, name: cleanName, phone: cleanPhone, slug })
      systemeioStatus = result.ok ? 'ok' : 'error'
      systemeioError  = result.error

      if (!result.ok) {
        console.error('[Systeme.io] FAIL:', result.error)
        try {
          await supabaseAdmin.from('settings').upsert(
            { key: 'systemeio_last_error', value: `${now} | ${cleanEmail} | ${result.error}`, updated_at: now },
            { onConflict: 'key' }
          )
        } catch { /* silent */ }
      } else {
        console.log('[Systeme.io] OK:', cleanEmail)
      }
    }

    return NextResponse.json({ success: true, systemeio: systemeioStatus, ...(systemeioError ? { systemeioError } : {}) })
  } catch (error: any) {
    console.error('[leads] Fatal:', error)
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page       = Math.max(1, parseInt(searchParams.get('page')  || '1'))
  const limit      = Math.min(1000, parseInt(searchParams.get('limit') || '500'))
  const tag        = searchParams.get('tag')
  const subscribed = searchParams.get('subscribed')

  let query = supabaseAdmin
    .from('leads').select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (tag)             query = query.contains('tags', [tag])
  if (subscribed !== null) query = query.eq('subscribed', subscribed === 'true')

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leads: data, total: count })
}
