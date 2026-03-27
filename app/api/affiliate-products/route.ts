// app/api/affiliate-products/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// 1. ЗАРЕЖДАНЕ НА ВСИЧКИ ПРОДУКТИ (за списъка в Админ панела)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('affiliate_products')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) throw error

    // ВАЖНО: Връщаме ключ "products", защото ContentTab.tsx го очаква точно така
    return NextResponse.json({ products: data || [] })
  } catch (error: any) {
    console.error('Affiliate GET Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 2. СЪЗДАВАНЕ НА НОВ ПРОДУКТ (когато натиснеш "+ Добави")
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Премахваме id, ако случайно е пратено, за да може базата да генерира ново
    const { id, ...insertData } = body

    const { data, error } = await supabaseAdmin
      .from('affiliate_products')
      .insert([{
        ...insertData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ product: data })
  } catch (error: any) {
    console.error('Affiliate POST Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}