// app/api/reviews/submit/route.ts — v1
// Публичен endpoint — всеки посетител може да го извика, БЕЗ admin token.
// ⚠️ Съзнателно различен от /api/reviews (admin CRUD, защитен в middleware.ts):
// - Приема САМО безопасните полета за публичен вход (виж ALLOWED вписването)
// - Игнорира всичко друго, дори ако е пратено (status/verified/featured_home
//   не могат да бъдат зададени оттук — форсирани на сървъра)
// - Rate-limited по IP — предпазва от спам/флууд
// - Валидира текста/името през lib/validation.ts (същия механизъм като
//   формата за лийдове)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, getIP } from '@/lib/rate-limit'
import { validateName } from '@/lib/validation'

const VALID_ENTITY_TYPES = ['own_product', 'affiliate_product', 'handbook']

export async function POST(req: NextRequest) {
  try {
    // ── Rate limit: 5 отзива / час на IP, lockout 24ч след 10 опита ─────────
    const ip = getIP(req)
    const limit = rateLimit(`review_submit:${ip}`, {
      limit: 5, window: 3600,
      lockoutLimit: 10, lockoutWindow: 24 * 3600,
    })
    if (!limit.success) {
      return NextResponse.json(
        { error: limit.locked ? 'Твърде много опити. Опитай по-късно.' : 'Твърде много отзиви за кратко време.' },
        { status: 429 }
      )
    }

    const body = await req.json()

    // ── Строг whitelist — само тези полета минават, всичко друго се игнорира ─
    const entity_type     = String(body.entity_type || '')
    const entity_id       = String(body.entity_id || '')
    const author_name     = String(body.author_name || '').trim()
    const author_location = body.author_location ? String(body.author_location).trim().slice(0, 100) : null
    const rating           = Number(body.rating)
    const text              = String(body.text || '').trim()

    if (!VALID_ENTITY_TYPES.includes(entity_type)) {
      return NextResponse.json({ error: 'Невалиден тип продукт' }, { status: 400 })
    }
    if (!entity_id) {
      return NextResponse.json({ error: 'Липсва продукт' }, { status: 400 })
    }
    const nameErr = validateName(author_name)
    if (nameErr) {
      return NextResponse.json({ error: nameErr }, { status: 400 })
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Оценката трябва да е между 1 и 5' }, { status: 400 })
    }
    if (text.length < 10) {
      return NextResponse.json({ error: 'Текстът е твърде кратък (мин. 10 символа)' }, { status: 400 })
    }
    if (text.length > 2000) {
      return NextResponse.json({ error: 'Текстът е твърде дълъг (макс. 2000 символа)' }, { status: 400 })
    }

    // ── Проверка, че entity_id реално съществува (предпазва от боклук) ──────
    const table = entity_type === 'own_product' ? 'products'
                : entity_type === 'affiliate_product' ? 'affiliate_products'
                : 'naruchnici'
    const { data: entity } = await supabaseAdmin.from(table).select('id').eq('id', entity_id).maybeSingle()
    if (!entity) {
      return NextResponse.json({ error: 'Продуктът не е намерен' }, { status: 404 })
    }

    // ── Insert — status/verified/featured_home ФОРСИРАНИ тук, не от body ────
    const { error } = await supabaseAdmin.from('reviews').insert({
      entity_type,
      entity_id,
      author_name,
      author_location,
      rating,
      text,
      source:         'site_form',
      verified:       false,
      featured_home:  false,
      status:         'pending',   // ⚠️ ВИНАГИ pending — публичен вход никога не излиза направо на живо
    })

    if (error) {
      console.error('[reviews/submit] insert error:', error)
      return NextResponse.json({ error: 'Грешка при запис' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Благодарим! Отзивът ти чака одобрение.' }, { status: 201 })
  } catch (err: any) {
    console.error('[reviews/submit] error:', err)
    return NextResponse.json({ error: 'Сървърна грешка' }, { status: 500 })
  }
}
