// app/api/promo-banners/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get('all') === 'true'
  
  let query = supabaseAdmin.from('promo_banners').select('*').order('sort_order')
  
  if (!all) {
    // Публично: само активни и в срока
    const now = new Date().toISOString()
    query = query
      .eq('active', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ banners: data || [] })
}

export async function POST(req: NextRequest) {
  const { id, ...body } = await req.json()
  const { data, error } = await supabaseAdmin
    .from('promo_banners').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/')
  return NextResponse.json({ banner: data }, { status: 201 })
}
