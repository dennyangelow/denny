// app/api/admin/naruchnici/[id]/seo/route.ts — v2
//
// ПОПРАВКИ v2 (спрямо v1):
//   ✅ 'faq' е в списъка с разрешени полета. NaruchnikSeoTab.tsx праща
//      `faq: [...]` (неограничен списък), но v1 го НЕ пропускаше — сървърът
//      мълчаливо го изхвърляше, връщаше { ok: true }, табът показваше
//      "SEO данните са запазени!", а в базата FAQ-ът оставаше стар.
//   ✅ Махнати reviews_count / avg_rating / testimonials — тези колони вече
//      не съществуват в naruchnici (отзивите са в таблица `reviews`).
//   ✅ Махнат downloads_count — ръчно въвеждано число, което никъде на
//      сайта не се чете вече (реалният брой идва от leads, виж
//      lib/social-proof.ts getHandbookDownloadCounts).
//   ✅ Отговорът вече казва кои полета са запазени и кои са игнорирани
//      ({ saved: [...], ignored: [...] }) — така един бъдещ бъг от типа
//      "табът праща поле, което сървърът не знае" се вижда веднага,
//      вместо да се губят данни тихо.
//   ✅ FAQ се чисти преди запис (trim, празни двойки се махат, таван на
//      броя и дължината) — отива директно във FAQPage JSON-LD.
//   ✅ Празен/интервален текст → null; водещи интервали във meta_title се
//      махат (в базата имаше ' Наръчник за Едри Домати ...').
//   ✅ .maybeSingle() вместо .single() — при несъществуващ id вече се
//      връща 404, а не 500 (404 клонът в v1 беше недостижим).
//
// ⚠️ Автентикацията се очаква от middleware (както в останалите admin
//    routes). Самият файл не проверява cookie — виж бележката в чата.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

// Прости текстови колони
const TEXT_FIELDS = [
  'meta_title', 'meta_description',
  'content_body', 'author_bio',
  // Стари фиксирани FAQ полета — остават, докато табът още ги праща
  'faq_q1', 'faq_a1',
  'faq_q2', 'faq_a2',
  'faq_q3', 'faq_a3',
] as const

const MAX_FAQ_ITEMS = 30
const MAX_Q_LEN     = 300
const MAX_A_LEN     = 3000

function cleanFaq(raw: unknown): { q: string; a: string }[] | null {
  if (!Array.isArray(raw)) return null
  return raw
    .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
    .map(f => ({
      q: String(f.q ?? '').trim().slice(0, MAX_Q_LEN),
      a: String(f.a ?? '').trim().slice(0, MAX_A_LEN),
    }))
    .filter(f => f.q && f.a)
    .slice(0, MAX_FAQ_ITEMS)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Невалидно тяло на заявката' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    const ignored: string[] = []

    for (const key of Object.keys(body)) {
      if ((TEXT_FIELDS as readonly string[]).includes(key)) {
        const v = (body as Record<string, unknown>)[key]
        updates[key] = typeof v === 'string' && v.trim() ? v.trim() : null
      } else if (key === 'faq') {
        const faq = cleanFaq((body as Record<string, unknown>).faq)
        if (faq === null) {
          return NextResponse.json({ error: 'faq трябва да е масив от { q, a }' }, { status: 400 })
        }
        updates.faq = faq
      } else {
        ignored.push(key)
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Няма валидни полета за запис', ignored },
        { status: 400 },
      )
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('naruchnici')
      .update(updates)
      .eq('id', params.id)
      .select('id, slug')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data)  return NextResponse.json({ error: 'Не е намерено' }, { status: 404 })

    revalidatePath(`/naruchnik/${data.slug}`)
    revalidatePath('/naruchnici') // безвреден no-op, ако такъв route няма

    return NextResponse.json({
      ok: true,
      slug: data.slug,
      saved: Object.keys(updates).filter(k => k !== 'updated_at'),
      ignored,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500 })
  }
}
