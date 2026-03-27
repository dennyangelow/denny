// app/api/naruchnici/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('naruchnici')
    .select('*')
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ naruchnici: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.slug && body.title) {
    body.slug = body.title.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '')
      .replace(/--+/g, '-')
  }
  const { data, error } = await supabaseAdmin
    .from('naruchnici')
    .insert(body)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ naruchnik: data })
}
