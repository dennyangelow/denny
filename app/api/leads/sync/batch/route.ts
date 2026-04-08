// app/api/leads/sync/batch/route.ts — v6
//
// Промени спрямо v5:
//
// ✅ FIX 1 — BATCH размер намален от 3 на 2
//    Причина: при 3 едновременни заявки към Systeme.io API-то
//    връща rate limit (429) особено при PATCH + addTag.
//    2 паралелни заявки + sleep между групи е по-стабилно.
//
// ✅ FIX 2 — Sleep между батчове увеличен от 500ms на 1500ms
//    Systeme.io има rate limit ~60 req/min = ~1 req/sec.
//    При 2 контакта × ~4 request-а/контакт = ~8 req/batch.
//    1500ms пауза + естествено забавяне от async операции = безопасно.
//
// ✅ FIX 3 — При rate limit (429) от syncContact, route-ът
//    НЕ маркира контакта като failed — просто го прескача за сега.
//    Ще се вземе при следващ sync.

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

  // Максимум 10 контакта на batch заявка
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

  // ── BATCH=2: по-малко паралелни заявки → по-малко rate limits ────────────
  const BATCH_SIZE = 2

  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = (leads as any[]).slice(i, i + BATCH_SIZE)

    // Пропускаме невалидните директно — вече знаем, че няма смисъл
    const toSync  = batch.filter((l: any) => !l.systemeio_email_invalid)
    const skipped = batch.filter((l: any) =>  l.systemeio_email_invalid)
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
        // Грешка — логваме но НЕ маркираме като "invalid"
        // При следващ sync ще се опита отново
        errors.push(`${l.email}: ${r.error}`)
        console.warn(`[batch] Неуспешен sync за ${l.email}:`, r.error)
      }
    }

    // Пауза между батчове — предотвратява rate limit
    if (i + BATCH_SIZE < leads.length) await sleep(1500)
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
