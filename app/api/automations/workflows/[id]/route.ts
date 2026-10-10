// app/api/automations/workflows/[id]/route.ts — v2
//
// ПОПРАВКИ v2 (спрямо v1) — Мега план:
//   ✅ steps вече пази и delay_hours (не само delay_days) и conditions
//      (jsonb) — идват директно от builder-а. Валидирани тук, не просто
//      прекарани наготово, за да не влезе счупен jsonb в базата.
//   ✅ template_key вече не се валидира срещу фиксиран списък (премахнато
//      в [key]/route.ts също) — builder-ът може да сочи към произволен
//      съществуващ темплейт от библиотеката.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const MAX_CONDITIONS_KEYS = 10

function sanitizeConditions(input: any): Record<string, any> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const allowed = new Set([
    'require_tag', 'exclude_tag',
    'min_days_since_last_order', 'has_bought_product', 'total_spent_gte',
    'require_opened_previous_step', 'require_clicked_previous_step',
    'skip_if_purchased_since_enrollment',
  ])
  const out: Record<string, any> = {}
  let count = 0
  for (const [k, v] of Object.entries(input)) {
    if (!allowed.has(k) || v === '' || v === null || v === undefined) continue
    if (count >= MAX_CONDITIONS_KEYS) break
    out[k] = v
    count++
  }
  return out
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { steps, ...fields } = body

    if (Object.keys(fields).length > 0) {
      const { error } = await supabaseAdmin
        .from('workflows')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', params.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ✅ Стъпките се заменят ИЗЦЯЛО при промяна (delete + insert), не се
    //    прави diff — по-просто и надеждно за малък брой стъпки на
    //    workflow. Съществуващи enrollments не се пипат — те продължават
    //    по current_step/next_run_at, каквито си бяха, следващият им
    //    lookup по step_number ще намери новите стъпки автоматично.
    if (Array.isArray(steps)) {
      if (steps.some((s: any) => !s.template_key || typeof s.template_key !== 'string')) {
        return NextResponse.json({ error: 'Всяка стъпка трябва да сочи към темплейт (template_key)' }, { status: 400 })
      }

      const { error: delErr } = await supabaseAdmin.from('workflow_steps').delete().eq('workflow_id', params.id)
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

      if (steps.length > 0) {
        const rows = steps.map((s: any, i: number) => ({
          workflow_id:  params.id,
          step_number:  i + 1,
          delay_days:   Math.max(0, Number(s.delay_days) || 0),
          delay_hours:  Math.max(0, Math.min(23, Number(s.delay_hours) || 0)),
          template_key: s.template_key,
          active:       s.active ?? true,
          conditions:   sanitizeConditions(s.conditions),
        }))
        const { error: insErr } = await supabaseAdmin.from('workflow_steps').insert(rows)
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  // workflow_steps и workflow_enrollments падат сами (on delete cascade)
  const { error } = await supabaseAdmin.from('workflows').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
