// app/api/category-links/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// 1. ЗАРЕЖДАНЕ НА ВСИЧКИ ЛИНКОВЕ (за списъка в Админ панела)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('category_links')
      .select('*')
      .order('sort_order', { ascending: true }) // Подреждаме ги по твоя зададен ред

    if (error) {
      console.error('Category Links GET Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // ВАЖНО: Връщаме { links: [...] }, защото това очаква фронтендът в ContentTab.tsx
    return NextResponse.json({ links: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: 'Възникна сървърна грешка при зареждане на линковете' }, { status: 500 })
  }
}

// 2. СЪЗДАВАНЕ НА НОВ ЛИНК (когато натиснеш "+ Добави" в таба Линкове)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // 1. Почистваме данните - премахваме id и дати, ако са изпратени случайно
    const { id, created_at, ...insertData } = body

    // 2. Валидация - ако няма заглавие или URL, не записваме нищо
    if (!insertData.title || !insertData.url) {
      return NextResponse.json({ error: 'Заглавието и URL адресът са задължителни' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('category_links')
      .insert([insertData]) // Винаги подаваме масив към .insert() за сигурност
      .select()
      .single()

    if (error) {
      console.error('Category Links POST Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ link: data })
  } catch (error: any) {
    console.error('Critical POST Error:', error.message)
    return NextResponse.json({ error: 'Грешка при създаването на линка' }, { status: 500 })
  }
}