import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache' // 1. Добави този импорт

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('ginegar_products').select('*').eq('active', true).order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ products: data || [] })
}

export async function POST(req: NextRequest) {
  const { id, ...body } = await req.json()
  
  const { data, error } = await supabaseAdmin
    .from('ginegar_products').insert(body).select().single()
    
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 2. ИЗЧИСТВАНЕ НА КЕША
  // Това гарантира, че ако добавиш нов модел фолио или мрежа, 
  // те ще се появят веднага на сайта без нужда от нов билд.
  revalidatePath('/')

  return NextResponse.json({ product: data }, { status: 201 })
}