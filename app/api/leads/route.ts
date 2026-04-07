// app/api/leads/route.ts — v9 (single tag edition)
// Systeme.io: само таг "naruchnik" — безплатен план
// Всичко останало (кой наръчник, кога) е в Supabase

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'
import { rateLimit, getIP } from '@/lib/rate-limit'
import { welcomeEmail } from '@/lib/email-templates'

// ── Systeme.io ────────────────────────────────────────────────────────────────

async function syncToSystemeIO(data: {
  email:     string
  name?:     string | null
  phone?:    string | null
  contactId?: string | null   // ако вече знаем ID-то → директно PATCH
}): Promise<{ ok: boolean; contactId?: string; error?: string }> {
  const apiKey = process.env.systemeio_api
  if (!apiKey) return { ok: false, error: 'systemeio_api не е зadadен' }

  const [firstName, ...rest] = (data.name || '').trim().split(/\s+/)
  const tags   = [{ name: 'naruchnik' }]  // само 1 таг — безплатен план
  const fields = data.phone ? [{ slug: 'phone', value: data.phone }] : []

  // Ако вече имаме contact_id → само PATCH (без POST)
  if (data.contactId) {
    const res = await fetch(`https://api.systeme.io/api/contacts/${data.contactId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/merge-patch+json', 'X-API-Key': apiKey },
      body:    JSON.stringify({ tags }),
    })
    if (res.ok) return { ok: true, contactId: data.contactId }
    // Ако е 404 → контактът е изтрит в Systeme.io, пресъздаваме го
    if (res.status !== 404) {
      const t = await res.text()
      return { ok: false, error: `PATCH ${res.status}: ${t.slice(0, 200)}` }
    }
    // fallthrough → ще се опита POST отдолу
  }

  // POST нов контакт
  const postRes = await fetch('https://api.systeme.io/api/contacts', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body:    JSON.stringify({
      email: data.email, firstName: firstName || '', lastName: rest.join(' ') || '',
      tags, fields,
    }),
  })

  if (postRes.ok) {
    const json = await postRes.json()
    return { ok: true, contactId: String(json.id) }
  }

  // 409 → контактът вече съществува → намираме ID
  if (postRes.status === 409) {
    const searchRes = await fetch(
      `https://api.systeme.io/api/contacts?email=${encodeURIComponent(data.email)}&limit=10`,
      { headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' } }
    )
    if (!searchRes.ok) return { ok: true } // вече е в Systeme.io, просто не взехме ID-то

    const json    = await searchRes.json()
    const contact = (json.items || json['hydra:member'] || [])
      .find((c: any) => c.email?.toLowerCase() === data.email.toLowerCase())

    // Контактът съществува — ok е, само нямаме ID-то
    return { ok: true, contactId: contact?.id ? String(contact.id) : undefined }
  }

  const text = await postRes.text()
  return { ok: false, error: `POST ${postRes.status}: ${text.slice(0, 300)}` }
}

async function syncWithRetry(
  data: Parameters<typeof syncToSystemeIO>[0],
  retries = 2
): Promise<{ ok: boolean; contactId?: string; error?: string }> {
  for (let i = 0; i <= retries; i++) {
    const result = await syncToSystemeIO(data)
    if (result.ok) return result
    if (i < retries) await new Promise(r => setTimeout(r, 600 * (i + 1)))
  }
  return { ok: false, error: 'Max retries exceeded' }
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
    const { email, name, phone, source, utm_source, utm_campaign, utm_medium, naruchnik_slug } = body

    if (!email || !email.includes('@') || email.length > 255) {
      return NextResponse.json({ error: 'Невалиден имейл' }, { status: 400 })
    }

    const slug       = naruchnik_slug || 'super-domati'
    const now        = new Date().toISOString()
    const cleanEmail = email.toLowerCase().trim()
    const cleanName  = name?.trim()  || null
    const cleanPhone = phone?.trim() || null

    // ── Feature flags ──────────────────────────────────────────────────────
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
      // Вземаме contact_id ако вече е синхронизиран преди
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
