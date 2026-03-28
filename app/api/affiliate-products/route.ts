// app/api/affiliate-products/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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
    
    // Премахваме всякакви стари или грешни ключове, които биха предизвикали 500 грешка
    const { id, link, badge, tag, badj, tar, sub_title, color_hex, ...insertData } = body

    // Гарантираме, че данните са правилно мапнати към колоните в Supabase
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
    return NextResponse.json({ product: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}