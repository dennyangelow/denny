// app/api/leads/sync/route.ts — v6
//
// Промени спрямо v5:
//
// ✅ FIX 1 — BATCH намален от 3 на 2 (по-малко rate limits)
// ✅ FIX 2 — Sleep между батчове: 700ms → 1500ms
// ✅ FIX 3 — GET статус: невалидните имейли НЕ се броят като "чакащи sync"
//            (същото като v5, запазено)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { syncContact } from '@/lib/systemeio'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const API_KEY = () => process.env.systemeio_api || ''

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
      .select('id, email, name, phone, systemeio_contact_id, systemeio_email_invalid')
      .eq('id', singleId)
      .single()

    if (error || !lead) {
      return NextResponse.json({ error: 'Лийдът не е намерен' }, { status: 404 })
    }

    if ((lead as any).systemeio_email_invalid) {
      return NextResponse.json({
        success: false, synced: 0, failed: 0,
        message: 'Имейлът е маркиран като невалиден за Systeme.io. Пропуснат.',
        invalidEmail: true,
      })
    }

    const result = await syncContact({
      apiKey:    API_KEY(),
      email:     lead.email,
      name:      lead.name,
      phone:     lead.phone,
      contactId: lead.systemeio_contact_id,
    })

    if (result.ok) {
      await supabaseAdmin.from('leads').update({
        systemeio_synced:        true,
        systemeio_email_invalid: false,
        systemeio_contact_id:    result.contactId || lead.systemeio_contact_id || undefined,
        systemeio_synced_at:     now,
        updated_at:              now,
      }).eq('id', lead.id)
      return NextResponse.json({ success: true, synced: 1, failed: 0 })

    } else if (result.emailInvalid) {
      await supabaseAdmin.from('leads').update({
        systemeio_synced:        false,
        systemeio_email_invalid: true,
        updated_at:              now,
      }).eq('id', lead.id)
      return NextResponse.json({
        success: false, synced: 0, failed: 0,
        message: `Невалиден имейл: ${result.error}`,
        invalidEmail: true,
      })

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
    .not('systemeio_email_invalid', 'eq', true) // Никога не sync-ваме невалидни имейли

  if (!syncAll) query = query.eq('systemeio_synced', false)

  const { data: leads, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!leads || leads.length === 0) {
    return NextResponse.json({
      success: true, synced: 0, total: 0,
      message: 'Всички лийдове са синхронизирани ✅',
    })
  }

  const BATCH = 2  // ✅ FIX: 2 вместо 3 — по-малко rate limits
  let synced   = 0
  let invalid  = 0
  const errors: string[] = []

  for (let i = 0; i < leads.length; i += BATCH) {
    const batch   = leads.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map((l: any) => syncContact({
        apiKey:    API_KEY(),
        email:     l.email,
        name:      l.name,
        phone:     l.phone,
        contactId: l.systemeio_contact_id,
      }))
    )

    for (let j = 0; j < results.length; j++) {
      const r = results[j]
      const l = batch[j] as any

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

    // ✅ FIX: 1500ms вместо 700ms — Systeme.io rate limit е ~60 req/min
    if (i + BATCH < leads.length) await sleep(1500)
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

// ── GET /api/leads/sync — статус ──────────────────────────────────────────────

export async function GET() {
  const { count: unsynced } = await supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('systemeio_synced', false)
    .eq('subscribed', true)
    .not('systemeio_email_invalid', 'eq', true) // Невалидните не се броят като "чакащи"

  const { count: total } = await supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('subscribed', true)

  const { count: invalidEmails } = await supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('systemeio_email_invalid', true)

  return NextResponse.json({
    unsynced:      unsynced      ?? 0,
    total:         total         ?? 0,
    invalidEmails: invalidEmails ?? 0,
  })
}
