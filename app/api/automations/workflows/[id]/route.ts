// app/api/automations/workflows/[id]/route.ts — v1
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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
      const { error: delErr } = await supabaseAdmin.from('workflow_steps').delete().eq('workflow_id', params.id)
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

      if (steps.length > 0) {
        const rows = steps.map((s: any, i: number) => ({
          workflow_id:  params.id,
          step_number:  i + 1,
          delay_days:   Number(s.delay_days) || 0,
          template_key: s.template_key,
          active:       s.active ?? true,
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
