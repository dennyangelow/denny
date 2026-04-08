// app/api/leads/sync/route.ts — v9
//
// v9 промени:
//   - BATCH_PER_CALL: 5 → 3 (по-малко контакта = по-малко шанс за Vercel timeout)
//   - sleep между контактите: 500ms → 1200ms (спазване на rate limit)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { syncContact } from '@/lib/systemeio'

const sleep   = (ms: number) => new Promise(r => setTimeout(r, ms))
const API_KEY = () => process.env.systemeio_api || ''

const BATCH_PER_CALL = 3  // 3 контакта × ~5 сек = ~15 сек (безопасно < 30 сек timeout)

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
      .select('id, email, name, phone, naruchnik_slug, systemeio_contact_id, systemeio_email_invalid')
      .eq('id', singleId)
      .single()

    if (error || !lead) {
      return NextResponse.json({ error: 'Лийдът не е намерен' }, { status: 404 })
    }

    if ((lead as any).systemeio_email_invalid) {
      return NextResponse.json({
        success: false, synced: 0, failed: 0,
        message: 'Имейлът е маркиран като невалиден. Пропуснат.',
        invalidEmail: true,
      })
    }

    const result = await syncContact({
      apiKey:        API_KEY(),
      email:         lead.email,
      name:          lead.name,
      phone:         lead.phone,
      contactId:     lead.systemeio_contact_id,
      naruchnikSlug: lead.naruchnik_slug,
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
    }

    if (result.emailInvalid) {
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
    }

    return NextResponse.json({ success: false, synced: 0, failed: 1, errors: [result.error] })
  }

  // ── Масов sync ────────────────────────────────────────────────────────────
  let query = supabaseAdmin
    .from('leads')
    .select('id, email, name, phone, naruchnik_slug, systemeio_contact_id')
    .eq('subscribed', true)
    .not('systemeio_email_invalid', 'eq', true)
    .limit(BATCH_PER_CALL)

  if (!syncAll) {
    query = query.eq('systemeio_synced', false)
  }

  const { data: leads, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!leads || leads.length === 0) {
    return NextResponse.json({
      success: true, synced: 0, total: 0, hasMore: false,
      message: 'Всички лийдове са синхронизирани ✅',
    })
  }

  let synced  = 0
  let invalid = 0
  const errors: string[] = []

  for (const lead of leads as any[]) {
    const result = await syncContact({
      apiKey:        API_KEY(),
      email:         lead.email,
      name:          lead.name,
      phone:         lead.phone,
      contactId:     lead.systemeio_contact_id,
      naruchnikSlug: lead.naruchnik_slug,
    })

    if (result.ok) {
      synced++
      await supabaseAdmin.from('leads').update({
        systemeio_synced:        true,
        systemeio_email_invalid: false,
        systemeio_contact_id:    result.contactId || lead.systemeio_contact_id || undefined,
        systemeio_synced_at:     now,
        updated_at:              now,
      }).eq('id', lead.id)
    } else if (result.emailInvalid) {
      invalid++
      await supabaseAdmin.from('leads').update({
        systemeio_synced:        false,
        systemeio_email_invalid: true,
        updated_at:              now,
      }).eq('id', lead.id)
    } else {
      errors.push(`${lead.email}: ${result.error}`)
    }

    await sleep(1200)  // 1.2 сек пауза → безопасно за rate limit
  }

  // Проверяваме дали има още
  const remainingQuery = supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('subscribed', true)
    .not('systemeio_email_invalid', 'eq', true)

  if (!syncAll) remainingQuery.eq('systemeio_synced', false)

  const { count: remaining } = await remainingQuery

  return NextResponse.json({
    success: true,
    total:   leads.length,
    synced,
    invalid,
    failed:  errors.length,
    hasMore: (remaining ?? 0) > 0,
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
    .not('systemeio_email_invalid', 'eq', true)

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
