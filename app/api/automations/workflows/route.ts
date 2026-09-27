// app/api/automations/workflows/route.ts — v1
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data: workflows, error } = await supabaseAdmin
    .from('workflows')
    .select('*, workflow_steps(*)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (workflows || []).map(w => w.id)
  const { data: enrollments } = ids.length
    ? await supabaseAdmin.from('workflow_enrollments').select('workflow_id, status').in('workflow_id', ids)
    : { data: [] as { workflow_id: string; status: string }[] }

  const stats: Record<string, { active: number; completed: number; exited: number }> = {}
  ;(enrollments || []).forEach(e => {
    if (!stats[e.workflow_id]) stats[e.workflow_id] = { active: 0, completed: 0, exited: 0 }
    stats[e.workflow_id][e.status as 'active' | 'completed' | 'exited']++
  })

  const result = (workflows || []).map((w: any) => ({
    ...w,
    workflow_steps: undefined,
    steps: (w.workflow_steps || []).sort((a: any, b: any) => a.step_number - b.step_number),
    stats: stats[w.id] || { active: 0, completed: 0, exited: 0 },
  }))

  return NextResponse.json({ workflows: result })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.name?.trim() || !body.trigger_type) {
      return NextResponse.json({ error: 'Име и тригер са задължителни' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('workflows')
      .insert({
        name:           body.name.trim(),
        trigger_type:   body.trigger_type,
        trigger_config: body.trigger_config || {},
        // ✅ Винаги стартира неактивно, независимо какво е подадено —
        //    активирането е отделно, съзнателно действие от Настройки,
        //    за да не тръгне недовършена серия случайно веднага при запис.
        active: false,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ workflow: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500 })
  }
}
