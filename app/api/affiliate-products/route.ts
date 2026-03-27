// app/api/affiliate-products/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('affiliate_products')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) throw error

    // Връщаме ключ "products", както го очаква твоят фронтенд (ContentTab.tsx)
    return NextResponse.json({ products: data || [] })
  } catch (error: any) {
    console.error('Affiliate GET Error:', error.message)
    return NextResponse.json({ error: 'Грешка при зареждане на продуктите' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // 1. Почистване на данните
    const { id, created_at, updated_at, ...insertData } = body

    // 2. Валидация - заглавието и линкът са критични
    if (!insertData.title || !insertData.affiliate_url) {
      return NextResponse.json({ error: 'Заглавието и партнерският линк са задължителни' }, { status: 400 })
    }

    // 3. Автоматичен slug (ако е празен)
    if (!insertData.slug && insertData.title) {
      insertData.slug = insertData.title
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^-a-z0-9а-яё]/g, '') // Поддържа и кирилица
    }

    const now = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('affiliate_products')
      .insert([{
        ...insertData,
        created_at: now,
        updated_at: now
      }])
      .select()
      .single()

    if (error) {
      console.error('Affiliate POST Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ product: data })
  } catch (error: any) {
    console.error('Affiliate Server Error:', error.message)
    return NextResponse.json({ error: 'Грешка при създаване на продукта' }, { status: 500 })
  }
}