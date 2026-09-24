// app/api/blog/route.ts
// ✅ GET  — публичен (middleware го пропуска, виж isPublicApiRequest)
//    По подразбиране връща само публикувани, активни постове, сортирани
//    по publish дата. ?slug=xxx връща конкретен пост (публичен, за
//    /blog/[slug]). ?status=all&admin=1 не съществува нарочно — admin
//    четенето минава през /api/blog/[id] или директно през списъка,
//    защитен от middleware за всичко различно от чист GET.
// ✅ POST — admin only (защитено от middleware, виж PROTECTED_API_PREFIXES)
// ✅ revalidatePath при POST — /blog веднага показва новия пост
//
// ✅ ФИКС: махнат е auto-slug fallback-ът (title → slug), който ползваше
//    replace(/[^\w-]/g, '') — \w в JS обхваща само [A-Za-z0-9_], значи
//    ВСЯКА кирилска буква отпадаше и заглавие на български даваше
//    практически празен/само-тирета slug. Тъй като slug-овете винаги се
//    пишат ръчно в BlogTab.tsx (правилно транслитерирани), по-безопасно е
//    просто да изискваме slug изрично, вместо тихо да генерираме нещо
//    счупено, ако полето някога остане празно.
//
// ✅ НОВО: ако excerpt не е попълнен ръчно, извеждаме го автоматично от
//    първия paragraph блок ПРИ ЗАПИС (тук), не runtime във всяка заявка
//    за списъка. Причината: app/blog/page.tsx getPublishedPosts() тегли
//    само леки колони, БЕЗ 'content' — значи deriveExcerpt() (lib/blog.ts)
//    никога няма достъп до content в контекста на картите в грида и
//    fallback-ът ѝ там реално е мъртъв код. Записвайки excerpt в базата
//    директно тук, картите винаги имат текст, без допълнителна заявка.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { estimateReadingTime } from '@/lib/blog'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug     = searchParams.get('slug')
  const category = searchParams.get('category')
  const limit     = searchParams.get('limit')
  // ✅ само admin панелът пита с includeDrafts=1 — САМО POST/PATCH/DELETE
  //    са защитени от middleware, но пазим по подразбиране публично
  //    видимо да е само 'published', за да не изтича draft съдържание.
  const includeDrafts = searchParams.get('includeDrafts') === '1'

  let query = supabaseAdmin
    .from('blog_posts')
    .select('*')
    .eq('active', true)
    .order('published_at', { ascending: false })

  if (!includeDrafts) query = query.eq('status', 'published')
  if (slug)            query = query.eq('slug', slug)
  if (category)        query = query.eq('category', category)
  if (limit)            query = query.limit(Number(limit))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data || [] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // ✅ ФИКС: преди тук имаше auto-генерация на slug от title, която
    //    чупеше кирилица (виж коментара горе). Сега просто изискваме
    //    slug да е подаден явно — BlogTab.tsx винаги го праща ръчно.
    if (!body.slug) {
      return NextResponse.json({ error: 'Slug е задължителен' }, { status: 400 })
    }

    // Автоматично изчисляваме четивното време от content блоковете
    if (Array.isArray(body.content)) {
      body.reading_time_minutes = estimateReadingTime(body.content)
    }

    // ✅ НОВО: auto-excerpt от първия paragraph, ако не е попълнен ръчно —
    //    виж обяснението в коментара най-горе.
    if (!body.excerpt && Array.isArray(body.content)) {
      const firstParagraph = body.content.find((b: any) => b.type === 'paragraph')
      if (firstParagraph?.text) {
        const text = String(firstParagraph.text).trim()
        body.excerpt = text.length > 160 ? text.slice(0, 159).trimEnd() + '…' : text
      }
    }

    // Ако статусът се сменя на 'published' и няма published_at — слагаме сега
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    revalidatePath('/blog')
    revalidatePath('/')
    // ✅ Нов пост в категория — hub страницата на категорията също трябва
    //    веднага да го покаже.
    if (data?.category) revalidatePath(`/blog/${data.category}`)

    return NextResponse.json({ post: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500 })
  }
}
