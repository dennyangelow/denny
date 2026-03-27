import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('naruchnici')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) throw error
    return NextResponse.json({ naruchnici: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Подобрено генериране на slug, което работи по-добре
    if (!body.slug && body.title) {
      body.slug = body.title
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')           // интервалите стават тирета
        .replace(/[^-a-z0-9а-яё]/g, '') // запазва латиница, цифри и кирилица
    }

    const { data, error } = await supabaseAdmin
      .from('naruchnici')
      .insert([body])
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ naruchnik: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}