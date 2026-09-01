// app/api/blog-categories/route.ts — v1
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 40)
}

// ✅ GET е публичен (виж middleware.ts isPublicApiRequest) — /blog и
//    admin панелът четат от тук по еднакъв начин, никога hardcoded списък.
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('blog_categories')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return NextResponse.json({ categories: data || [] })
  } catch (err: any) {
    console.error('[api/blog-categories GET]', err)
    return NextResponse.json({ error: 'Грешка при зареждане на категориите' }, { status: 500 })
  }
}

// POST — само admin (виж PROTECTED_API_PREFIXES в middleware.ts)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const label = (body.label || '').trim()
    if (!label) return NextResponse.json({ error: 'Липсва име на категорията' }, { status: 400 })

    const slug = (body.slug ? String(body.slug) : slugify(label)).trim()
    if (!slug) return NextResponse.json({ error: 'Невалиден slug' }, { status: 400 })

    const { data: existing } = await supabaseAdmin.from('blog_categories').select('slug').eq('slug', slug).maybeSingle()
    if (existing) return NextResponse.json({ error: `Категория с slug „${slug}" вече съществува` }, { status: 409 })

    const { data: maxRow } = await supabaseAdmin
      .from('blog_categories').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
    const nextSortOrder = (maxRow?.sort_order || 0) + 1

    const { data, error } = await supabaseAdmin
      .from('blog_categories')
      .insert({ slug, label, emoji: body.emoji || '📗', sort_order: body.sort_order ?? nextSortOrder, active: true })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ category: data })
  } catch (err: any) {
    console.error('[api/blog-categories POST]', err)
    return NextResponse.json({ error: err.message || 'Грешка при създаване' }, { status: 500 })
  }
}
