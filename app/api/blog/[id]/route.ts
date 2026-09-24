// app/api/blog/[id]/route.ts
// ✅ PATCH  — обновява конкретен пост (admin only)
// ✅ DELETE — архивира конкретен пост (admin only) — виж ФИКС по-долу
// ✅ GET по ID — admin only (за директно зареждане в редактора)
// ✅ revalidatePath при промяна → /blog, /blog/[slug], /blog/[category] и началната страница
//
// ✅ ФИКС: PATCH преди не revalidate-ваше категорийната hub страница
//    (/blog/[category-slug]) при редакция на пост — значи ако смениш
//    заглавие/съдържание на публикуван пост, /blog и самата статия се
//    обновяваха веднага, но категорийният hub оставаше стар до изтичане
//    на 300-те секунди ISR прозорец. Сега добавяме revalidatePath и за
//    старата, и за новата категория (ако е сменена в тази редакция).
//
// ✅ ФИКС: DELETE преди трайно трieше реда от blog_posts — единствено
//    място в проекта, което прави hard delete, докато продуктите и
//    категориите последователно ползват active=false (archiving). Сменено
//    на soft-delete за консистентност и възможност за възстановяване.
//    GET-заявките навсякъде вече филтрират по .eq('active', true), значи
//    нищо друго не се чупи от тази смяна.
//
// ✅ НОВО: auto-excerpt от първия paragraph при PATCH, ако excerpt е
//    изчистен/липсва — виж същото обяснение в app/api/blog/route.ts.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { estimateReadingTime } from '@/lib/blog'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'ID е задължителен' }, { status: 400 })

    const body = await req.json()
    const { id: _id, ...rest } = body

    if (Array.isArray(rest.content)) {
      rest.reading_time_minutes = estimateReadingTime(rest.content)

      // ✅ НОВО: ако excerpt не е попълнен, изведи го от първия paragraph.
      if (!rest.excerpt) {
        const firstParagraph = rest.content.find((b: any) => b.type === 'paragraph')
        if (firstParagraph?.text) {
          const text = String(firstParagraph.text).trim()
          rest.excerpt = text.length > 160 ? text.slice(0, 159).trimEnd() + '…' : text
        }
      }
    }
    if (rest.status === 'published' && !rest.published_at) {
      rest.published_at = new Date().toISOString()
    }

    const payload = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined)
    )

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'Няма полета за обновяване' }, { status: 400 })
    }

    // ✅ Вземаме старата категория ПРЕДИ update-а, за да revalidate-нем и
    //    стария ѝ hub, ако постът е преместен в друга категория с това
    //    редактиране (иначе старата hub страница остава да го показва).
    const { data: before } = await supabaseAdmin
      .from('blog_posts').select('category').eq('id', id).maybeSingle()

    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[blog PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidatePath('/blog')
    revalidatePath('/')
    if (data?.slug) revalidatePath(`/blog/${data.slug}`)
    if (data?.category) revalidatePath(`/blog/${data.category}`)
    if (before?.category && before.category !== data?.category) {
      revalidatePath(`/blog/${before.category}`)
    }

    return NextResponse.json({ post: data })
  } catch (err: any) {
    console.error('[blog PATCH] catch:', err)
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'ID е задължителен' }, { status: 400 })

    const { data: existing } = await supabaseAdmin
      .from('blog_posts')
      .select('slug, category')
      .eq('id', id)
      .single()

    // ✅ ФИКС: soft-delete (active=false) вместо трайно .delete() —
    //    консистентно с продуктите/категориите в останалата част на
    //    проекта, и позволява възстановяване при грешка.
    const { error } = await supabaseAdmin
      .from('blog_posts')
      .update({ active: false })
      .eq('id', id)

    if (error) {
      console.error('[blog DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidatePath('/blog')
    revalidatePath('/')
    if (existing?.slug) revalidatePath(`/blog/${existing.slug}`)
    if (existing?.category) revalidatePath(`/blog/${existing.category}`)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[blog DELETE] catch:', err)
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json({ post: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
