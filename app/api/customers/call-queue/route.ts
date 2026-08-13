// app/api/customers/call-queue/route.ts
// GET → клиенти с next_contact_date <= днес (за звънене днес или просрочени)
//
// ✅ ФИКС: export const dynamic = 'force-dynamic' — без това Next.js App Router
//    може да кешира резултата от GET route handler-а статично (Data Cache),
//    затова след snooze/готово PATCH-а минаваше успешно в базата, но тази
//    заявка продължаваше да връща стар, кеширан списък до restart на dev сървъра.

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_call_queue')
    if (error) throw error
    return NextResponse.json(
      { queue: data || [] },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error: any) {
    console.error('GET /api/customers/call-queue error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
