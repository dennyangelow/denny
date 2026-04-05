// app/api/leads/route.ts — v6 с фиксиран Systeme.io sync

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
}): Promise<{ ok: boolean; error?: string; status?: number }> {
  // ФИКС: Чете и двата варианта на ключа — SYSTEMEIO_API_KEY или systemeio_api
  const apiKey =
    process.env.SYSTEMEIO_API_KEY ||
    process.env.systemeio_api ||
    process.env.SYSTEME_IO_API_KEY

  if (!apiKey) {
    return { ok: false, error: 'Systeme.io API ключ не е зададен. Добави SYSTEMEIO_API_KEY в Env Vars.' }
  }

  try {
    const nameParts = (data.name || '').trim().split(/\s+/)
    const firstName = nameParts[0] || ''
    const lastName  = nameParts.slice(1).join(' ') || ''

    // Systeme.io изисква tags като масив от обекти { name: string }
    const tags: { name: string }[] = []
    if (data.slug) tags.push({ name: data.slug })
    tags.push({ name: 'naruchnik' })

    const payload: Record<string, unknown> = {
      email:     data.email,
      firstName,
      lastName,
      tags,
      fields: [] as { slug: string; value: string }[],
    }

    if (data.phone) {
      ;(payload.fields as { slug: string; value: string }[]).push(
        { slug: 'phone', value: data.phone }
      )
    }

    // Опит 1: POST /api/contacts (създай или обнови)
    const res = await fetch('https://api.systeme.io/api/contacts', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key':    apiKey,
      },
      body: JSON.stringify(payload),
    })

    // 201 = създаден, 200 = обновен — и двете са успех
    if (res.ok) {
      return { ok: true, status: res.status }
    }

    // 409 Conflict = контактът вече съществува → опитай да добавиш тага
    if (res.status === 409) {
      const tagResult = await addTagToExistingContact(apiKey, data.email, tags)
      return tagResult
    }

    const text = await res.text()
    return {
      ok:     false,
      status: res.status,
      error:  `Systeme.io ${res.status}: ${text.slice(0, 300)}`,
    }
  } catch (err: any) {
    return { ok: false, error: `Network error: ${err.message}` }
  }
}

// Търси контакт по имейл и му добавя тагове
async function addTagToExistingContact(
  apiKey: string,
  email: string,
  tags: { name: string }[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Намери contact id
    const searchRes = await fetch(
      `https://api.systeme.io/api/contacts?email=${encodeURIComponent(email)}&limit=10`,
      {
        headers: {
          'X-API-Key':    apiKey,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!searchRes.ok) {
      const t = await searchRes.text()
      return { ok: false, error: `Search failed ${searchRes.status}: ${t.slice(0, 200)}` }
    }

    const searchData = await searchRes.json()
    // Systeme.io връща { 'hydra:member': [...] } или { items: [...] }
    const members = searchData['hydra:member'] || searchData.items || []
    const contact = members.find(
      (c: any) => c.email?.toLowerCase() === email.toLowerCase()
    )

    if (!contact?.id) {
      return { ok: false, error: `Контактът не е намерен след 409 за ${email}` }
    }

    // Добави таговете към съществуващия контакт
    const patchRes = await fetch(
      `https://api.systeme.io/api/contacts/${contact.id}`,
      {
        method:  'PATCH',
        headers: {
          'Content-Type': 'application/merge-patch+json',
          'X-API-Key':    apiKey,
        },
        body: JSON.stringify({ tags }),
      }
    )

    if (patchRes.ok) return { ok: true }

    const t = await patchRes.text()
    return { ok: false, error: `PATCH tags failed ${patchRes.status}: ${t.slice(0, 200)}` }
  } catch (err: any) {
    return { ok: false, error: `addTag error: ${err.message}` }
  }
}

// ── Retry wrapper ──────────────────────────────────────────────────────────
async function syncWithRetry(
  data: Parameters<typeof syncToSystemeIO>[0],
  retries = 2
): Promise<{ ok: boolean; error?: string }> {
  for (let i = 0; i <= retries; i++) {
    const result = await syncToSystemeIO(data)
    if (result.ok) return result
    // Не retry-вай при грешки в автентикация или невалидни данни
    if (result.status && [400, 401, 403].includes(result.status)) return result
    if (i < retries) await new Promise(r => setTimeout(r, 500 * (i + 1)))
  }
  return { ok: false, error: 'Max retries reached' }
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

    // ── Стъпка 1: Вземи настройките ───────────────────────────────────────
    let resendEnabled    = true
    let systemeioEnabled = true

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
      // Продължаваме с defaults ако settings таблицата не отговори
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
      await supabaseAdmin
        .rpc('add_naruchnik', { p_email: cleanEmail, p_slug: slug })
        .throwOnError()
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
        console.warn('Email log failed, continuing...', logError)
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
        await resend.emails
          .send({
            from:    'Denny Angelow <denny@dennyangelow.com>',
            to:      cleanEmail,
            subject,
            html,
          })
          .catch(err => console.error('Resend error:', err))
      } else {
        console.warn('RESEND_API_KEY не е настроен')
      }
    }

    // ── Стъпка 6: Sync към Systeme.io ─────────────────────────────────────
    let systemeioStatus: 'ok' | 'skipped' | 'error' = 'skipped'
    let systemeioError: string | undefined

    if (systemeioEnabled) {
      const result = await syncWithRetry({
        email: cleanEmail,
        name:  cleanName,
        phone: cleanPhone,
        slug,
      })
      systemeioStatus = result.ok ? 'ok' : 'error'
      systemeioError  = result.error

      if (!result.ok) {
        // Записваме грешката в Supabase за по-лесен дебъг от админа
        console.error('[Systeme.io] Sync failed for', cleanEmail, '—', result.error)
        try {
          await supabaseAdmin.from('settings').upsert(
            {
              key:        'systemeio_last_error',
              value:      `${new Date().toISOString()} | ${cleanEmail} | ${result.error}`,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'key' }
          )
        } catch {
          // silent
        }
      } else {
        console.log('[Systeme.io] Sync OK for', cleanEmail)
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
