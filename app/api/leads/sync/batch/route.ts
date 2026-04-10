// ФАЙЛ: app/api/leads/sync/batch/route.ts — v13
//
// ПОПРАВКИ v13:
//   1. КЛЮЧОВА ПОПРАВКА: Leads с systemeio_email_invalid=true в DB се връщат
//      в invalidIds отговора (вместо мълчаливо да се пропускат).
//      Преди: frontend пращаше ID → DB го изключваше → изчезваше без трас →
//             progress bar заседваше (done < total)
//      Сега: взимаме ВСИЧКИ ids с select, разделяме на "за sync" и "вече невалидни"
//            → невалидните влизат директно в invalidIds без API call към Systeme.io

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { syncContactWithRetry } from '@/lib/systemeio'

const sleep   = (ms: number) => new Promise(r => setTimeout(r, ms))
const API_KEY = () => process.env.systemeio_api || ''

async function isAborted(): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from('settings').select('value').eq('key', 'sync_abort').single()
    return data?.value === 'true'
  } catch { return false }
}

export async function POST(req: NextRequest) {
  const apiKey = API_KEY()
  if (!apiKey) {
    console.error('[batch] systemeio_api е ПРАЗЕН!')
    return NextResponse.json({ error: 'systemeio_api не е зададен' }, { status: 500 })
  }

  console.info(`[batch] API key: ${apiKey.slice(0, 8)}...`)

  const { ids } = await req.json() as { ids: string[] }
  if (!ids?.length) return NextResponse.json({ error: 'Липсват ids' }, { status: 400 })

  if (await isAborted()) {
    return NextResponse.json({
      success: true, total: 0, synced: 0, invalid: 0, failed: 0,
      syncedIds: [], invalidIds: [], aborted: true,
    })
  }

  const safeIds = ids.slice(0, 50)
  console.info(`[batch] Получени ${safeIds.length} id-та за sync`)

  // ✅ ПОПРАВКА v13: Взимаме ВСИЧКИ поискани leads (без .not filter)
  // Разделяме ги на две групи:
  //   - alreadyInvalid: systemeio_email_invalid=true → директно в invalidIds (без API call)
  //   - toProcess: останалите → минават през syncContactWithRetry
  const { data: allLeads, error } = await supabaseAdmin
    .from('leads')
    .select('id, email, name, phone, naruchnik_slug, systemeio_contact_id, systemeio_email_invalid')
    .in('id', safeIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!allLeads?.length) return NextResponse.json({
    success: true, synced: 0, failed: 0, invalid: 0,
    syncedIds: [], invalidIds: [], aborted: false,
  })

  const alreadyInvalid = (allLeads as any[]).filter(l => l.systemeio_email_invalid === true)
  const toProcess      = (allLeads as any[]).filter(l => !l.systemeio_email_invalid)

  console.info(`[batch] За sync: ${toProcess.length}, вече невалидни в DB: ${alreadyInvalid.length}`)

  const now         = new Date().toISOString()
  let synced        = 0
  let invalid       = alreadyInvalid.length
  const errors:     string[] = []
  const syncedIds:  string[] = []
  const invalidIds: string[] = alreadyInvalid.map(l => l.id)

  for (const l of toProcess) {
    if (await isAborted()) {
      console.info(`[batch] Abort преди ${l.email}`)
      return NextResponse.json({
        success: true, total: allLeads.length,
        synced, invalid, failed: errors.length,
        syncedIds, invalidIds, aborted: true,
        errors: errors.length > 0 ? errors : undefined,
      })
    }

    console.info(`[batch] Sync: ${l.email} (contactId=${l.systemeio_contact_id || 'none'})`)

    const r = await syncContactWithRetry({
      apiKey,
      email:         l.email,
      name:          l.name,
      phone:         l.phone,
      contactId:     l.systemeio_contact_id,
      naruchnikSlug: l.naruchnik_slug,
    })

    console.info(`[batch] ${l.email}: ok=${r.ok} emailInvalid=${r.emailInvalid} error=${r.error || 'none'}`)

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
      console.warn(`[batch] FAIL ${l.email}:`, r.error)
    }

    await sleep(1500)
  }

  console.info(`[batch] Готово: synced=${synced}, invalid=${invalid}, failed=${errors.length}`)

  return NextResponse.json({
    success:   true,
    total:     allLeads.length,
    synced,
    invalid,
    failed:    errors.length,
    syncedIds,
    invalidIds,
    aborted:   false,
    errors:    errors.length > 0 ? errors : undefined,
  })
}
