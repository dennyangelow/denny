// app/api/own-products/variants/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('product_variants')
    .select('*, product:products(slug, name)')
    .eq('active', true)
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ variants: data || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  // Авто-изчисляваме price_per_liter
  if (body.price && body.size_liters) {
    body.price_per_liter = (body.price / body.size_liters).toFixed(4)
  }
  const { data, error } = await supabaseAdmin
    .from('product_variants').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ variant: data }, { status: 201 })
}