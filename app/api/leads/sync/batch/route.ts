// app/api/leads/sync/batch/route.ts — v2 FIXED
// POST { ids: string[] } → синхронизира дадените ID-та (макс 10 наведнъж)
// Оправено: PATCH с merge-patch+json, phoneNumber в стандартното поле, retry при 429

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const API_KEY = () => process.env.systemeio_api || ''
const sleep   = (ms: number) => new Promise(r => setTimeout(r, ms))

async function patchContact(
  contactId: string,
  firstName: string,
  lastName: string,
  phone?: string | null
): Promise<boolean> {
  const body: Record<string, string> = { firstName, lastName }
  if (phone?.trim()) body.phoneNumber = phone.trim()

  const res = await fetch(`https://api.systeme.io/api/contacts/${contactId}`, {
    method:  'PATCH',
    headers: {
      'Content-Type': 'application/merge-patch+json',
      'X-API-Key':    API_KEY(),
    },
    body: JSON.stringify(body),
  })
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
  const TAG       = 'naruchnik'
  const parts     = (lead.name || '').trim().split(/\s+/)
  const firstName = parts[0] || ''
  const lastName  = parts.slice(1).join(' ') || ''
  const phone     = lead.phone?.trim() || undefined

  let contactId: string | null = lead.systemeio_contact_id || null

  // Проверяваме дали съществуващият контакт е валиден
  if (contactId) {
    const check = await fetch(`https://api.systeme.io/api/contacts/${contactId}`, {
      method: 'GET', headers: { 'X-API-Key': API_KEY(), 'Content-Type': 'application/json' },
    })
    if (!check.ok) {
      if (check.status === 404) contactId = null
      else return { id: lead.id, email: lead.email, ok: false, error: `GET ${check.status}` }
    }
  }

  // Създаваме нов контакт ако нямаме ID
  if (!contactId) {
    const postBody: Record<string, string> = { email: lead.email, firstName, lastName }
    if (phone) postBody.phoneNumber = phone

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

  // Ъпдейтваме данните + добавяме таг
  await patchContact(contactId, firstName, lastName, phone)
  await addTag(contactId, TAG)

  return { id: lead.id, email: lead.email, ok: true, contactId }
}

export async function POST(req: NextRequest) {
  if (!API_KEY()) return NextResponse.json({ error: 'systemeio_api не е зададен' }, { status: 500 })

  const { ids } = await req.json() as { ids: string[] }
  if (!ids?.length) return NextResponse.json({ error: 'Липсват ids' }, { status: 400 })

  const { data: leads, error } = await supabaseAdmin
    .from('leads')
    .select('id, email, name, phone, systemeio_contact_id')
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!leads?.length) return NextResponse.json({ success: true, synced: 0, failed: 0 })

  const now     = new Date().toISOString()
  const results = await Promise.all(
    (leads as any[]).map((lead: any) => syncOne(lead))
  )

  let synced = 0
  const errors: string[] = []

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

  return NextResponse.json({
    success: true,
    total:   leads.length,
    synced,
    failed:  errors.length,
    errors:  errors.length > 0 ? errors : undefined,
  })
}
