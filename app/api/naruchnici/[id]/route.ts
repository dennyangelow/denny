// app/api/naruchnici/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { data, error } = await supabaseAdmin
      .from('naruchnici')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', params.id).select().single()
    if (error) throw error
    return NextResponse.json({ naruchnik: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabaseAdmin.from('naruchnici').delete().eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabaseAdmin
    .from('naruchnici').select('*').eq('id', params.id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ naruchnik: data })
}
