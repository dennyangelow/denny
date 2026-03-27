// app/api/own-products/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// 1. ЗАРЕЖДАНЕ НА ВСИЧКИ ПРОДУКТИ
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Грешка при GET продукти:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    // Връщаме обекта с ключ "products", както го очаква твоят ContentTab.tsx
    return NextResponse.json({ products: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: 'Сървърна грешка при зареждане' }, { status: 500 })
  }
}

// 2. СЪЗДАВАНЕ НА НОВ ПРОДУКТ
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // 1. Защита: Премахваме id и дати, ако са изпратени случайно
    const { id, created_at, ...insertData } = body

    // 2. Валидация: Проверка за заглавие и цена
    if (!insertData.name || insertData.price === undefined) {
      return NextResponse.json({ error: 'Името и цената са задължителни' }, { status: 400 })
    }

    // 3. Автоматичен slug (ако липсва)
    if (!insertData.slug && insertData.name) {
      insertData.slug = insertData.name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^-a-z0-9а-яё]/g, '')
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert([insertData]) // Винаги подаваме масив за по-голяма стабилност
      .select()
      .single()

    if (error) {
      console.error('Грешка при POST продукти:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ product: data })
  } catch (error: any) {
    console.error('Критична грешка при създаване:', error.message)
    return NextResponse.json({ error: 'Грешка при създаване на продукта' }, { status: 500 })
  }
}