// app/api/blog-categories/route.ts — v2
// ✅ v2 (спрямо v1):
//   • GET ?includeInactive=1 — само за админ (isAdminRequest). Преди GET
//     връщаше САМО активните → архивирана категория изчезваше от админ
//     панела и не можеше да бъде върната (бутонът 👁️ беше мъртъв), а
//     постовете ѝ излизаха като "изтрита категория" в SEO и здраве.
//     Публичният отговор (без параметър / не-админ) е непроменен.
//   • POST: slug се прави с транслитерация (Торене → torene) вместо
//     кирилица в URL-а; приема се и ръчен slug; проверява се за колизия
//     и с категории, и с постове (/blog/[slug] обслужва и двете).
//   • revalidatePath след промяна — публичните страници се обновяват веднага.

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'
import { slugifyBg, isValidSlug } from '@/lib/blog'
import { isAdminRequest } from '@/lib/admin-guard'

// ✅ GET е публичен (виж middleware.ts isPublicApiRequest) — /blog и
//    admin панелът четат от тук по еднакъв начин, никога hardcoded списък.
export async function GET(req: NextRequest) {
  try {
    const wantsAll = new URL(req.url).searchParams.get('includeInactive') === '1'
    const includeInactive = wantsAll && (await isAdminRequest(req))

    let query = supabaseAdmin
      .from('blog_categories')
      .select('*')
      .order('sort_order', { ascending: true })
    if (!includeInactive) query = query.eq('active', true)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ categories: data || [] })
  } catch (err: any) {
    console.error('[api/blog-categories GET]', err)
    return NextResponse.json({ error: 'Грешка при зареждане на категориите' }, { status: 500 })
  }
}

// POST — само admin (middleware: всичко под /api освен публичните изключения)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const label = (body.label || '').trim()
    if (!label) return NextResponse.json({ error: 'Липсва име на категорията' }, { status: 400 })

    const slug = (body.slug ? String(body.slug).trim().toLowerCase() : slugifyBg(label, 40))
    if (!isValidSlug(slug)) {
      return NextResponse.json(
        { error: 'Невалиден slug — използвай малки латински букви, цифри и тирета (напр. torene)' },
        { status: 400 },
      )
    }

    const { data: existing } = await supabaseAdmin.from('blog_categories').select('slug').eq('slug', slug).maybeSingle()
    if (existing) return NextResponse.json({ error: `Категория с slug „${slug}“ вече съществува` }, { status: 409 })

    // ✅ /blog/[slug] обслужва и постове — категория със същия slug би скрила поста.
    const { data: postClash } = await supabaseAdmin.from('blog_posts').select('id').eq('slug', slug).maybeSingle()
    if (postClash) {
      return NextResponse.json(
        { error: `Slug „${slug}“ съвпада с адреса на съществуващ пост — избери друг` },
        { status: 409 },
      )
    }

    const { data: maxRow } = await supabaseAdmin
      .from('blog_categories').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
    const nextSortOrder = (maxRow?.sort_order || 0) + 1

    const { data, error } = await supabaseAdmin
      .from('blog_categories')
      .insert({ slug, label, emoji: body.emoji || '📗', sort_order: body.sort_order ?? nextSortOrder, active: true })
      .select()
      .single()

    if (error) throw error
    revalidatePath('/blog')
    return NextResponse.json({ category: data })
  } catch (err: any) {
    console.error('[api/blog-categories POST]', err)
    return NextResponse.json({ error: err.message || 'Грешка при създаване' }, { status: 500 })
  }
}
