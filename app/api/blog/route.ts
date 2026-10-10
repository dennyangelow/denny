// app/api/blog/route.ts — v2
// ✅ GET  — публичен (middleware го пропуска, виж isPublicApiRequest)
//    По подразбиране връща само публикувани, активни постове. ?slug=xxx
//    връща конкретен пост (публичен, за /blog/[slug]).
// ✅ POST — admin only (middleware: всичко под /api е защитено, освен
//    изрично изброените публични изключения — fail-closed).
//
// ✅ v2 (спрямо v1):
//   1) includeDrafts=1 вече работи САМО за влязъл админ (isAdminRequest).
//      Преди: всеки, който знаеше параметъра, четеше чернови и архивирани
//      постове (пълното им съдържание). Публична заявка с includeDrafts=1
//      НЕ дава грешка — просто получава публичния (published) резултат.
//   2) has_affiliate_links се включва автоматично, ако съдържанието има
//      affiliate product_embed (преди зависеше от ръчна отметка — 3 от 7
//      поста нямаха disclosure банер, макар да съдържаха affiliate продукти).
//      Ръчно включен флаг се пази (може да има affiliate линкове в текста).
//   3) slug: валидация на формата (малки латински букви/цифри/тирета),
//      проверка за колизия с категория (/blog/[slug] обслужва и категориите,
//      категорията има предимство → постът щеше да стане недостъпен) и
//      ясно съобщение при зает slug (409), вместо суров Postgres текст.
//   4) limit се нормализира (преди Number('abc') даваше NaN → грешка).
//   5) updated_at/created_at от клиента се игнорират (updated_at се слага от
//      trigger trg_blog_posts_updated_at).
//
// ✅ (запазено от v1) auto-slug fallback е премахнат — Cyrillic се губеше
//    с /[^\w-]/; slug се подава изрично от BlogTab.
// ✅ (запазено) auto-excerpt от първия paragraph при запис, ако не е попълнен.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { estimateReadingTime, hasAffiliateEmbeds, isValidSlug } from '@/lib/blog'
import { isAdminRequest } from '@/lib/admin-guard'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug     = searchParams.get('slug')
  const category = searchParams.get('category')
  const limitRaw = parseInt(searchParams.get('limit') || '', 10)

  // ✅ v2: чернови/архивирани — само за админ. Всички останали → published.
  const wantsDrafts   = searchParams.get('includeDrafts') === '1'
  const includeDrafts = wantsDrafts && (await isAdminRequest(req))

  let query = supabaseAdmin
    .from('blog_posts')
    .select('*')
    .eq('active', true)
    .order('published_at', { ascending: false })

  if (!includeDrafts) query = query.eq('status', 'published')
  if (slug)            query = query.eq('slug', slug)
  if (category)        query = query.eq('category', category)
  if (Number.isFinite(limitRaw) && limitRaw > 0) query = query.limit(Math.min(limitRaw, 200))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data || [] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.slug || typeof body.slug !== 'string') {
      return NextResponse.json({ error: 'Slug е задължителен' }, { status: 400 })
    }
    body.slug = body.slug.trim()
    if (!isValidSlug(body.slug)) {
      return NextResponse.json(
        { error: 'Slug трябва да е с малки латински букви, цифри и тирета (напр. lipsa-na-kalciy-domati)' },
        { status: 400 },
      )
    }

    // /blog/[slug] обслужва и категориите — категорията печели, постът би бил недостъпен.
    const { data: catClash } = await supabaseAdmin
      .from('blog_categories').select('slug').eq('slug', body.slug).maybeSingle()
    if (catClash) {
      return NextResponse.json(
        { error: `Slug „${body.slug}“ съвпада със съществуваща категория — избери друг` },
        { status: 409 },
      )
    }

    delete body.created_at
    delete body.updated_at

    if (Array.isArray(body.content)) {
      body.reading_time_minutes = estimateReadingTime(body.content)
      // ✅ v2: авто-флаг за affiliate disclosure
      if (hasAffiliateEmbeds(body.content)) body.has_affiliate_links = true
    }

    if (!body.excerpt && Array.isArray(body.content)) {
      const firstParagraph = body.content.find((b: any) => b.type === 'paragraph')
      if (firstParagraph?.text) {
        const text = String(firstParagraph.text).trim()
        body.excerpt = text.length > 160 ? text.slice(0, 159).trimEnd() + '…' : text
      }
    }

    if (body.status === 'published' && !body.published_at) {
      body.published_at = new Date().toISOString()
    }

    const { id, ...rest } = body
    const payload = id ? { id, ...rest } : rest

    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .insert(payload)
      .select()
      .single()

    if (error) {
      if ((error as any).code === '23505') {
        return NextResponse.json(
          { error: `Slug „${body.slug}“ вече е зает от друг пост` },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidatePath('/blog')
    revalidatePath('/')
    if (data?.category) revalidatePath(`/blog/${data.category}`)

    return NextResponse.json({ post: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500 })
  }
}
