// app/api/leads/sync/route.ts — v3 FIXED
// Оправено:
//  1. formatPhone() → E.164 (+359...) за стандартното Phone number поле
//  2. splitName() → firstName/lastName винаги се изпращат
//  3. PATCH с изчакване след POST (Systeme.io понякога е бавен)
//  4. addTag след пауза — по-надеждно
//  5. По-добро логване на грешки

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const API_KEY = () => process.env.systemeio_api || ''
const sleep   = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Phone formatter ───────────────────────────────────────────────────────────
function formatPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined
  const digits = phone.replace(/[\s\-().+]/g, '')
  if (!digits) return undefined
  if (digits.startsWith('359')) return `+${digits}`
  if (digits.startsWith('0'))   return `+359${digits.slice(1)}`
  if (digits.length >= 9)       return `+359${digits}`
  return undefined
}

// ── Name splitter ─────────────────────────────────────────────────────────────
function splitName(name?: string | null): { firstName: string; lastName: string } {
  const parts     = (name || '').trim().split(/\s+/).filter(Boolean)
  const firstName = parts[0] || ''
  const lastName  = parts.slice(1).join(' ') || ''
  return { firstName, lastName }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function patchContact(
  contactId: string,
  firstName: string,
  lastName: string,
  phone?: string
): Promise<boolean> {
  const body: Record<string, string> = {}
  if (firstName) body.firstName = firstName
  if (lastName)  body.lastName  = lastName
  if (phone)     body.phoneNumber = phone

  if (Object.keys(body).length === 0) return true

  const res = await fetch(`https://api.systeme.io/api/contacts/${contactId}`, {
    method:  'PATCH',
    headers: {
      'Content-Type': 'application/merge-patch+json',
      'X-API-Key':    API_KEY(),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const t = await res.text()
    console.warn(`[patchContact] ${res.status}:`, t.slice(0, 200))
  }
  return res.ok
}

async function addTag(contactId: string, tagName: string): Promise<boolean> {
  const res = await fetch(`https://api.systeme.io/api/contacts/${contactId}/tags`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key':    API_KEY(),
    },
    body: JSON.stringify({ name: tagName }),
  })
  return res.ok || res.status === 409
}

async function findContactByEmail(email: string): Promise<string | null> {
  const res = await fetch(
    `https://api.systeme.io/api/contacts?email=${encodeURIComponent(email)}&limit=10`,
    { headers: { 'X-API-Key': API_KEY(), 'Content-Type': 'application/json' } }
  )
  if (!res.ok) return null
  const json    = await res.json()
  const items   = json.items || json['hydra:member'] || []
  const contact = items.find((c: any) => c.email?.toLowerCase() === email.toLowerCase())
  return contact?.id ? String(contact.id) : null
}

async function syncOne(lead: {
  id:                    string
  email:                 string
  name?:                 string | null
  phone?:                string | null
  systemeio_contact_id?: string | null
}): Promise<{ id: string; email: string; ok: boolean; contactId?: string; error?: string }> {
  const TAG                     = 'naruchnik'
  const { firstName, lastName } = splitName(lead.name)
  const phone                   = formatPhone(lead.phone)

  let contactId: string | null = lead.systemeio_contact_id || null

  // ── Стъпка 1: Намери или създай контакт ────────────────────────────────────
  if (contactId) {
    const checkRes = await fetch(`https://api.systeme.io/api/contacts/${contactId}`, {
      method:  'GET',
      headers: { 'X-API-Key': API_KEY(), 'Content-Type': 'application/json' },
    })
    if (!checkRes.ok) {
      if (checkRes.status === 404) {
        contactId = null
      } else {
        const t = await checkRes.text()
        return { id: lead.id, email: lead.email, ok: false, error: `GET ${checkRes.status}: ${t.slice(0, 150)}` }
      }
    }
  }

  if (!contactId) {
    const postBody: Record<string, string> = { email: lead.email }
    if (firstName) postBody.firstName   = firstName
    if (lastName)  postBody.lastName    = lastName
    if (phone)     postBody.phoneNumber = phone

    const postRes = await fetch('https://api.systeme.io/api/contacts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY() },
      body:    JSON.stringify(postBody),
    })

    if (postRes.ok) {
      const json = await postRes.json()
      contactId  = String(json.id)
    } else if (postRes.status === 409) {
      contactId = await findContactByEmail(lead.email)
      if (!contactId) {
        // Контактът е в Systeme.io, само не можем да взем ID-то
        // Ще опитаме пак след малко
        await sleep(1000)
        contactId = await findContactByEmail(lead.email)
      }
    } else if (postRes.status === 429) {
      await sleep(2000)
      const retry = await fetch('https://api.systeme.io/api/contacts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY() },
        body:    JSON.stringify(postBody),
      })
      if (retry.ok) {
        const json = await retry.json()
        contactId  = String(json.id)
      } else if (retry.status === 409) {
        contactId = await findContactByEmail(lead.email)
      } else {
        const t = await retry.text()
        return { id: lead.id, email: lead.email, ok: false, error: `POST retry ${retry.status}: ${t.slice(0, 200)}` }
      }
    } else {
      const t = await postRes.text()
      return { id: lead.id, email: lead.email, ok: false, error: `POST ${postRes.status}: ${t.slice(0, 200)}` }
    }
  }

  if (!contactId) {
    return { id: lead.id, email: lead.email, ok: false, error: 'Не успяхме да намерим contactId след POST 409' }
  }

  // ── Стъпка 2: Изчакваме малко и ъпдейтваме данните ─────────────────────────
  await sleep(300)
  await patchContact(contactId, firstName, lastName, phone)

  // ── Стъпка 3: Добавяме таг ──────────────────────────────────────────────────
  await sleep(200)
  await addTag(contactId, TAG)

  return { id: lead.id, email: lead.email, ok: true, contactId }
}

