// app/api/leads/sync/batch/route.ts — v11
//
// НОВО: Server-side abort проверка преди всеки контакт
//   - Чете sync_abort флаг от Supabase settings
//   - Ако е true → спира и връща { aborted: true }
//   - Frontend-ът спира loop-а при aborted=true

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { syncContact } from '@/lib/systemeio'

const sleep   = (ms: number) => new Promise(r => setTimeout(r, ms))
const API_KEY = () => process.env.systemeio_api || ''

// Проверяваме дали е зададен abort флаг в Supabase
async function isAborted(): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'sync_abort')
      .single()
    return data?.value === 'true'
  } catch {
    return false  // При грешка → продължаваме (не прекъсваме sync-а)
  }
}

export async function POST(req: NextRequest) {
  const apiKey = API_KEY()
  if (!apiKey) {
    console.error('[batch] systemeio_api е ПРАЗЕН — провери Environment Variables!')
    return NextResponse.json({ error: 'systemeio_api не е зададен' }, { status: 500 })
  }

  console.info(`[batch] API key present: ${apiKey.slice(0, 8)}...`)

  const { ids } = await req.json() as { ids: string[] }
  if (!ids?.length) return NextResponse.json({ error: 'Липсват ids' }, { status: 400 })

  // Проверяваме abort веднага при старт на batch-а
  if (await isAborted()) {
    console.info('[batch] Abort флаг е активен → спираме преди старт')
    return NextResponse.json({
      success: true, total: 0, synced: 0, invalid: 0, failed: 0,
      syncedIds: [], invalidIds: [], aborted: true,
    })
  }

  const safeIds = ids.slice(0, 3)
  console.info(`[batch] Ще sync-нем ${safeIds.length} контакта: ${safeIds.join(', ')}`)

  const { data: leads, error } = await supabaseAdmin
    .from('leads')
    .select('id, email, name, phone, naruchnik_slug, systemeio_contact_id, systemeio_email_invalid')
    .in('id', safeIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!leads?.length) return NextResponse.json({
    success: true, synced: 0, failed: 0, syncedIds: [], invalidIds: [], aborted: false,
  })

  const now         = new Date().toISOString()
  let synced        = 0
  let invalid       = 0
  const errors:      string[] = []
  const syncedIds:   string[] = []
  const invalidIds:  string[] = []

  for (const l of leads as any[]) {
    // ── Проверка за abort ПРЕДИ всеки контакт ──────────────────────────────
    if (await isAborted()) {
      console.info(`[batch] Abort флаг засечен преди ${l.email} → спираме`)
      return NextResponse.json({
        success: true,
        total:   leads.length,
        synced, invalid, failed: errors.length,
        syncedIds, invalidIds,
        aborted: true,
        errors:  errors.length > 0 ? errors : undefined,
      })
    }

    if (l.systemeio_email_invalid) {
      invalid++
      invalidIds.push(l.id)
      console.info(`[batch] Пропускаме ${l.email} — невалиден имейл`)
      continue
    }

    console.info(`[batch] Sync за ${l.email} (contactId=${l.systemeio_contact_id || 'none'})`)

    const r = await syncContact({
      apiKey,
      email:         l.email,
      name:          l.name,
      phone:         l.phone,
      contactId:     l.systemeio_contact_id,
      naruchnikSlug: l.naruchnik_slug,
    })

    console.info(`[batch] Резултат за ${l.email}: ok=${r.ok} emailInvalid=${r.emailInvalid} error=${r.error || 'none'}`)

    if (r.ok) {
      synced++
      syncedIds.push(l.id)
      await supabaseAdmin.from('leads').update({
        systemeio_synced:        true,
        systemeio_email_invalid: false,
        systemeio_contact_id:    r.contactId || l.systemeio_contact_id || undefined,
        systemeio_synced_at:     now,
        updated_at:              now,
      }).eq('id', l.id)
    } else if (r.emailInvalid) {
      invalid++
      invalidIds.push(l.id)
      await supabaseAdmin.from('leads').update({
        systemeio_synced:        false,
        systemeio_email_invalid: true,
        updated_at:              now,
      }).eq('id', l.id)
    } else {
      errors.push(`${l.email}: ${r.error}`)
      console.warn(`[batch] НЕУСПЕШЕН sync за ${l.email}:`, r.error)
    }

    await sleep(1500)
  }

  console.info(`[batch] Готово: synced=${synced}, invalid=${invalid}, failed=${errors.length}`)

  return NextResponse.json({
    success:    true,
    total:      leads.length,
    synced,
    invalid,
    failed:     errors.length,
    syncedIds,
    invalidIds,
    aborted:    false,
    errors:     errors.length > 0 ? errors : undefined,
  })
}
