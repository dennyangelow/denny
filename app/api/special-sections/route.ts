// app/api/special-sections/route.ts  — GET all + POST new
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  const { data, error } = await sb()
    .from('special_sections')
    .select('*')
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sections: data || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  // bullets може да дойде като string разделен с нов ред от формата — нормализираме
  if (typeof body.bullets === 'string') {
    body.bullets = body.bullets.split('\n').map((s: string) => s.trim()).filter(Boolean)
  }
  const { data, error } = await sb()
    .from('special_sections')
    .insert([body])
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ section: data })
}
