// app/api/affiliate-products/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    
    // 1. Защита: Изолираме само данните за промяна
    // Премахваме id и дати, за да не гърми базата данни
    const { id, created_at, ...updateData } = body

    const { data, error } = await supabaseAdmin
      .from('affiliate_products')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Affiliate PATCH Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ product: data })
  } catch (error: any) {
    return NextResponse.json({ error: 'Сървърна грешка при редакция' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabaseAdmin
      .from('affiliate_products')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Affiliate DELETE Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Добавяме GET, ако искаш да отвориш директен линк към продукта в админа
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabaseAdmin
    .from('affiliate_products')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ product: data })
}