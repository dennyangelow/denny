import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache' // 1. Добави този импорт

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('faq').select('*').eq('active', true).order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ faq: data || [] })
}

export async function POST(req: NextRequest) {
  const { id, ...body } = await req.json()
  
  const { data, error } = await supabaseAdmin
    .from('faq').insert(body).select().single()
    
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 2. ИЗЧИСТВАНЕ НА КЕША
  // Това обновява секцията с въпроси на началната страница веднага щом добавиш нов въпрос.
  revalidatePath('/')

  return NextResponse.json({ item: data }, { status: 201 })
}