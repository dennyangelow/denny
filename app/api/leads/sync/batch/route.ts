// app/api/leads/sync/batch/route.ts — v3 FIXED
// POST { ids: string[] } → синхронизира дадените ID-та (макс 10 наведнъж)
// Оправено: formatPhone E.164, splitName, PATCH пауза, addTag пауза

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
  if (firstName) body.firstName   = firstName
  if (lastName)  body.lastName    = lastName
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
    console.warn(`[batch/patchContact] ${res.status}:`, t.slice(0, 200))
  }
  return res.ok
}

async function addTag(contactId: string, tagName: string): Promise<boolean> {
  const res = await fetch(`https://api.systeme.io/api/contacts/${contactId}/tags`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY() },
    body:    JSON.stringify({ name: tagName }),
  })
  return res.ok || res.status === 409
}

async function findContactByEmail(email: string): Promise<string | null> {
  const res = await fetch(
    `https://api.systeme.io/api/contacts?email=${encodeURIComponent(email)}&limit=10`,
    { headers: { 'X-API-Key': API_KEY(), 'Content-Type': 'application/json' } }
  )
  if (!res.ok) return null
  const json  = await res.json()
  const items = json.items || json['hydra:member'] || []
  const found = items.find((c: any) => c.email?.toLowerCase() === email.toLowerCase())
  return found?.id ? String(found.id) : null
}

async function syncOne(lead: {
  id: string; email: string; name?: string | null
  phone?: string | null; systemeio_contact_id?: string | null
}): Promise<{ id: string; email: string; ok: boolean; contactId?: string; error?: string }> {
  const TAG                     = 'naruchnik'
  const { firstName, lastName } = splitName(lead.name)
  const phone                   = formatPhone(lead.phone)

  let contactId: string | null = lead.systemeio_contact_id || null

  if (contactId) {
    const check = await fetch(`https://api.systeme.io/api/contacts/${contactId}`, {
      method: 'GET', headers: { 'X-API-Key': API_KEY(), 'Content-Type': 'application/json' },
    })
    if (!check.ok) {
      if (check.status === 404) contactId = null
      else return { id: lead.id, email: lead.email, ok: false, error: `GET ${check.status}` }
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
    } else if (postRes.status === 429) {
      await sleep(2000)
      const retry = await fetch('https://api.systeme.io/api/contacts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY() },
        body:    JSON.stringify(postBody),
      })
      if (retry.ok)              { const j = await retry.json(); contactId = String(j.id) }
      else if (retry.status === 409) { contactId = await findContactByEmail(lead.email) }
      else { const t = await retry.text(); return { id: lead.id, email: lead.email, ok: false, error: `429+retry ${retry.status}: ${t.slice(0,150)}` } }
    } else {
      const t = await postRes.text()
      return { id: lead.id, email: lead.email, ok: false, error: `POST ${postRes.status}: ${t.slice(0, 150)}` }
    }
  }

  if (!contactId) return { id: lead.id, email: lead.email, ok: false, error: 'Не намерен contactId' }

  // Пауза преди PATCH — Systeme.io понякога е бавен след POST
  await sleep(300)
  await patchContact(contactId, firstName, lastName, phone)
  await sleep(200)
  await addTag(contactId, TAG)

  return { id: lead.id, email: lead.email, ok: true, contactId }
}

// ── POST /api/leads/sync/batch ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!API_KEY()) return NextResponse.json({ error: 'systemeio_api не е зададен' }, { status: 500 })

  const { ids } = await req.json() as { ids: string[] }
  if (!ids?.length) return NextResponse.json({ error: 'Липсват ids' }, { status: 400 })

  const safeIds = ids.slice(0, 10) // макс 10 наведнъж

  const { data: leads, error } = await supabaseAdmin
    .from('leads')
    .select('id, email, name, phone, systemeio_contact_id')
    .in('id', safeIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!leads?.length) return NextResponse.json({ success: true, synced: 0, failed: 0 })

  const now     = new Date().toISOString()
  // Обработваме по 3 паралелно за да не удрим rate limit
  let synced    = 0
  const errors: string[] = []

  for (let i = 0; i < leads.length; i += 3) {
    const batch   = (leads as any[]).slice(i, i + 3)
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

    if (i + 3 < leads.length) await sleep(400)
  }

  return NextResponse.json({
    success: true,
    total:   leads.length,
    synced,
    failed:  errors.length,
    errors:  errors.length > 0 ? errors : undefined,
  })
}
