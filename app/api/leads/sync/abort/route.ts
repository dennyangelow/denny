// app/api/leads/sync/abort/route.ts — v1
//
// Записва sync_abort флаг в Supabase settings таблица.
// Batch route-ът го проверява между контактите и спира ако е true.
//
// POST → abort=true  (спри sync-а)
// DELETE → abort=false (изчисти флага преди нов sync)

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const FLAG_KEY = 'sync_abort'

export async function POST() {
  await supabaseAdmin
    .from('settings')
    .upsert({ key: FLAG_KEY, value: 'true', updated_at: new Date().toISOString() }, { onConflict: 'key' })

  console.info('[sync-abort] Abort флаг SET → batch ще спре след текущия контакт')
  return NextResponse.json({ aborted: true })
}

export async function DELETE() {
  await supabaseAdmin
    .from('settings')
    .upsert({ key: FLAG_KEY, value: 'false', updated_at: new Date().toISOString() }, { onConflict: 'key' })

  console.info('[sync-abort] Abort флаг CLEARED → готов за нов sync')
  return NextResponse.json({ aborted: false })
}

// GET — проверка (за debug)
export async function GET() {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', FLAG_KEY)
    .single()

  return NextResponse.json({ aborted: data?.value === 'true' })
}
