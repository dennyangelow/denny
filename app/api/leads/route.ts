// app/api/leads/route.ts — v10 FIXED
// Оправено:
//  1. phoneNumber се праща в стандартното поле (не custom field)
//  2. Таг 'naruchnik' се добавя с отделен POST /contacts/{id}/tags след създаване
//  3. При 409 вече се ъпдейтват данните правилно с PATCH + merge-patch+json
//  4. Retry логика при 429

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'
import { rateLimit, getIP } from '@/lib/rate-limit'
import { welcomeEmail } from '@/lib/email-templates'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Systeme.io helpers ────────────────────────────────────────────────────────

async function addTag(apiKey: string, contactId: string, tagName: string): Promise<void> {
  await fetch(`https://api.systeme.io/api/contacts/${contactId}/tags`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body:    JSON.stringify({ name: tagName }),
  })
  // 409 = вече има тага → ок, игнорираме
}

async function patchContactData(
  apiKey: string,
  contactId: string,
  firstName: string,
  lastName: string,
  phone?: string | null
): Promise<void> {
  const body: Record<string, string> = { firstName, lastName }
  if (phone?.trim()) body.phoneNumber = phone.trim()

  await fetch(`https://api.systeme.io/api/contacts/${contactId}`, {
    method:  'PATCH',
    headers: {
      'Content-Type': 'application/merge-patch+json',
      'X-API-Key':    apiKey,
    },
    body: JSON.stringify(body),
  })
}

async function findContactByEmail(apiKey: string, email: string): Promise<string | null> {
  const res = await fetch(
    `https://api.systeme.io/api/contacts?email=${encodeURIComponent(email)}&limit=10`,
    { headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' } }
  )
  if (!res.ok) return null
  const json  = await res.json()
  const items = json.items || json['hydra:member'] || []
  const found = items.find((c: any) => c.email?.toLowerCase() === email.toLowerCase())
  return found?.id ? String(found.id) : null
}

/**
 * Синхронизира контакт в Systeme.io:
 * 1. Създава или намира контакта
 * 2. PATCH-ва firstName, lastName, phoneNumber
 * 3. Добавя таг 'naruchnik'
 */
async function syncToSystemeIO(data: {
  email:      string
  name?:      string | null
  phone?:     string | null
  contactId?: string | null
}): Promise<{ ok: boolean; contactId?: string; error?: string }> {
  const apiKey = process.env.systemeio_api
  if (!apiKey) return { ok: false, error: 'systemeio_api не е зададен' }

  const parts     = (data.name || '').trim().split(/\s+/)
  const firstName = parts[0] || ''
  const lastName  = parts.slice(1).join(' ') || ''
  const phone     = data.phone?.trim() || undefined
  const TAG       = 'naruchnik'

  let contactId: string | null = data.contactId || null

  // Проверяваме съществуващ contact_id
  if (contactId) {
    const checkRes = await fetch(`https://api.systeme.io/api/contacts/${contactId}`, {
      method:  'GET',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    })
    if (!checkRes.ok) {
      if (checkRes.status === 404) contactId = null // изтрит → пресъздаваме
      else {
        const t = await checkRes.text()
        return { ok: false, error: `GET ${checkRes.status}: ${t.slice(0, 200)}` }
      }
    }
  }

  // Създаваме нов контакт
  if (!contactId) {
    const postBody: Record<string, string> = { email: data.email, firstName, lastName }
    if (phone) postBody.phoneNumber = phone

    const postRes = await fetch('https://api.systeme.io/api/contacts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body:    JSON.stringify(postBody),
    })

    if (postRes.ok) {
      const json = await postRes.json()
      contactId  = String(json.id)
    } else if (postRes.status === 409) {
      // Вече съществува → намираме ID
      contactId = await findContactByEmail(apiKey, data.email)
    } else if (postRes.status === 429) {
      await sleep(2000)
      const retry = await fetch('https://api.systeme.io/api/contacts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body:    JSON.stringify(postBody),
      })
      if (retry.ok)               { const j = await retry.json(); contactId = String(j.id) }
      else if (retry.status === 409) { contactId = await findContactByEmail(apiKey, data.email) }
      else { return { ok: false, error: `Rate limit + retry failed: ${retry.status}` } }
    } else {
      const text = await postRes.text()
      return { ok: false, error: `POST ${postRes.status}: ${text.slice(0, 300)}` }
    }
  }

  // Ако и след всичко нямаме ID → контактът е в Systeme.io, просто не го взехме
  if (!contactId) {
    console.warn('[Systeme.io] Контактът съществува но не успяхме да вземем ID за:', data.email)
    return { ok: true } // не е грешка — контактът е там
  }

  // Ъпдейтваме данните + добавяме таг
  await patchContactData(apiKey, contactId, firstName, lastName, phone)
  await addTag(apiKey, contactId, TAG)

  return { ok: true, contactId }
}

async function syncWithRetry(
  data: Parameters<typeof syncToSystemeIO>[0],
  retries = 2
): Promise<{ ok: boolean; contactId?: string; error?: string }> {
  for (let i = 0; i <= retries; i++) {
    const result = await syncToSystemeIO(data)
    if (result.ok) return result
    if (i < retries) await sleep(600 * (i + 1))
  }
  return { ok: false, error: 'Max retries exceeded' }
}

// ── POST /api/leads ───────────────────────────────────────────────────────────

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
      return NextResponse.json({ error: 'Невалиден имейл' }, { status: 400 })
    }

    const slug       = naruchnik_slug || 'super-domati'
    const now        = new Date().toISOString()
    const cleanEmail = email.toLowerCase().trim()
    const cleanName  = name?.trim()  || null
    const cleanPhone = phone?.trim() || null

    // ── Feature flags ───────────────────────────────────────────────────────
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

    // ── Supabase upsert ──────────────────────────────────────────────────────
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .upsert(
        {
          email:              cleanEmail,
          name:               cleanName,
          phone:              cleanPhone,
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

    // ── Resend ───────────────────────────────────────────────────────────────
    if (resendEnabled && process.env.RESEND_API_KEY) {
      const { subject, html } = welcomeEmail({ email: cleanEmail, name: cleanName ?? undefined, slug })
      await new Resend(process.env.RESEND_API_KEY).emails
        .send({ from: 'Denny Angelow <denny@dennyangelow.com>', to: cleanEmail, subject, html })
        .catch(err => console.error('[Resend]', err))
    }

    // ── Systeme.io ───────────────────────────────────────────────────────────
    let systemeioStatus: 'ok' | 'skipped' | 'error' = 'skipped'
    let systemeioError: string | undefined

    if (systemeioEnabled) {
      const { data: existing } = await supabaseAdmin
        .from('leads')
        .select('systemeio_contact_id')
        .eq('email', cleanEmail)
        .single()

      const result = await syncWithRetry({
        email:     cleanEmail,
        name:      cleanName,
        phone:     cleanPhone,
        contactId: existing?.systemeio_contact_id || null,
      })

      systemeioStatus = result.ok ? 'ok' : 'error'
      systemeioError  = result.error

      if (result.ok) {
        await supabaseAdmin.from('leads').update({
          systemeio_synced:     true,
          systemeio_contact_id: result.contactId || existing?.systemeio_contact_id || null,
          systemeio_synced_at:  now,
          updated_at:           now,
        }).eq('email', cleanEmail)
      } else {
        console.error('[Systeme.io] FAIL:', result.error)
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

// ── GET /api/leads ────────────────────────────────────────────────────────────

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
