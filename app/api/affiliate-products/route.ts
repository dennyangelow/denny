// app/api/affiliate-products/route.ts
// ✅ GET  — публичен (за началната страница — middleware го пропуска)
// ✅ POST — admin only (защитено от middleware)
// ✅ revalidatePath('/') при POST — новият продукт веднага се появява на началната страница

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')

  let query = supabaseAdmin
    .from('affiliate_products')
    .select('*')
    .eq('active', true)
    .order('sort_order')

  if (slug) {
    query = (query as any).eq('slug', slug)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ products: data || [] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Auto-генерация на slug от name ако не е подаден
    if (!body.slug && body.name) {
      body.slug = body.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '')
        .replace(/--+/g, '-')
    }
    if (!body.slug) {
      return NextResponse.json({ error: 'Slug е задължителен' }, { status: 400 })
    }

    const { id, ...rest } = body
    const payload = id ? { id, ...rest } : rest

    const { data, error } = await supabaseAdmin
      .from('affiliate_products')
      .insert(payload)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ✅ Нов продукт → началната страница се обновява автоматично
    revalidatePath('/')

    return NextResponse.json({ product: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500 })
  }
}
