// app/api/affiliate-products/route.ts
// ✅ GET  — публичен (за началната страница — middleware го пропуска)
// ✅ POST — admin only (защитено от middleware)
// ✅ revalidatePath('/') при POST — новият продукт веднага се появява на началната страница
//
// ✅ ФИКС: същият проблем като в app/api/blog/route.ts — auto-slug
//    fallback-ът ползваше replace(/[^\w-]/g, ''), който маха всяка
//    кирилска буква от name-а. За продукт с кирилско име и без ръчно
//    въведен slug това даваше практически празен/счупен slug. Премахнато
//    в полза на изричен, задължителен slug.

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

    // ✅ ФИКС: auto-генерацията от name беше премахната — чупеше
    //    кирилски имена (виж коментара горе). Slug вече се изисква явно.
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
