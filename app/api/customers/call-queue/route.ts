// app/api/customers/call-queue/route.ts
// GET → клиенти с next_contact_date <= днес (за звънене днес или просрочени)

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_call_queue')
    if (error) throw error
    return NextResponse.json({ queue: data || [] })
  } catch (error: any) {
    console.error('GET /api/customers/call-queue error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
