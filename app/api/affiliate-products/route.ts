// app/api/affiliate-products/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('affiliate_products').select('*').order('sort_order', { ascending: true })
    if (error) throw error
    return NextResponse.json({ products: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...insertData } = body
    const { data, error } = await supabaseAdmin
      .from('affiliate_products')
      .insert([{ ...insertData, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
      .select().single()
    if (error) throw error
    return NextResponse.json({ product: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
