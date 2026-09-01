// app/api/blog-categories/[slug]/route.ts — v1
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try {
    const body = await req.json()
    const update: Record<string, unknown> = {}
    if (typeof body.label === 'string') update.label = body.label.trim()
    if (typeof body.emoji === 'string') update.emoji = body.emoji.trim()
    if (typeof body.sort_order === 'number') update.sort_order = body.sort_order
    if (typeof body.active === 'boolean') update.active = body.active

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Няма какво да се обнови' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('blog_categories').update(update).eq('slug', slug).select().single()

    if (error) throw error
    return NextResponse.json({ category: data })
  } catch (err: any) {
    console.error('[api/blog-categories PATCH]', err)
    return NextResponse.json({ error: err.message || 'Грешка при обновяване' }, { status: 500 })
  }
}

// ✅ Пази от "изчезнала" категория под вече публикувани постове — ако има
//    постове с тази категория, отказва и предлага архивиране (active=false)
//    вместо трайно изтриване.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try {
    const { count } = await supabaseAdmin
      .from('blog_posts').select('id', { count: 'exact', head: true }).eq('category', slug)

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Тази категория се ползва от ${count} пост(а). Архивирай я вместо да я триеш, или първо смени категорията на тези постове.` },
        { status: 409 }
      )
    }

    const { error } = await supabaseAdmin.from('blog_categories').delete().eq('slug', slug)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[api/blog-categories DELETE]', err)
    return NextResponse.json({ error: err.message || 'Грешка при изтриване' }, { status: 500 })
  }
}
