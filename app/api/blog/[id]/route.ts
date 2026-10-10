// app/api/blog/[id]/route.ts — v2
// ✅ PATCH  — обновява конкретен пост (admin only)
// ✅ DELETE — архивира конкретен пост (soft delete, admin only)
// ✅ GET по ID — admin only (всичко под /api освен публичните изключения
//    в middleware.ts е защитено)
//
// ✅ v2 (спрямо v1):
//   1) published_at се слага САМО при реален преход чернова → публикуван
//      (когато постът още няма дата). Преди всеки PATCH със status=
//      'published' без дата в тялото я презаписваше с "сега".
//   2) created_at/updated_at от клиента се игнорират (updated_at се слага
//      от trigger trg_blog_posts_updated_at — клиентът пращаше старата).
//   3) Смяна на slug: валидира се форматът, проверява се колизия с категория
//      и се revalidate-ва СТАРИЯТ адрес (иначе остава в кеша до 5 мин).
//   4) has_affiliate_links се включва автоматично при affiliate embed.
//   5) DELETE (soft) освобождава slug-а: slug → "<slug>--deleted-<id>".
//      blog_posts.slug е UNIQUE — преди изтрит пост държеше адреса си
//      завинаги и нов пост със същия slug гърмеше с Postgres грешка.
//   6) Ясни 404/409 вместо общ 500.
//
// ✅ (запазено) auto-excerpt от първия paragraph, ако excerpt е изчистен.
// ✅ (запазено) revalidate на /blog, /, /blog/[slug], /blog/[category] и на
//    старата категория при преместване.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { estimateReadingTime, hasAffiliateEmbeds, isValidSlug } from '@/lib/blog'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'ID е задължителен' }, { status: 400 })

    const body = await req.json()
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = body

    // ✅ Старото състояние ПРЕДИ update-а — за published_at, slug и revalidate.
    const { data: before } = await supabaseAdmin
      .from('blog_posts').select('slug, category, status, published_at').eq('id', id).maybeSingle()
    if (!before) return NextResponse.json({ error: 'Постът не е намерен' }, { status: 404 })

    if ('slug' in rest) {
      const newSlug = typeof rest.slug === 'string' ? rest.slug.trim() : ''
      if (!newSlug) return NextResponse.json({ error: 'Slug е задължителен' }, { status: 400 })
      rest.slug = newSlug
      if (newSlug !== before.slug) {
        if (!isValidSlug(newSlug)) {
          return NextResponse.json(
            { error: 'Slug трябва да е с малки латински букви, цифри и тирета (напр. lipsa-na-kalciy-domati)' },
            { status: 400 },
          )
        }
        const { data: catClash } = await supabaseAdmin
          .from('blog_categories').select('slug').eq('slug', newSlug).maybeSingle()
        if (catClash) {
          return NextResponse.json(
            { error: `Slug „${newSlug}“ съвпада със съществуваща категория — избери друг` },
            { status: 409 },
          )
        }
      }
    }

    if (Array.isArray(rest.content)) {
      rest.reading_time_minutes = estimateReadingTime(rest.content)
      if (hasAffiliateEmbeds(rest.content)) rest.has_affiliate_links = true

      if (!rest.excerpt) {
        const firstParagraph = rest.content.find((b: any) => b.type === 'paragraph')
        if (firstParagraph?.text) {
          const text = String(firstParagraph.text).trim()
          rest.excerpt = text.length > 160 ? text.slice(0, 159).trimEnd() + '…' : text
        }
      }
    }

    // ✅ v2: дата на публикуване — само ако още няма такава.
    if (rest.published_at === '') delete rest.published_at
    if (rest.status === 'published' && !rest.published_at && !before.published_at) {
      rest.published_at = new Date().toISOString()
    }

    const payload = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined)
    )

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'Няма полета за обновяване' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[blog PATCH]', error)
      if ((error as any).code === '23505') {
        return NextResponse.json({ error: `Slug „${rest.slug}“ вече е зает от друг пост` }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidatePath('/blog')
    revalidatePath('/')
    if (data?.slug) revalidatePath(`/blog/${data.slug}`)
    if (before.slug && before.slug !== data?.slug) revalidatePath(`/blog/${before.slug}`)
    if (data?.category) revalidatePath(`/blog/${data.category}`)
    if (before.category && before.category !== data?.category) {
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
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'Постът не е намерен' }, { status: 404 })

    // ✅ soft-delete + освобождаване на slug-а (UNIQUE constraint).
    const alreadyTagged = /--deleted-/.test(existing.slug || '')
    const freedSlug = alreadyTagged
      ? existing.slug
      : `${existing.slug}--deleted-${Date.now().toString(36)}`

    const { error } = await supabaseAdmin
      .from('blog_posts')
      .update({ active: false, slug: freedSlug })
      .eq('id', id)

    if (error) {
      console.error('[blog DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidatePath('/blog')
    revalidatePath('/')
    if (existing.slug) revalidatePath(`/blog/${existing.slug}`)
    if (existing.category) revalidatePath(`/blog/${existing.category}`)

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
