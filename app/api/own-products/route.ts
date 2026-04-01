// app/api/own-products/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function GET(req: NextRequest) {
  try {
    const includeVariants = req.nextUrl.searchParams.get('include_variants') === 'true'

    // Ако е поискано — правим join с product_variants
    const selectQuery = includeVariants
      ? '*, product_variants(id, label, size_liters, price, compare_price, price_per_liter, stock, sort_order, active)'
      : '*'

    const { data, error } = await supabaseAdmin
      .from('products')
      .select(selectQuery)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return NextResponse.json({ products: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Никога не пращаме id при insert — оставяме Supabase да го генерира
    const { id, ...insertData } = body

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert(insertData)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/')
    return NextResponse.json({ product: data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
