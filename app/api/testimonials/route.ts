import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('testimonials').select('*').eq('active', true).order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ testimonials: data || [] })
}
export async function POST(req: NextRequest) {
  const { id, ...body } = await req.json()
  const { data, error } = await supabaseAdmin
    .from('testimonials').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ testimonial: data }, { status: 201 })
}