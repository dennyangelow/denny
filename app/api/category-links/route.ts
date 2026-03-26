// app/api/category-links/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// 1. ЗАРЕЖДАНЕ НА ВСИЧКИ ЛИНКОВЕ (за списъка в Админ панела)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('category_links')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) throw error

    // ВАЖНО: Ключът трябва да е "links", защото ContentTab.tsx го очаква точно така
    return NextResponse.json({ links: data || [] })
  } catch (error: any) {
    console.error('Category Links GET Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 2. СЪЗДАВАНЕ НА НОВ ЛИНК (когато натиснеш "+ Добави" в таба Линкове)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Премахваме id, ако е изпратено, за да може Postgres да си генерира ново UUID
    const { id, ...insertData } = body

    const { data, error } = await supabaseAdmin
      .from('category_links')
      .insert([insertData])
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ link: data })
  } catch (error: any) {
    console.error('Category Links POST Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}