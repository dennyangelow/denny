import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache' // 1. Добави този импорт

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('affiliate_products').select('*').order('sort_order', { ascending: true })
    if (error) throw error
    return NextResponse.json({ products: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Премахваме всякакви стари или грешни ключове
    const { id, link, badge, tag, badj, tar, sub_title, color_hex, ...insertData } = body

    // Гарантираме, че данните са правилно мапнати
    const cleanData = {
      ...insertData,
      affiliate_url: insertData.affiliate_url || link,
      badge_text: insertData.badge_text || badge || badj,
      tag_text: insertData.tag_text || tag || tar,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabaseAdmin
      .from('affiliate_products')
      .insert([cleanData])
      .select().single()
      
    if (error) throw error

    // 2. ИЗЧИСТВАНЕ НА КЕША
    // Това гарантира, че новите партньорски продукти ще се появят 
    // веднага на сайта след като ги добавиш от админ панела.
    revalidatePath('/')

    return NextResponse.json({ product: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}