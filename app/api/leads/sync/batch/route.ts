// app/api/leads/sync/batch/route.ts — v9
//
// v9: safeIds → 3 (не 10) за да не timeout-ва Vercel
//     sleep 1500ms между контактите

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { syncContact } from '@/lib/systemeio'

const sleep   = (ms: number) => new Promise(r => setTimeout(r, ms))
const API_KEY = () => process.env.systemeio_api || ''

export async function POST(req: NextRequest) {
  if (!API_KEY()) {
    return NextResponse.json({ error: 'systemeio_api не е зададен' }, { status: 500 })
  }

  const { ids } = await req.json() as { ids: string[] }
  if (!ids?.length) return NextResponse.json({ error: 'Липсват ids' }, { status: 400 })

  // Максимум 3 контакта на извикване → ~9 сек → безопасно под 30s Vercel timeout
  const safeIds = ids.slice(0, 3)

  const { data: leads, error } = await supabaseAdmin
    .from('leads')
    .select('id, email, name, phone, naruchnik_slug, systemeio_contact_id, systemeio_email_invalid')
    .in('id', safeIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!leads?.length) return NextResponse.json({ success: true, synced: 0, failed: 0 })

  const now     = new Date().toISOString()
  let synced    = 0
  let invalid   = 0
  const errors: string[] = []

  for (const l of leads as any[]) {
    if (l.systemeio_email_invalid) {
      invalid++
      continue
    }

    const r = await syncContact({
      apiKey:        API_KEY(),
      email:         l.email,
      name:          l.name,
      phone:         l.phone,
      contactId:     l.systemeio_contact_id,
      naruchnikSlug: l.naruchnik_slug,
    })

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
      console.warn(`[batch] Неуспешен sync за ${l.email}:`, r.error)
    }

    await sleep(1500)
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
