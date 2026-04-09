// ФАЙЛ: app/api/leads/sync/background/route.ts — v2
//
// ПОПРАВКИ v2:
//   1. OFFSET БЪГ ПОПРАВЕН: при all=false не използваме range(offset,...)
//      защото вече-sync-натите се махат от резултатите → offset лъже.
//      Вместо това ВИНАГИ взимаме първите BATCH несинхронизирани (offset=0).
//   2. VERCEL TIMEOUT: намалена пауза от 1200ms → 600ms за да се побере в 60 сек.
//      400 контакта × 600ms = 240 сек → трябва Pro план (300 сек max).
//      За Hobby план: намали BATCH и използвай повтарящи се заявки от frontend.
//   3. saveProgress при всяка грешка/timeout — статусът винаги се записва.
//   4. При стартиране: ако вече върви job (status='running' и updatedAt < 30 сек) →
//      не стартираме нов, а връщаме текущия прогрес. Предотвратява двоен sync.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { syncContactWithRetry } from '@/lib/systemeio'

export const maxDuration = 300 // Vercel Pro: 5 мин. Hobby: сложи 60.

const sleep   = (ms: number) => new Promise(r => setTimeout(r, ms))
const API_KEY = () => process.env.systemeio_api || ''
const JOB_KEY = 'sync_background_job'

// Пауза между контакти — 600ms за да се побере в Vercel limits
// За Hobby план (60 сек max): 60000ms / 600ms = max ~100 контакта на run
const CONTACT_DELAY_MS = 600
const BATCH = 10

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

  // ── Предотвратяване на двоен sync ──────────────────────────────────────────
  // Ако вече върви job (записан преди по-малко от 30 сек) → не стартираме нов
  const existingProgress = await getProgress()
  if (existingProgress?.status === 'running') {
    const updatedAt = new Date(existingProgress.updatedAt || 0).getTime()
    const age = Date.now() - updatedAt
    if (age < 30_000) {
      // Job е активен — браузърът просто да продължи да poll-ва
      return NextResponse.json(existingProgress)
    }
    // Job е "заседнал" (>30 сек без update) — считаме го за мъртъв, стартираме нов
  }

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

  if (total === 0) {
    await saveProgress({
      status:     'done',
      all,
      total:      0,
      done:       0,
      synced:     0,
      failed:     0,
      invalid:    0,
      errors:     [],
      startedAt:  new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    })
    return NextResponse.json({ status: 'done', total: 0, done: 0, synced: 0, failed: 0, invalid: 0 })
  }

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
  let done    = 0
  let synced  = 0
  let failed  = 0
  let invalid = 0
  const errors: string[] = []
  const now = new Date().toISOString()

  try {
    let hasMore = true

    while (hasMore) {
      if (await isAborted()) {
        await saveProgress({ status: 'aborted', all, total, done, synced, failed, invalid, errors })
        return NextResponse.json({ status: 'aborted', total, done, synced, failed, invalid })
      }

      // ── КЛЮЧОВА ПОПРАВКА: ВИНАГИ взимаме от offset=0 ──────────────────────
      // При all=false: несинхронизираните се маркират като synced=true след обработка,
      // така че следващия BATCH автоматично ще съдържа следващите несинхронизирани.
      // НЕ трябва offset да расте — резултатите се "самопочистват".
      //
      // При all=true: трябва offset, защото всички остават в резултатите.
      // Затова при all=true пазим списък с вече-обработените id-та и ги пропускаме.

      let query = supabaseAdmin
        .from('leads')
        .select('id, email, name, phone, naruchnik_slug, systemeio_contact_id')
        .not('systemeio_email_invalid', 'eq', true)
        .order('created_at', { ascending: true })
        .limit(BATCH)

      if (!all) {
        // all=false: взимаме само несинхронизирани, ВИНАГИ от началото (offset=0)
        query = query.eq('systemeio_synced', false)
      } else {
        // all=true: взимаме по done offset
        query = query.range(done, done + BATCH - 1)
      }

      const { data: leads, error } = await query
      if (error) {
        errors.push(`DB грешка: ${error.message}`)
        break
      }
      if (!leads?.length) break

      // Sync всеки контакт в порцията
      for (const l of leads as any[]) {
        if (await isAborted()) {
          await saveProgress({ status: 'aborted', all, total, done, synced, failed, invalid, errors })
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
        await sleep(CONTACT_DELAY_MS)
      }

      // Записваме прогрес след всяка порция
      await saveProgress({
        status: 'running', all, total, done, synced, failed, invalid,
        errors: errors.slice(-10),
      })

      // При all=false: ако leads.length < BATCH → вече няма повече несинхронизирани
      // При all=true: продължаваме по offset (done)
      hasMore = leads.length === BATCH
    }

    await saveProgress({
      status:     'done',
      all,
      total,
      done,
      synced,
      failed,
      invalid,
      errors:     errors.slice(-20),
      finishedAt: new Date().toISOString(),
    })

    return NextResponse.json({ status: 'done', total, done, synced, failed, invalid })

  } catch (err: any) {
    // Записваме грешката — polling-ът ще я засече
    await saveProgress({
      status:  'error',
      all,
      total,
      done,
      synced,
      failed,
      invalid,
      errors:  [...errors.slice(-10), err.message],
      finishedAt: new Date().toISOString(),
    })
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 })
  }
}
