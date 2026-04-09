// ФАЙЛ: app/api/leads/sync/route.ts — v5
//
// ⚠️  ВАЖНО: Този файл замества стария route.ts в app/api/leads/sync/
//     Старият route пренасочваше към /api/leads/sync/batch
//     Новият обработва sync директно (без batch redirect)
//
// ПОПРАВКИ v5:
//   1. GET: unsynced НЕ включва невалидни имейли (systemeio_email_invalid=true)
//   2. POST: ВИНАГИ изключва невалидни — и при sync, и при all=true
//   3. Използва syncContactWithRetry директно (не вика /batch)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { syncContactWithRetry } from '@/lib/systemeio'

const BATCH_SIZE = 5
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const API_KEY = () => process.env.systemeio_api || ''

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

  // ✅ ПОПРАВКА: unsynced = synced=false AND NOT невалидни
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

// ── POST: Batch sync (5 контакта) ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const apiKey = API_KEY()
  if (!apiKey) {
    return NextResponse.json({ error: 'systemeio_api не е зададен' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const all = searchParams.get('all') === 'true'

  // ✅ ВИНАГИ изключваме невалидните — и при sync, и при all=true
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
  const leadIds = leads.map((l: any) => l.id)
  let remainingQuery = supabaseAdmin
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .not('systemeio_email_invalid', 'eq', true)
    .not('id', 'in', `(${leadIds.map((id: string) => `"${id}"`).join(',')})`)
  if (!all) remainingQuery = remainingQuery.eq('systemeio_synced', false)
  const { count: remaining } = await remainingQuery

  const now     = new Date().toISOString()
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
    hasMore: (remaining ?? 0) > 0,
    errors:  errors.length > 0 ? errors : undefined,
  })
}
