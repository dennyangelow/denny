import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache' // 1. Добави този импорт

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('testimonials').select('*').eq('active', true).order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ testimonials: data || [] })
}

export async function POST(req: NextRequest) {
  const { id, ...body } = await req.json()
  
  const { data, error } = await supabaseAdmin
    .from('testimonials').insert(body).select().single()
    
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 2. ИЗЧИСТВАНЕ НА КЕША
  // Това гарантира, че новият отзив ще се появи в секцията "Какво казват хората"
  // веднага след като го добавиш от админ панела.
  revalidatePath('/')

  return NextResponse.json({ testimonial: data }, { status: 201 })
}