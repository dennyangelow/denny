import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function GET(req: NextRequest) {
  const showAll = req.nextUrl.searchParams.get('all') === 'true'

  let query = supabaseAdmin.from('faq').select('*').order('sort_order')

  // Admin иска всички (активни + скрити), публичният сайт — само активни
  if (!showAll) query = query.eq('active', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ faq: data || [] })
}

export async function POST(req: NextRequest) {
  const { id, ...body } = await req.json()

  const { data, error } = await supabaseAdmin
    .from('faq').insert(body).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/')
  return NextResponse.json({ item: data }, { status: 201 })
}
