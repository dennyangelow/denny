// app/api/category-links/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('category_links').select('*').order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ links: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.slug) body.slug = body.label.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
  const { data, error } = await supabaseAdmin
    .from('category_links').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ link: data })
}
