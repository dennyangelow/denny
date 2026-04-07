import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache' // 1. Добави този импорт

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('category_links').select('*').order('sort_order', { ascending: true })
    if (error) throw error
    return NextResponse.json({ links: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...insertData } = body

    // Изчистване: ако slug е празен или тире — го зануляваме
    if (!insertData.slug || insertData.slug.trim() === '' || insertData.slug.trim() === '-') {
      insertData.slug = null
    }

    const { data, error } = await supabaseAdmin
      .from('category_links').insert([insertData]).select().single()
      
    if (error) throw error

    revalidatePath('/')
    return NextResponse.json({ link: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}