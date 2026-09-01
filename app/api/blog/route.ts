// app/api/blog/route.ts
// ✅ GET  — публичен (middleware го пропуска, виж isPublicApiRequest)
//    По подразбиране връща само публикувани, активни постове, сортирани
//    по publish дата. ?slug=xxx връща конкретен пост (публичен, за
//    /blog/[slug]). ?status=all&admin=1 не съществува нарочно — admin
//    четенето минава през /api/blog/[id] или директно през списъка,
//    защитен от middleware за всичко различно от чист GET.
// ✅ POST — admin only (защитено от middleware, виж PROTECTED_API_PREFIXES)
// ✅ revalidatePath при POST — /blog веднага показва новия пост

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

    // Auto-генерация на slug от title ако не е подаден
    if (!body.slug && body.title) {
      body.slug = body.title
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '')
        .replace(/--+/g, '-')
    }
    if (!body.slug) {
      return NextResponse.json({ error: 'Slug е задължителен' }, { status: 400 })
    }

    // Автоматично изчисляваме четивното време от content блоковете
    if (Array.isArray(body.content)) {
      body.reading_time_minutes = estimateReadingTime(body.content)
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

    return NextResponse.json({ post: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500 })
  }
}