// ── POST /api/leads/sync ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!API_KEY()) {
    return NextResponse.json({ error: 'systemeio_api не е зададен' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const syncAll  = searchParams.get('all') === 'true'
  const singleId = searchParams.get('id')
  const now      = new Date().toISOString()

  // ── Единичен sync (?id=UUID) ──────────────────────────────────────────────
  if (singleId) {
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .select('id, email, name, phone, systemeio_contact_id')
      .eq('id', singleId)
      .single()

    if (error || !lead) {
      return NextResponse.json({ error: 'Лийдът не е намерен' }, { status: 404 })
    }

    const result = await syncOne(lead)

    if (result.ok) {
      await supabaseAdmin.from('leads').update({
        systemeio_synced:     true,
        systemeio_contact_id: result.contactId || lead.systemeio_contact_id || undefined,
        systemeio_synced_at:  now,
        updated_at:           now,
      }).eq('id', lead.id)
      return NextResponse.json({ success: true, synced: 1, failed: 0 })
    } else {
      return NextResponse.json({
        success: false, synced: 0, failed: 1,
        errors: [result.error],
      })
    }
  }

  // ── Масов sync ────────────────────────────────────────────────────────────
  let query = supabaseAdmin
    .from('leads')
    .select('id, email, name, phone, systemeio_contact_id')
    .eq('subscribed', true)

  if (!syncAll) query = query.eq('systemeio_synced', false)

  const { data: leads, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!leads || leads.length === 0) {
    return NextResponse.json({
      success: true, synced: 0, total: 0,
      message: 'Всички лийдове са синхронизирани ✅',
    })
  }

  const BATCH = 3
  let synced   = 0
  const errors: string[] = []

  for (let i = 0; i < leads.length; i += BATCH) {
    const batch   = leads.slice(i, i + BATCH)
    const results = await Promise.all(batch.map((l: any) => syncOne(l)))

    for (const r of results) {
      if (r.ok) {
        synced++
        await supabaseAdmin.from('leads').update({
          systemeio_synced:     true,
          systemeio_contact_id: r.contactId || undefined,
          systemeio_synced_at:  now,
          updated_at:           now,
        }).eq('id', r.id)
      } else {
        errors.push(`${r.email}: ${r.error}`)
      }
    }

    if (i + BATCH < leads.length) await sleep(600)
  }

  return NextResponse.json({
    success: true,
    total:   leads.length,
    synced,
    failed:  errors.length,
    errors:  errors.length > 0 ? errors : undefined,
  })
}

// ── GET /api/leads/sync — статус ──────────────────────────────────────────────

export async function GET() {
  const { count: unsynced } = await supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('systemeio_synced', false)
    .eq('subscribed', true)

  const { count: total } = await supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('subscribed', true)

  return NextResponse.json({ unsynced: unsynced ?? 0, total: total ?? 0 })
}
