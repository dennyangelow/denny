// app/api/blog/[id]/route.ts
// ✅ PATCH  — обновява конкретен пост (admin only)
// ✅ DELETE — изтрива конкретен пост (admin only)
// ✅ GET по ID — admin only (за директно зареждане в редактора)
// ✅ revalidatePath при промяна → /blog, /blog/[slug] и началната страница

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
      .select('slug')
      .eq('id', id)
      .single()

    const { error } = await supabaseAdmin
      .from('blog_posts')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[blog DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidatePath('/blog')
    revalidatePath('/')
    if (existing?.slug) revalidatePath(`/blog/${existing.slug}`)

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
