// app/api/leads/sync/batch/route.ts
// POST { ids: string[] } → синхронизира дадените ID-та (макс 10 наведнъж)
// Извиква се от frontend на вълни за да се избегне serverless timeout

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

async function addTag(apiKey: string, contactId: string, tagName: string): Promise<void> {
  await fetch(`https://api.systeme.io/api/contacts/${contactId}/tags`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body:    JSON.stringify({ name: tagName }),
  })
}

async function patchContact(
  apiKey: string, contactId: string,
  firstName: string, lastName: string, phone?: string | null
): Promise<void> {
  const body: Record<string, string> = { firstName, lastName }
  if (phone) body.phoneNumber = phone
  await fetch(`https://api.systeme.io/api/contacts/${contactId}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body:    JSON.stringify(body),
  })
}

async function syncOne(
  apiKey: string,
  lead: { id: string; email: string; name?: string | null; phone?: string | null; systemeio_contact_id?: string | null }
): Promise<{ id: string; email: string; ok: boolean; contactId?: string; error?: string }> {
  const TAG = 'naruchnik'
  const [firstName, ...rest] = (lead.name || '').trim().split(/\s+/)
  const lastName = rest.join(' ') || ''

  async function updateAndTag(contactId: string) {
    await Promise.all([
      patchContact(apiKey, contactId, firstName || '', lastName, lead.phone),
      addTag(apiKey, contactId, TAG),
    ])
  }

  if (lead.systemeio_contact_id) {
    const res = await fetch(`https://api.systeme.io/api/contacts/${lead.systemeio_contact_id}`, {
      method: 'GET', headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      await updateAndTag(lead.systemeio_contact_id)
      return { id: lead.id, email: lead.email, ok: true, contactId: lead.systemeio_contact_id }
    }
    if (res.status !== 404) {
      return { id: lead.id, email: lead.email, ok: false, error: `GET ${res.status}` }
    }
  }

  const postRes = await fetch('https://api.systeme.io/api/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ email: lead.email, firstName: firstName || '', lastName, phoneNumber: lead.phone || undefined }),
  })

  if (postRes.ok) {
    const json = await postRes.json()
    const contactId = String(json.id)
    await addTag(apiKey, contactId, TAG)
    return { id: lead.id, email: lead.email, ok: true, contactId }
  }

  if (postRes.status === 409) {
    const searchRes = await fetch(
      `https://api.systeme.io/api/contacts?email=${encodeURIComponent(lead.email)}&limit=10`,
      { headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' } }
    )
    if (searchRes.ok) {
      const json = await searchRes.json()
      const contact = (json.items || json['hydra:member'] || [])
        .find((c: any) => c.email?.toLowerCase() === lead.email.toLowerCase())
      if (contact?.id) {
        const contactId = String(contact.id)
        await updateAndTag(contactId)
        return { id: lead.id, email: lead.email, ok: true, contactId }
      }
    }
    return { id: lead.id, email: lead.email, ok: true }
  }

  const text = await postRes.text()
  return { id: lead.id, email: lead.email, ok: false, error: `POST ${postRes.status}: ${text.slice(0, 150)}` }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.systemeio_api
  if (!apiKey) return NextResponse.json({ error: 'systemeio_api не е зададен' }, { status: 500 })

  const { ids } = await req.json() as { ids: string[] }
  if (!ids?.length) return NextResponse.json({ error: 'Липсват ids' }, { status: 400 })

  const { data: leads, error } = await supabaseAdmin
    .from('leads')
    .select('id, email, name, phone, systemeio_contact_id')
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!leads?.length) return NextResponse.json({ success: true, synced: 0, failed: 0 })

  const now = new Date().toISOString()
  const results = await Promise.all(
    (leads as { id: string; email: string; name?: string | null; phone?: string | null; systemeio_contact_id?: string | null }[])
      .map(lead => syncOne(apiKey, lead))
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
