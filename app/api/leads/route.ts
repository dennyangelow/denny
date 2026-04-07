// app/api/leads/route.ts — v11 FIXED
// Оправено:
//  1. formatPhone() → конвертира 08X в +3598X (E.164) за Systeme.io стандартното поле
//  2. splitName() → гарантира firstName/lastName дори при 1 дума
//  3. PATCH firstName/lastName работи правилно — добавен GET преди PATCH за refresh
//  4. Премахнат custom field "naruchnici" — tagove само чрез /tags endpoint
//  5. Retry логика при 429

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'
import { rateLimit, getIP } from '@/lib/rate-limit'
import { welcomeEmail } from '@/lib/email-templates'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Phone formatter ───────────────────────────────────────────────────────────
/**
 * Конвертира български телефон в E.164 формат за Systeme.io.
 * 0898123456  → +359898123456
 * +359...     → без промяна
 * празен/null → undefined
 */
function formatPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined
  const digits = phone.replace(/[\s\-().+]/g, '')
  if (!digits) return undefined
  if (digits.startsWith('359')) return `+${digits}`
  if (digits.startsWith('0'))   return `+359${digits.slice(1)}`
  if (digits.length >= 9)       return `+359${digits}`
  return undefined // твърде кратко — пропускаме
}

// ── Name splitter ─────────────────────────────────────────────────────────────
function splitName(name?: string | null): { firstName: string; lastName: string } {
  const parts     = (name || '').trim().split(/\s+/).filter(Boolean)
  const firstName = parts[0] || ''
  const lastName  = parts.slice(1).join(' ') || ''
  return { firstName, lastName }
}

// ── Systeme.io helpers ────────────────────────────────────────────────────────

async function addTag(apiKey: string, contactId: string, tagName: string): Promise<void> {
  const res = await fetch(`https://api.systeme.io/api/contacts/${contactId}/tags`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body:    JSON.stringify({ name: tagName }),
  })
  if (!res.ok && res.status !== 409) {
    const t = await res.text()
    console.warn(`[Systeme.io] addTag ${res.status}:`, t.slice(0, 200))
  }
}

async function patchContactData(
  apiKey: string,
  contactId: string,
  firstName: string,
  lastName: string,
  phone?: string
): Promise<void> {
  const body: Record<string, string> = {}

  // firstName и lastName — изпращаме само ако не са празни
  if (firstName) body.firstName = firstName
  if (lastName)  body.lastName  = lastName

  // phoneNumber — само ако е валиден E.164 формат
  if (phone) body.phoneNumber = phone

  if (Object.keys(body).length === 0) return

  const res = await fetch(`https://api.systeme.io/api/contacts/${contactId}`, {
    method:  'PATCH',
    headers: {
      'Content-Type': 'application/merge-patch+json',
      'X-API-Key':    apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const t = await res.text()
    console.warn(`[Systeme.io] PATCH ${res.status}:`, t.slice(0, 300))
  }
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
 * 2. PATCH-ва firstName, lastName, phoneNumber (E.164)
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

  const { firstName, lastName } = splitName(data.name)
  const phone                   = formatPhone(data.phone)
  const TAG                     = 'naruchnik'

  let contactId: string | null = data.contactId || null

  // Проверяваме съществуващ contact_id
  if (contactId) {
    const checkRes = await fetch(`https://api.systeme.io/api/contacts/${contactId}`, {
      method:  'GET',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    })
    if (!checkRes.ok) {
      if (checkRes.status === 404) contactId = null
      else {
        const t = await checkRes.text()
        return { ok: false, error: `GET ${checkRes.status}: ${t.slice(0, 200)}` }
      }
    }
  }

  // Създаваме нов контакт
  if (!contactId) {
    const postBody: Record<string, string> = { email: data.email }
    if (firstName) postBody.firstName = firstName
    if (lastName)  postBody.lastName  = lastName
    if (phone)     postBody.phoneNumber = phone

    const postRes = await fetch('https://api.systeme.io/api/contacts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body:    JSON.stringify(postBody),
    })

    if (postRes.ok) {
      const json = await postRes.json()
      contactId  = String(json.id)
    } else if (postRes.status === 409) {
      contactId = await findContactByEmail(apiKey, data.email)
    } else if (postRes.status === 429) {
      await sleep(2000)
      const retry = await fetch('https://api.systeme.io/api/contacts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body:    JSON.stringify(postBody),
      })
      if (retry.ok)                  { const j = await retry.json(); contactId = String(j.id) }
      else if (retry.status === 409) { contactId = await findContactByEmail(apiKey, data.email) }
      else { return { ok: false, error: `Rate limit + retry failed: ${retry.status}` } }
    } else {
      const text = await postRes.text()
      return { ok: false, error: `POST ${postRes.status}: ${text.slice(0, 300)}` }
    }
  }

  if (!contactId) {
    console.warn('[Systeme.io] Контактът съществува но не успяхме да вземем ID за:', data.email)
    return { ok: true }
  }

  // PATCH данните + таг (след малка пауза за да е сигурно записан)
  await sleep(300)
  await patchContactData(apiKey, contactId, firstName, lastName, phone)
  await sleep(200)
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
