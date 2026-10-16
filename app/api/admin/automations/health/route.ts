// app/api/admin/automations/health/route.ts — v1
// Връща резултата от последното пускане на processDueEnrollments()
// (settings['automations_last_tick']) — за банера в Автоматизации таба.
// Защитено от middleware.ts (/api/admin/* е admin-only).

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from('settings').select('value').eq('key', 'automations_last_tick').maybeSingle()
    let tick: any = null
    try { tick = data?.value ? JSON.parse(data.value) : null } catch { tick = null }
    return NextResponse.json({ lastTick: tick })
  } catch (e: any) {
    console.error('GET /api/admin/automations/health error:', e?.message || e)
    return NextResponse.json({ error: 'Грешка' }, { status: 500 })
  }
}
