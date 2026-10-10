// app/api/admin/email-templates/route.ts — v2
//
// ПОПРАВКИ v2 (спрямо v1) — Мега план: email_templates е ЕДИНСТВЕНИЯТ
// източник на съдържание (lib/automations.ts v6 вече няма код fallback):
//   ✅ Вече връщаме ВСИЧКИ редове от email_templates (не само 6-те
//      TEMPLATE_KEYS) — builder-ът може да е създал нови, преизползваеми
//      темплейти, които не са в статичния списък.
//   ✅ "override" полето отпада — всеки ред вече Е съдържанието, не
//      "override на код". За известните 6 ключа пазим label/vars от
//      TEMPLATE_KEYS за по-четливо UI; за нови (custom) ключове label-ът е
//      самият key.
//   ✅ Добавено usedByStepsCount — колко активни стъпки сочат към всеки
//      темплейт (за "преизползван в N автоматизации" бадж в UI-а и за
//      DELETE guard-а в [key]/route.ts).
//
// ⚠️ Изисква новата email_templates таблица + SQL migration-а "Мега план"
// (виж файла, даден в чата), който пренася 6-те стари кодирани темплейта.
//
// Admin-only (защитено през middleware.ts PROTECTED_API_PREFIXES, както
// останалите /api/admin/* routes).

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { TEMPLATE_KEYS } from '@/lib/email-template-keys'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' }

export async function GET() {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('email_templates')
      .select('template_key, subject, body_html, updated_at')
      .order('updated_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE })

    const { data: steps } = await supabaseAdmin
      .from('workflow_steps').select('template_key').eq('active', true)
    const usageCount = new Map<string, number>()
    for (const s of steps || []) usageCount.set(s.template_key, (usageCount.get(s.template_key) || 0) + 1)

    const metaByKey = new Map(TEMPLATE_KEYS.map(m => [m.key, m]))

    const templates = (rows || []).map(row => {
      const meta = metaByKey.get(row.template_key)
      return {
        key:               row.template_key,
        label:             meta?.label || row.template_key,
        vars:              meta?.vars || ['name', 'email'],
        subject:           row.subject,
        body_html:         row.body_html,
        updated_at:        row.updated_at,
        usedByStepsCount:  usageCount.get(row.template_key) || 0,
      }
    })

    return NextResponse.json({ templates }, { headers: NO_STORE })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500, headers: NO_STORE })
  }
}
