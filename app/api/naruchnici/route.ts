// app/api/naruchnici/route.ts — v2
// ✅ GET  — публичен (за naruchnik страниците и началната страница)
// ✅ POST — admin only (защитено от middleware)
// ✅ revalidatePath('/') при POST — новият наръчник веднага се вижда на началната страница

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')

  let query = supabaseAdmin
    .from('naruchnici')
    .select('*')
    .eq('active', true)
    .order('sort_order')

  if (slug) {
    query = (query as any).eq('slug', slug)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ naruchnici: data || [] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Auto-генерация на slug от title ако не е подаден
    if (!body.slug && body.title) {
      body.slug = body.title
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
      .from('naruchnici')
      .insert(payload)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ✅ Нов наръчник → началната страница се обновява автоматично
    revalidatePath('/')

    return NextResponse.json({ naruchnik: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500 })
  }
}
