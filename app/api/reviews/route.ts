// app/api/reviews/route.ts — v1
// Admin CRUD за обединената reviews таблица. Защитено през middleware.ts
// (вече добавен '/api/reviews' в PROTECTED_API_PREFIXES).
//
// GET  — списък, филтрируем по entity_type/entity_id/status/featured_home
// POST — създава нов отзив (ръчно въведен или от скрийншот)
// PATCH/DELETE — виж [id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const sp          = req.nextUrl.searchParams
  const entityType  = sp.get('entity_type')
  const entityId    = sp.get('entity_id')
  const status      = sp.get('status')
  const featuredOnly = sp.get('featured_home') === 'true'

  let query = supabaseAdmin.from('reviews').select('*').order('created_at', { ascending: false })

  if (entityType)   query = query.eq('entity_type', entityType)
  if (entityId)     query = query.eq('entity_id', entityId)
  if (status)       query = query.eq('status', status)
  if (featuredOnly) query = query.eq('featured_home', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reviews: data || [] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.entity_type || !body.entity_id || !body.author_name || !body.rating || !body.text) {
      return NextResponse.json(
        { error: 'Липсват задължителни полета (entity_type, entity_id, author_name, rating, text)' },
        { status: 400 }
      )
    }
    if (body.rating < 1 || body.rating > 5) {
      return NextResponse.json({ error: 'rating трябва да е между 1 и 5' }, { status: 400 })
    }

    // Никога не пращаме id при insert — оставяме Supabase да го генерира
    const { id, ...insertData } = body

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .insert(insertData)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ review: data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
