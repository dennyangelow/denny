// app/api/analytics/product-event/route.ts — v3
// ✅ v3: твоите тестове (localhost, dev, IP от ANALYTICS_EXCLUDE_IPS, устройство с ?da_internal=1) се
//    записват с is_internal=true и не влизат в статистиката (колоната е в product_events_and_affiliate.sql).
// ✅ v2 спрямо v1:
//   • POST: rate limit (60/мин по IP) и филтър за ботове — преди всеки можеше да
//     залее таблицата с фалшиви add_to_cart събития.
//   • GET: чете ПО СТРАНИЦИ от 1000 реда. v1 викаше .limit(50000), но Supabase връща
//     най-много 1000 реда на заявка — при повече събития цифрите тихо се
//     занижаваха. Освен това при грешка вече връща 500, а не празен обект.
//   • GET: добавя uniqueByProduct (уникални посетители). byProduct е брой СЪБИТИЯ —
//     един човек, натиснал "в количката" 5 пъти, се брои 5 пъти; за фуния е нужно
//     колко ХОРА са го направили.
//
//    Таблицата product_events е описана в v1 (event_type, product_slug, visitor_id, created_at).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, getIP } from '@/lib/rate-limit'

const VALID_EVENTS = new Set(['add_to_cart', 'checkout_started'])
const BOT_UA = /bot|crawler|spider|headless|lighthouse|pagespeed|googlebot|bingbot|semrush|ahrefsbot|python-requests|axios|node-fetch|go-http|curl\//i
const VISITOR_RE = /^[A-Za-z0-9_-]{6,64}$/
const PAGE = 1000
const LOCAL_IPS = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1'])

function sanitizeSlug(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 80)
  return s.length >= 2 ? s : null
}

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req)
    const rl = rateLimit(`pe:${ip}`, { limit: 60, window: 60 })
    if (!rl.success) return NextResponse.json({ success: false, error: 'rate_limited' }, { status: 429 })

    const ua = req.headers.get('user-agent') || ''
    if (!ua || BOT_UA.test(ua)) return NextResponse.json({ success: true, skipped: 'bot' })

    const body = await req.json().catch(() => ({}))
    const { event_type, product_slug, visitor_id, internal } = body

    if (!VALID_EVENTS.has(event_type)) {
      return NextResponse.json({ success: false, error: 'Invalid event_type' }, { status: 400 })
    }
    const slug = sanitizeSlug(product_slug)
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Invalid product_slug' }, { status: 400 })
    }

    const excluded = (process.env.ANALYTICS_EXCLUDE_IPS || '').split(',').map(x => x.trim()).filter(Boolean)
    const is_internal =
      process.env.NODE_ENV !== 'production' ||
      LOCAL_IPS.has(ip) || excluded.includes(ip) || /^(localhost|127\.)/.test(req.headers.get('host') || '') ||
      internal === true

    const { error } = await supabaseAdmin.from('product_events').insert({
      is_internal,
      event_type,
      product_slug: slug,
      visitor_id:   typeof visitor_id === 'string' && VISITOR_RE.test(visitor_id) ? visitor_id : null,
      created_at:   new Date().toISOString(),
    })

    if (error) {
      console.error('[product-event POST]', error.message)
      return NextResponse.json({ success: false })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[product-event POST] catch:', err)
    return NextResponse.json({ success: false })
  }
}

// ─── GET — статистика по продукт, последните 90 дни (admin) ─────────────────
export async function GET() {
  try {
    const since = new Date(Date.now() - 90 * 86400000).toISOString()

    const rows: { event_type: string; product_slug: string; visitor_id: string | null }[] = []
    for (let from = 0; from < 200000; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from('product_events')
        .select('event_type, product_slug, visitor_id')
        .gte('created_at', since)
        .eq('is_internal', false)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1)
      if (error) throw error
      rows.push(...(data || []))
      if (!data || data.length < PAGE) break
    }

    const byProduct: Record<string, { add_to_cart: number; checkout_started: number }> = {}
    const seen: Record<string, { add_to_cart: Set<string>; checkout_started: Set<string> }> = {}
    let anon = 0
    for (const row of rows) {
      const slug = row.product_slug
      if (!byProduct[slug]) {
        byProduct[slug] = { add_to_cart: 0, checkout_started: 0 }
        seen[slug] = { add_to_cart: new Set(), checkout_started: new Set() }
      }
      const t = row.event_type as 'add_to_cart' | 'checkout_started'
      if (t !== 'add_to_cart' && t !== 'checkout_started') continue
      byProduct[slug][t]++
      seen[slug][t].add(row.visitor_id || `anon-${anon++}`)   // без visitor_id → всеки е отделен човек
    }

    const uniqueByProduct: Record<string, { add_to_cart: number; checkout_started: number }> = {}
    for (const [slug, s] of Object.entries(seen)) {
      uniqueByProduct[slug] = { add_to_cart: s.add_to_cart.size, checkout_started: s.checkout_started.size }
    }

    return NextResponse.json({ byProduct, uniqueByProduct }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: any) {
    console.error('[product-event GET]', err?.message || err)
    return NextResponse.json({ error: 'Статистиката не може да се изчисли', detail: err?.message }, { status: 500 })
  }
}
