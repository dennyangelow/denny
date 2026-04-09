// app/api/leads/sync/batch/route.ts — v10
//
// КРИТИЧНИ ПОПРАВКИ:
//   1. Връща syncedIds[] и invalidIds[] — frontend знае ТОЧНО кои са успели
//   2. Добавен console.log за API key debug
//   3. Увеличен sleep между контактите: 1500ms (стабилност)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { syncContact } from '@/lib/systemeio'

const sleep   = (ms: number) => new Promise(r => setTimeout(r, ms))
const API_KEY = () => process.env.systemeio_api || ''

export async function POST(req: NextRequest) {
  const apiKey = API_KEY()
  if (!apiKey) {
    console.error('[batch] systemeio_api е ПРАЗЕН — провери Environment Variables!')
    return NextResponse.json({ error: 'systemeio_api не е зададен' }, { status: 500 })
  }

  console.info(`[batch] API key present: ${apiKey.slice(0, 8)}...`)

  const { ids } = await req.json() as { ids: string[] }
  if (!ids?.length) return NextResponse.json({ error: 'Липсват ids' }, { status: 400 })

  // Максимум 3 контакта на извикване → ~9 сек → безопасно под 30s Vercel timeout
  const safeIds = ids.slice(0, 3)
  console.info(`[batch] Ще sync-нем ${safeIds.length} контакта: ${safeIds.join(', ')}`)

  const { data: leads, error } = await supabaseAdmin
    .from('leads')
    .select('id, email, name, phone, naruchnik_slug, systemeio_contact_id, systemeio_email_invalid')
    .in('id', safeIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!leads?.length) return NextResponse.json({ success: true, synced: 0, failed: 0, syncedIds: [], invalidIds: [] })

  const now         = new Date().toISOString()
  let synced        = 0
  let invalid       = 0
  const errors:      string[] = []
  const syncedIds:   string[] = []   // ← НОВО: точни ID-та на успешно синхронизираните
  const invalidIds:  string[] = []   // ← НОВО: точни ID-та на невалидните имейли

  for (const l of leads as any[]) {
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
    syncedIds,    // ← frontend ги използва за точен UI update
    invalidIds,
    errors:     errors.length > 0 ? errors : undefined,
  })
}
