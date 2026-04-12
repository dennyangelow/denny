// app/api/admin/naruchnici/[id]/seo/route.ts
// PATCH — обновява само SEO полетата на наръчник

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

const SEO_FIELDS = [
  'meta_title', 'meta_description',
  'faq_q1', 'faq_a1',
  'faq_q2', 'faq_a2',
  'faq_q3', 'faq_a3',
  'content_body', 'author_bio',
  'reviews_count', 'avg_rating', 'downloads_count',
] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()

    // Само позволените SEO полета — нищо друго
    const updates: Record<string, unknown> = {}
    for (const field of SEO_FIELDS) {
      if (field in body) {
        updates[field] = body[field]
      }
    }
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('naruchnici')
      .update(updates)
      .eq('id', params.id)
      .select('id, slug')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data)  return NextResponse.json({ error: 'Не е намерено' }, { status: 404 })

    // Revalidate страницата на наръчника веднага
    revalidatePath(`/naruchnik/${data.slug}`)
    revalidatePath('/naruchnici')

    return NextResponse.json({ ok: true, slug: data.slug })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500 })
  }
}
