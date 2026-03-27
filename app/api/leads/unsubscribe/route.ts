// app/api/leads/unsubscribe/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { email, reason } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('leads')
      .update({
        subscribed: false,
        unsubscribe_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('email', email.toLowerCase().trim())

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
