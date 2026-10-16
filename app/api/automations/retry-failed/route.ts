// app/api/admin/automations/retry-failed/route.ts — v1
//
// ✅ НОВО — ръчен "Retry" за dead-letter enrollments (workflow_enrollments
//    със status='exited' заради sendEmail грешка, а не бизнес причина като
//    "lead отписан" — виж lib/automations.ts v8, recordFailure()).
//    POST { enrollment_id } връща enrollment-а в 'active', attempts=0,
//    last_error изчистено, next_run_at=сега — следващият automation tick
//    (на всеки час, app/api/automations/tick) ще опита пак да прати
//    стъпката. Нарочно пипа САМО enrollments, които в момента са 'exited'
//    (условието .eq('status','exited') по-долу) — не може случайно да
//    "съживи" нещо вече завършило нормално ('completed') или различен ред.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const enrollmentId = typeof body.enrollment_id === 'string' ? body.enrollment_id : null

    if (!enrollmentId) {
      return NextResponse.json({ error: 'enrollment_id е задължителен' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('workflow_enrollments')
      .update({
        status:      'active',
        attempts:    0,
        last_error:  null,
        next_run_at: new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      })
      .eq('id', enrollmentId)
      .eq('status', 'exited')   // само dead-letter редове, не всякакви
      .select('id, workflow_id, lead_id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Не е намерен спрян (exited) enrollment с това ID' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, enrollment: data[0] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500 })
  }
}
