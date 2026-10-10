// app/api/blog-categories/[slug]/route.ts — v2
// ✅ v2 (спрямо v1):
//   • PATCH: празно име → 400; несъществуваща категория → 404 (преди 500);
//     revalidatePath на /blog и /blog/[slug] — архивирането/преименуването
//     се вижда на публичния сайт веднага, не след 5 минути.
//   • DELETE: проверката "ползва се ли" брои само АКТИВНИ постове (преди
//     броеше и изтритите — категория без видими постове не можеше да се
//     изтрие, а съобщението обясняваше невярно).

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try {
    const body = await req.json()
    const update: Record<string, unknown> = {}
    if (typeof body.label === 'string') {
      const label = body.label.trim()
      if (!label) return NextResponse.json({ error: 'Името не може да е празно' }, { status: 400 })
      update.label = label
    }
    if (typeof body.emoji === 'string') update.emoji = body.emoji.trim()
    if (typeof body.sort_order === 'number') update.sort_order = body.sort_order
    if (typeof body.active === 'boolean') update.active = body.active

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Няма какво да се обнови' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('blog_categories').update(update).eq('slug', slug).select().maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Категорията не е намерена' }, { status: 404 })

    revalidatePath('/blog')
    revalidatePath(`/blog/${slug}`)
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
      .from('blog_posts').select('id', { count: 'exact', head: true })
      .eq('category', slug).eq('active', true)

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Тази категория се ползва от ${count} пост(а). Архивирай я вместо да я триеш, или първо смени категорията на тези постове.` },
        { status: 409 }
      )
    }

    const { error } = await supabaseAdmin.from('blog_categories').delete().eq('slug', slug)
    if (error) throw error

    revalidatePath('/blog')
    revalidatePath(`/blog/${slug}`)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[api/blog-categories DELETE]', err)
    return NextResponse.json({ error: err.message || 'Грешка при изтриване' }, { status: 500 })
  }
}
