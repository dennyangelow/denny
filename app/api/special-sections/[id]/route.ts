// app/api/special-sections/[id]/route.ts  — PATCH update + DELETE
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  // bullets може да дойде като string разделен с нов ред — нормализираме
  if (typeof body.bullets === 'string') {
    body.bullets = body.bullets.split('\n').map((s: string) => s.trim()).filter(Boolean)
  }
  const { data, error } = await sb()
    .from('special_sections')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ section: data })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await sb()
    .from('special_sections')
    .delete()
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
