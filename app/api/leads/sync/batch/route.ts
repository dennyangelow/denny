// app/api/leads/sync/batch/route.ts — v5
// Промени: пропуска лийдове с systemeio_email_invalid=true

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { syncContact } from '@/lib/systemeio'

const sleep   = (ms: number) => new Promise(r => setTimeout(r, ms))
const API_KEY = () => process.env.systemeio_api || ''

export async function POST(req: NextRequest) {
  if (!API_KEY()) return NextResponse.json({ error: 'systemeio_api не е зададен' }, { status: 500 })

  const { ids } = await req.json() as { ids: string[] }
  if (!ids?.length) return NextResponse.json({ error: 'Липсват ids' }, { status: 400 })

  const safeIds = ids.slice(0, 10)

  const { data: leads, error } = await supabaseAdmin
    .from('leads')
    .select('id, email, name, phone, systemeio_contact_id, systemeio_email_invalid')
    .in('id', safeIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!leads?.length) return NextResponse.json({ success: true, synced: 0, failed: 0 })

  const now     = new Date().toISOString()
  let synced    = 0
  let invalid   = 0
  const errors: string[] = []

  for (let i = 0; i < leads.length; i += 3) {
    const batch = (leads as any[]).slice(i, i + 3)

    // Пропускаме невалидните директно
    const toSync   = batch.filter((l: any) => !l.systemeio_email_invalid)
    const skipped  = batch.filter((l: any) =>  l.systemeio_email_invalid)
    invalid += skipped.length

    if (toSync.length === 0) continue

    const results = await Promise.all(
      toSync.map((l: any) => syncContact({
        apiKey:    API_KEY(),
        email:     l.email,
        name:      l.name,
        phone:     l.phone,
        contactId: l.systemeio_contact_id,
      }))
    )

    for (let j = 0; j < results.length; j++) {
      const r = results[j]
      const l = toSync[j]

      if (r.ok) {
        synced++
        await supabaseAdmin.from('leads').update({
          systemeio_synced:        true,
          systemeio_email_invalid: false,
          systemeio_contact_id:    r.contactId || l.systemeio_contact_id || undefined,
          systemeio_synced_at:     now,
          updated_at:              now,
        }).eq('id', l.id)
      } else if (r.emailInvalid) {
        invalid++
        await supabaseAdmin.from('leads').update({
          systemeio_synced:        false,
          systemeio_email_invalid: true,
          updated_at:              now,
        }).eq('id', l.id)
      } else {
        errors.push(`${l.email}: ${r.error}`)
      }
    }

    if (i + 3 < leads.length) await sleep(500)
  }

  return NextResponse.json({
    success: true,
    total:   leads.length,
    synced,
    invalid,
    failed:  errors.length,
    errors:  errors.length > 0 ? errors : undefined,
  })
}
