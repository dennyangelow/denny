// app/api/email-stats/route.ts — v2
//
// ФИКС v2 (спрямо v1): v1 групираше sequenceStats само по step_number —
// "стъпка 1" на naruchnik welcome-серията, "стъпка 1" на изоставена поръчка
// и "стъпка 1" на изоставена количка всички имат step_number=1, значи се
// сливаха в ЕДИН ред с невярни числа. Сега групираме по композитен key
// `${sequence_name}::${step_number}` и показваме истинското име на
// workflow-а (взето от workflows таблицата — новите email_logs редове имат
// sequence_name='workflow:<uuid>'). Старите редове с sequence_name='naruchnik'
// (отпреди новия engine) пазят LEGACY_STEP_LABELS fallback.
//
// Агрегира данните, които webhook-ът (/api/webhooks/ses) вече пише:
//   - email_logs.opened_at / clicked_at → open/click rate по стъпка
//   - leads.unsubscribe_reason ('hard_bounce' / 'spam_complaint') → bounce статистика
//   - abandoned_carts → фунел на изоставените колички
//
// Admin-only (защитен през middleware.ts PROTECTED_API_PREFIXES).

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const LEGACY_STEP_LABELS: Record<number, string> = {
  1: 'Welcome (ден 0)',
  2: 'Follow-up (ден 2)',
  3: 'Follow-up (ден 5)',
  4: 'Follow-up (ден 10)',
}

export async function GET() {
  try {
    const since90d = new Date(Date.now() - 90 * 86400000).toISOString()
    const since30d = new Date(Date.now() - 30 * 86400000).toISOString()

    // ── Sequence logs (последните 90 дни) ─────────────────────────────────
    const { data: logs } = await supabaseAdmin
      .from('email_logs')
      .select('sequence_name, step_number, sent_at, opened_at, clicked_at')
      .gte('sent_at', since90d)

    // ✅ Реалните имена на workflow-ите, за sequence_name='workflow:<uuid>' редове
    const workflowIds = Array.from(new Set(
      (logs || [])
        .map(l => l.sequence_name)
        .filter((s): s is string => !!s && s.startsWith('workflow:'))
        .map(s => s.slice('workflow:'.length))
    ))
    const workflowNames = new Map<string, string>()
    if (workflowIds.length > 0) {
      const { data: wfs } = await supabaseAdmin.from('workflows').select('id, name').in('id', workflowIds)
      for (const wf of wfs || []) workflowNames.set(wf.id, wf.name)
    }

    // ✅ ФИКС: композитен key вместо чист step_number
    const byKey = new Map<string, { label: string; sent: number; opened: number; clicked: number }>()
    for (const log of logs || []) {
      const key = `${log.sequence_name}::${log.step_number}`
      let label: string
      if (log.sequence_name?.startsWith('workflow:')) {
        const wfId = log.sequence_name.slice('workflow:'.length)
        label = `${workflowNames.get(wfId) || 'Автоматизация'} — стъпка ${log.step_number}`
      } else {
        label = LEGACY_STEP_LABELS[log.step_number] || `${log.sequence_name || 'Стъпка'} ${log.step_number}`
      }
      const row = byKey.get(key) || { label, sent: 0, opened: 0, clicked: 0 }
      row.sent++
      if (log.opened_at)  row.opened++
      if (log.clicked_at) row.clicked++
      byKey.set(key, row)
    }

    const sequenceStats = Array.from(byKey.entries())
      .sort((a, b) => a[1].label.localeCompare(b[1].label, 'bg'))
      .map(([id, row]) => ({
        id,
        label: row.label,
        sent: row.sent,
        opened: row.opened,
        clicked: row.clicked,
        openRate:  row.sent > 0 ? +((row.opened  / row.sent) * 100).toFixed(1) : 0,
        clickRate: row.sent > 0 ? +((row.clicked / row.sent) * 100).toFixed(1) : 0,
      }))

    const totalSent    = sequenceStats.reduce((s, r) => s + r.sent, 0)
    const totalOpened  = sequenceStats.reduce((s, r) => s + r.opened, 0)
    const totalClicked = sequenceStats.reduce((s, r) => s + r.clicked, 0)

    // ── Bounce / complaint (последните 30 дни) ────────────────────────────
    // ✅ unsubscribe_reason колоната може да липсва на живата база (виж
    // migrations/004_leads_missing_columns.sql) — Promise.allSettled
    // деградира gracefully до 0 вместо да счупи целия endpoint с 500.
    const [hbRes, cmRes] = await Promise.allSettled([
      supabaseAdmin.from('leads').select('*', { count: 'exact', head: true })
        .eq('unsubscribe_reason', 'hard_bounce').gte('updated_at', since30d),
      supabaseAdmin.from('leads').select('*', { count: 'exact', head: true })
        .eq('unsubscribe_reason', 'spam_complaint').gte('updated_at', since30d),
    ])
    const hardBounces = hbRes.status === 'fulfilled' ? (hbRes.value.count ?? 0) : 0
    const complaints  = cmRes.status === 'fulfilled' ? (cmRes.value.count ?? 0) : 0
    if (hbRes.status === 'rejected') console.error('[email-stats] hardBounces query failed:', hbRes.reason)
    if (cmRes.status === 'rejected') console.error('[email-stats] complaints query failed:', cmRes.reason)

    // ── Abandoned carts фунел ──────────────────────────────────────────────
    const { count: draftsTotal } = await supabaseAdmin
      .from('abandoned_carts').select('*', { count: 'exact', head: true })

    const { count: converted } = await supabaseAdmin
      .from('abandoned_carts').select('*', { count: 'exact', head: true })
      .eq('converted', true)

    const { count: reminded } = await supabaseAdmin
      .from('abandoned_carts').select('*', { count: 'exact', head: true })
      .not('reminded_at', 'is', null)

    const { count: pending } = await supabaseAdmin
      .from('abandoned_carts').select('*', { count: 'exact', head: true })
      .eq('converted', false)
      .is('reminded_at', null)

    return NextResponse.json({
      sequenceStats,
      totals: {
        sent: totalSent,
        opened: totalOpened,
        clicked: totalClicked,
        openRate:  totalSent > 0 ? +((totalOpened  / totalSent) * 100).toFixed(1) : 0,
        clickRate: totalSent > 0 ? +((totalClicked / totalSent) * 100).toFixed(1) : 0,
      },
      deliverability: {
        hardBounces,
        complaints,
      },
      abandonedCarts: {
        total:     draftsTotal ?? 0,
        converted: converted   ?? 0,
        reminded:  reminded    ?? 0,
        pending:   pending     ?? 0,
      },
    })
  } catch (error: any) {
    console.error('[email-stats] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
