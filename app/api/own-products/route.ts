// app/api/own-products/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// 1. ТОЗИ МЕТОД Е КЛЮЧОВ - той зарежда списъка в таба "Собствени"
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) throw error
    
    // Връщаме обекта с ключ "products", както го очаква ContentTab.tsx
    return NextResponse.json({ products: data || [] })
  } catch (error: any) {
    console.error('Грешка при GET продукти:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 2. ТОЗИ МЕТОД Е ЗА СЪЗДАВАНЕ (когато натиснеш "+ Добави")
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { data, error } = await supabaseAdmin
      .from('products')
      .insert(body)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ product: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}