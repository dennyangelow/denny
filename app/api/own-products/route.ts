import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache' // 1. Добави този импорт

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')
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

    const { id, ...rest } = body
    const payload = id ? { id, ...rest } : rest

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert(payload)
      .select()
      .single()
      
    if (error) throw error

    // 2. ИЗЧИСТВАНЕ НА КЕША:
    // Когато добавиш нов продукт, началната страница ще се прегенерира,
    // за да го включи в списъка веднага.
    revalidatePath('/')

    return NextResponse.json({ product: data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}