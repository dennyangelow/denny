// app/api/leads/sync/route.ts — single tag edition
// POST → синхронизира systemeio_synced=false лийдове
// POST?all=true → full re-sync
// GET → статус (колко несинхронизирани)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

async function syncOne(
  apiKey: string,
  lead: {
    id:                    string
    email:                 string
    name?:                 string | null
    phone?:                string | null
    systemeio_contact_id?: string | null
  }
): Promise<{ id: string; email: string; ok: boolean; contactId?: string; error?: string }> {
  const tags   = [{ name: 'naruchnik' }]
  const fields = lead.phone ? [{ slug: 'phone', value: lead.phone }] : []

  // Ако имаме contact_id → PATCH
  if (lead.systemeio_contact_id) {
    const res = await fetch(`https://api.systeme.io/api/contacts/${lead.systemeio_contact_id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/merge-patch+json', 'X-API-Key': apiKey },
      body:    JSON.stringify({ tags }),
    })
    if (res.ok) return { id: lead.id, email: lead.email, ok: true, contactId: lead.systemeio_contact_id }
    if (res.status !== 404) {
      const t = await res.text()
      return { id: lead.id, email: lead.email, ok: false, error: `PATCH ${res.status}: ${t.slice(0, 150)}` }
    }
    // 404 → контактът е изтрит, пресъздаваме
  }

  // POST
  const [firstName, ...rest] = (lead.name || '').trim().split(/\s+/)
  const postRes = await fetch('https://api.systeme.io/api/contacts', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body:    JSON.stringify({
      email: lead.email, firstName: firstName || '', lastName: rest.join(' ') || '',
      tags, fields,
    }),
  })

  if (postRes.ok) {
    const json = await postRes.json()
    return { id: lead.id, email: lead.email, ok: true, contactId: String(json.id) }
  }

  // 409 → вече съществува → намираме ID
  if (postRes.status === 409) {
    const searchRes = await fetch(
      `https://api.systeme.io/api/contacts?email=${encodeURIComponent(lead.email)}&limit=10`,
      { headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' } }
    )
    if (searchRes.ok) {
      const json    = await searchRes.json()
      const contact = (json.items || json['hydra:member'] || [])
        .find((c: any) => c.email?.toLowerCase() === lead.email.toLowerCase())
      if (contact?.id) {
        return { id: lead.id, email: lead.email, ok: true, contactId: String(contact.id) }
      }
    }
    // 409 но не намерихме ID — все пак е ok, контактът е там
    return { id: lead.id, email: lead.email, ok: true }
  }

  const text = await postRes.text()
  return { id: lead.id, email: lead.email, ok: false, error: `POST ${postRes.status}: ${text.slice(0, 200)}` }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.systemeio_api
  if (!apiKey) {
    return NextResponse.json({ error: 'systemeio_api не е зadadен' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const syncAll  = searchParams.get('all') === 'true'
  const singleId = searchParams.get('id')       // ?id=UUID → само 1 лийд
  const now      = new Date().toISOString()

  // ── Единичен sync (?id=UUID) ─────────────────────────────────────────────
  if (singleId) {
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .select('id, email, name, phone, systemeio_contact_id')
      .eq('id', singleId)
      .single()

    if (error || !lead) {
      return NextResponse.json({ error: 'Лийдът не е намерен' }, { status: 404 })
    }

    const result = await syncOne(apiKey, lead)
    if (result.ok) {
      await supabaseAdmin.from('leads').update({
        systemeio_synced:     true,
        systemeio_contact_id: result.contactId || lead.systemeio_contact_id || undefined,
        systemeio_synced_at:  now,
        updated_at:           now,
      }).eq('id', lead.id)
      return NextResponse.json({ success: true, synced: 1, failed: 0 })
    } else {
      return NextResponse.json({ success: false, synced: 0, failed: 1, errors: [result.error] })
    }
  }

  // ── Масов sync ───────────────────────────────────────────────────────────
  let query = supabaseAdmin
    .from('leads')
    .select('id, email, name, phone, systemeio_contact_id')
    .eq('subscribed', true)

  if (!syncAll) query = query.eq('systemeio_synced', false)

  const { data: leads, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!leads || leads.length === 0) {
    return NextResponse.json({ success: true, synced: 0, message: 'Всички лийдове са синхронизирани ✅' })
  }

  const BATCH = 5
  let synced  = 0
  const errors: string[] = []

  for (let i = 0; i < leads.length; i += BATCH) {
    const batch   = leads.slice(i, i + BATCH)
    const results = await Promise.all(batch.map((lead: { id: string; email: string; name?: string | null; phone?: string | null; systemeio_contact_id?: string | null }) => syncOne(apiKey, lead)))

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

    if (i + BATCH < leads.length) await new Promise(r => setTimeout(r, 300))
  }

  return NextResponse.json({
    success: true,
    total:   leads.length,
    synced,
    failed:  errors.length,
    errors:  errors.length > 0 ? errors : undefined,
  })
}

export async function GET() {
  const { count: unsynced } = await supabaseAdmin
    .from('leads').select('*', { count: 'exact', head: true })
    .eq('systemeio_synced', false).eq('subscribed', true)

  const { count: total } = await supabaseAdmin
    .from('leads').select('*', { count: 'exact', head: true })
    .eq('subscribed', true)

  return NextResponse.json({ unsynced: unsynced ?? 0, total: total ?? 0 })
}
