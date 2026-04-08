// app/api/leads/sync/route.ts — v8
//
// КЛЮЧОВА ПРОМЯНА — защо предишните версии не работеха:
//
//   329 контакта × 4 API заявки/контакт = 1316 заявки
//   Systeme.io rate limit ≈ 60/мин = 1/сек
//   Vercel serverless timeout = 30 сек
//   → след ~25 контакта Vercel убива функцията → partial sync
//
// РЕШЕНИЕ:
//   1. Обработваме само 5 контакта на извикване (≈10 сек)
//   2. Sequentially (не parallel) → спазваме rate limit
//   3. Връщаме hasMore:true → Frontend вика пак автоматично
//   4. syncContact v10: само 2 заявки/контакт (без предварителен GET)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { syncContact } from '@/lib/systemeio'

const sleep   = (ms: number) => new Promise(r => setTimeout(r, ms))
const API_KEY = () => process.env.systemeio_api || ''

const BATCH_PER_CALL = 5  // 5 контакта × ~2 сек = ~10 сек (< 30 сек timeout)

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

  // ── Масов sync — само BATCH_PER_CALL контакта на извикване ───────────────
  //
  // За "sync несинхронизирани": взима само unsynced
  // За "full re-sync": взима всички валидни (syncAll=true)
  // В двата случая: само 5 наведнъж → frontend вика пак ако hasMore=true

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

  // Sequentially — НЕ parallel за да спазим rate limit
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

    // 500ms пауза между контактите → ~1 заявка/сек → безопасно за rate limit
    await sleep(500)
  }

  // Проверяваме дали има още за следващото извикване
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
    hasMore: (remaining ?? 0) > 0,  // Frontend вика пак ако true
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
