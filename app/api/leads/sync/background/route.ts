// ФАЙЛ: app/api/leads/sync/background/route.ts — v1
//
// Целият sync върви НА СЪРВЪРА — браузърът не е нужен да е отворен.
//
// POST → стартира background sync (записва прогрес в settings таблицата)
// GET  → връща текущия прогрес (poll-ва се на всеки 3 сек от frontend-а)
//
// Vercel: maxDuration = 300 сек (Pro план = 5 мин, Hobby = 60 сек)
// За повече от 300 сек → използвай Vercel Cron или Trigger.dev

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { syncContactWithRetry } from '@/lib/systemeio'

export const maxDuration = 300 // Vercel Pro: 5 мин. Hobby: сложи 60.

const sleep   = (ms: number) => new Promise(r => setTimeout(r, ms))
const API_KEY = () => process.env.systemeio_api || ''
const JOB_KEY = 'sync_background_job'

// ── Helpers за прогрес в settings таблицата ──────────────────────────────────
async function saveProgress(data: object) {
  try {
    await supabaseAdmin.from('settings').upsert(
      { key: JOB_KEY, value: JSON.stringify(data), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  } catch { /* non-critical */ }
}

async function getProgress() {
  try {
    const { data } = await supabaseAdmin
      .from('settings').select('value, updated_at').eq('key', JOB_KEY).single()
    if (!data) return null
    return { ...JSON.parse(data.value), updatedAt: data.updated_at }
  } catch { return null }
}

async function isAborted(): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from('settings').select('value').eq('key', 'sync_abort').single()
    return data?.value === 'true'
  } catch { return false }
}

// ── GET: Прогрес ─────────────────────────────────────────────────────────────
export async function GET() {
  const progress = await getProgress()
  if (!progress) {
    return NextResponse.json({ status: 'idle' })
  }
  return NextResponse.json(progress)
}

// ── POST: Стартира sync ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const apiKey = API_KEY()
  if (!apiKey) {
    return NextResponse.json({ error: 'systemeio_api не е зададен' }, { status: 500 })
  }

  const { all = false } = await req.json().catch(() => ({}))

  // Изчистваме abort флага
  await supabaseAdmin.from('settings').upsert(
    { key: 'sync_abort', value: 'false', updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )

  // Броим колко трябва да се sync-нат
  let countQuery = supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .not('systemeio_email_invalid', 'eq', true)
  if (!all) countQuery = countQuery.eq('systemeio_synced', false)

  const { count: totalCount } = await countQuery

  const total = totalCount ?? 0

  // Записваме начално състояние
  await saveProgress({
    status:    'running',
    all,
    total,
    done:      0,
    synced:    0,
    failed:    0,
    invalid:   0,
    errors:    [],
    startedAt: new Date().toISOString(),
  })

  // ── Sync loop ─────────────────────────────────────────────────────────────
  // Работи изцяло на сървъра — браузърът може да е затворен
  let done      = 0
  let synced    = 0
  let failed    = 0
  let invalid   = 0
  const errors: string[] = []
  const BATCH   = 10
  const now     = new Date().toISOString()

  try {
    let offset = 0
    let hasMore = true

    while (hasMore) {
      if (await isAborted()) {
        await saveProgress({ status: 'aborted', total, done, synced, failed, invalid, errors })
        return NextResponse.json({ status: 'aborted', total, done, synced, failed, invalid })
      }

      // Взимаме следващата порция
      let query = supabaseAdmin
        .from('leads')
        .select('id, email, name, phone, naruchnik_slug, systemeio_contact_id, systemeio_email_invalid')
        .not('systemeio_email_invalid', 'eq', true)
        .order('created_at', { ascending: true })
        .range(offset, offset + BATCH - 1)

      if (!all) query = query.eq('systemeio_synced', false)

      const { data: leads, error } = await query
      if (error) {
        errors.push(`DB грешка: ${error.message}`)
        break
      }
      if (!leads?.length) break

      // Sync всеки контакт в порцията
      for (const l of leads as any[]) {
        if (await isAborted()) {
          await saveProgress({ status: 'aborted', total, done, synced, failed, invalid, errors })
          return NextResponse.json({ status: 'aborted', total, done, synced, failed, invalid })
        }

        const r = await syncContactWithRetry({
          apiKey,
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
          failed++
          errors.push(`${l.email}: ${r.error}`)
        }

        done++
        await sleep(1200) // Rate limit пауза
      }

      // Записваме прогрес след всяка порция
      await saveProgress({ status: 'running', all, total, done, synced, failed, invalid, errors: errors.slice(-10) })

      offset += BATCH
      hasMore = leads.length === BATCH
    }

    await saveProgress({
      status:      'done',
      all,
      total,
      done,
      synced,
      failed,
      invalid,
      errors:      errors.slice(-20),
      finishedAt:  new Date().toISOString(),
    })

    return NextResponse.json({ status: 'done', total, done, synced, failed, invalid })

  } catch (err: any) {
    await saveProgress({ status: 'error', total, done, synced, failed, invalid, errors: [err.message] })
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 })
  }
}
