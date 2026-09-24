// app/api/email-stats/route.ts
//
// Агрегира данните, които webhook-ът (/api/webhooks/ses) вече пише:
//   - email_logs.opened_at / clicked_at → open/click rate по sequence стъпка
//   - leads.unsubscribe_reason ('hard_bounce' / 'spam_complaint') → bounce статистика
//   - abandoned_carts → фунел на изоставените колички
//
// Admin-only (защитен през /api/settings prefix стил в middleware.ts —
// добави '/api/email-stats' в PROTECTED_API_PREFIXES).

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const STEP_LABELS: Record<number, string> = {
  1: 'Welcome (ден 0)',
  2: 'Follow-up (ден 2)',
  3: 'Follow-up (ден 5)',
  4: 'Follow-up (ден 10)',
}

export async function GET() {
  try {
    const since90d = new Date(Date.now() - 90 * 86400000).toISOString()
    const since30d = new Date(Date.now() - 30 * 86400000).toISOString()

    // ── Sequence stats (последните 90 дни) ────────────────────────────────
    const { data: logs } = await supabaseAdmin
      .from('email_logs')
      .select('sequence_name, step_number, sent_at, opened_at, clicked_at')
      .gte('sent_at', since90d)

    const bySteps = new Map<number, { sent: number; opened: number; clicked: number }>()
    for (const log of logs || []) {
      const step = log.step_number
      const row = bySteps.get(step) || { sent: 0, opened: 0, clicked: 0 }
      row.sent++
      if (log.opened_at)  row.opened++
      if (log.clicked_at) row.clicked++
      bySteps.set(step, row)
    }

    const sequenceStats = Array.from(bySteps.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([step, row]) => ({
        step,
        label: STEP_LABELS[step] || `Стъпка ${step}`,
        sent: row.sent,
        opened: row.opened,
        clicked: row.clicked,
        openRate:  row.sent > 0 ? +((row.opened  / row.sent) * 100).toFixed(1) : 0,
        clickRate: row.sent > 0 ? +((row.clicked / row.sent) * 100).toFixed(1) : 0,
      }))

    const totalSent   = sequenceStats.reduce((s, r) => s + r.sent, 0)
    const totalOpened = sequenceStats.reduce((s, r) => s + r.opened, 0)
    const totalClicked = sequenceStats.reduce((s, r) => s + r.clicked, 0)

    // ── Bounce / complaint (последните 30 дни) ────────────────────────────
    const { count: hardBounces } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('unsubscribe_reason', 'hard_bounce')
      .gte('updated_at', since30d)

    const { count: complaints } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('unsubscribe_reason', 'spam_complaint')
      .gte('updated_at', since30d)

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
        hardBounces: hardBounces ?? 0,
        complaints:  complaints  ?? 0,
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
