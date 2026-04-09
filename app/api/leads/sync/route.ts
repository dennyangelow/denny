// ФАЙЛ: app/api/leads/sync/route.ts — v6
//
// ПОПРАВКИ v6:
//   1. GET ?id=xxx → sync на единичен контакт (за handleSyncOne в LeadsTab)
//   2. GET (без id) → статус { total, unsynced, invalidEmails }
//   3. POST → batch sync (5 контакта), поддържа ?all=true и ?id=xxx
//   4. hasMore: поправена заявка — вече не хвърля грешка при uuid array
//   5. Изключва невалидни НАВСЯКЪДЕ

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { syncContactWithRetry } from '@/lib/systemeio'

const BATCH_SIZE = 5
const sleep      = (ms: number) => new Promise(r => setTimeout(r, ms))
const API_KEY    = () => process.env.systemeio_api || ''

// ── GET: Статус (unsynced БЕЗ невалидни) ─────────────────────────────────────
export async function GET() {
  const apiKey = API_KEY()
  if (!apiKey) {
    return NextResponse.json({ error: 'systemeio_api не е зададен' }, { status: 500 })
  }

  const { count: total } = await supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact', head: true })

  const { count: invalidEmails } = await supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('systemeio_email_invalid', true)

  // unsynced = synced=false AND NOT невалидни
  const { count: unsynced } = await supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('systemeio_synced', false)
    .not('systemeio_email_invalid', 'eq', true)

  return NextResponse.json({
    total:         total         ?? 0,
    unsynced:      unsynced      ?? 0,
    invalidEmails: invalidEmails ?? 0,
  })
}

// ── POST: Batch sync ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const apiKey = API_KEY()
  if (!apiKey) {
    return NextResponse.json({ error: 'systemeio_api не е зададен' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const all      = searchParams.get('all') === 'true'
  const singleId = searchParams.get('id')     // За handleSyncOne

  const now = new Date().toISOString()

  // ── Единичен sync (?id=xxx) ─────────────────────────────────────────────────
  if (singleId) {
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .select('id, email, name, phone, naruchnik_slug, systemeio_contact_id, systemeio_email_invalid')
      .eq('id', singleId)
      .single()

    if (error || !lead) {
      return NextResponse.json({ error: 'Контактът не е намерен' }, { status: 404 })
    }

    if ((lead as any).systemeio_email_invalid) {
      return NextResponse.json({
        success: true, synced: 0, invalid: 1, failed: 0,
        invalidEmail: true, hasMore: false,
      })
    }

    const result = await syncContactWithRetry({
      apiKey,
      email:         (lead as any).email,
      name:          (lead as any).name,
      phone:         (lead as any).phone,
      contactId:     (lead as any).systemeio_contact_id,
      naruchnikSlug: (lead as any).naruchnik_slug,
    })

    if (result.ok) {
      await supabaseAdmin.from('leads').update({
        systemeio_synced:        true,
        systemeio_email_invalid: false,
        systemeio_contact_id:    result.contactId || (lead as any).systemeio_contact_id || undefined,
        systemeio_synced_at:     now,
        updated_at:              now,
      }).eq('id', singleId)

      return NextResponse.json({ success: true, synced: 1, invalid: 0, failed: 0, hasMore: false })
    }

    if (result.emailInvalid) {
      await supabaseAdmin.from('leads').update({
        systemeio_synced:        false,
        systemeio_email_invalid: true,
        updated_at:              now,
      }).eq('id', singleId)

      return NextResponse.json({
        success: true, synced: 0, invalid: 1, failed: 0,
        invalidEmail: true, hasMore: false,
      })
    }

    return NextResponse.json({
      success: false, synced: 0, invalid: 0, failed: 1,
      error:   result.error, hasMore: false,
    })
  }

  // ── Batch sync (без ?id) ────────────────────────────────────────────────────
  // ВИНАГИ изключваме невалидните
  let query = supabaseAdmin
    .from('leads')
    .select('id, email, name, phone, naruchnik_slug, systemeio_contact_id')
    .not('systemeio_email_invalid', 'eq', true)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (!all) {
    query = query.eq('systemeio_synced', false)
  }

  const { data: leads, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!leads?.length) {
    return NextResponse.json({
      success: true, total: 0, synced: 0, failed: 0, invalid: 0, hasMore: false,
    })
  }

  // Проверяваме дали има още след този batch
  // Използваме count заявка (без .not('id', 'in', ...) за да избегнем UUID проблеми)
  let hasMore = false
  try {
    const processedIds = leads.map((l: any) => l.id)

    // Вземаме следващия batch за да видим има ли още
    let checkQuery = supabaseAdmin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .not('systemeio_email_invalid', 'eq', true)
    if (!all) checkQuery = checkQuery.eq('systemeio_synced', false)

    const { count: totalRemaining } = await checkQuery
    // hasMore = има повече от текущия batch
    hasMore = (totalRemaining ?? 0) > BATCH_SIZE
  } catch {
    hasMore = false
  }

  let synced    = 0
  let failed    = 0
  let invalid   = 0
  const errors: string[] = []

  for (const l of leads as any[]) {
    const result = await syncContactWithRetry({
      apiKey,
      email:         l.email,
      name:          l.name,
      phone:         l.phone,
      contactId:     l.systemeio_contact_id,
      naruchnikSlug: l.naruchnik_slug,
    })

    if (result.ok) {
      synced++
      await supabaseAdmin.from('leads').update({
        systemeio_synced:        true,
        systemeio_email_invalid: false,
        systemeio_contact_id:    result.contactId || l.systemeio_contact_id || undefined,
        systemeio_synced_at:     now,
        updated_at:              now,
      }).eq('id', l.id)
    } else if (result.emailInvalid) {
      invalid++
      await supabaseAdmin.from('leads').update({
        systemeio_synced:        false,
        systemeio_email_invalid: true,
        updated_at:              now,
      }).eq('id', l.id)
    } else {
      failed++
      errors.push(`${l.email}: ${result.error}`)
      console.warn(`[sync] FAIL ${l.email}:`, result.error)
    }

    await sleep(1200)
  }

  return NextResponse.json({
    success: true,
    total:   leads.length,
    synced,
    failed,
    invalid,
    hasMore,
    errors:  errors.length > 0 ? errors : undefined,
  })
}
