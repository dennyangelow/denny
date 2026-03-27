// app/api/category-links/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('category_links').select('*').order('sort_order', { ascending: true })
    if (error) throw error
    return NextResponse.json({ links: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...insertData } = body
    const { data, error } = await supabaseAdmin
      .from('category_links').insert([insertData]).select().single()
    if (error) throw error
    return NextResponse.json({ link: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
