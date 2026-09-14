// app/api/analytics/product-event/route.ts — v1
// ✅ НОВ endpoint — funnel tracking за СОБСТВЕНИ продукти (Atlas Terra).
//    Паралелен на app/api/analytics/affiliate-click/route.ts, но за
//    'add_to_cart'/'checkout_started' събития вместо изходящи кликове.
//
// ⚠️ ИЗИСКВА нова таблица в Supabase — виж SQL по-долу в коментара.
//    Пусни го веднъж в Supabase SQL editor-а преди да deploy-неш това:
//
//    create table product_events (
//      id            uuid primary key default gen_random_uuid(),
//      event_type    text not null check (event_type in ('add_to_cart','checkout_started')),
//      product_slug  text not null,
//      visitor_id    text,
//      created_at    timestamptz not null default now()
//    );
//    create index idx_product_events_slug on product_events(product_slug);
//    create index idx_product_events_created on product_events(created_at);

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const VALID_EVENTS = new Set(['add_to_cart', 'checkout_started'])

function sanitizeSlug(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 80)
  return s.length >= 2 ? s : null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { event_type, product_slug, visitor_id } = body

    if (!VALID_EVENTS.has(event_type)) {
      return NextResponse.json({ success: false, error: 'Invalid event_type' }, { status: 400 })
    }
    const slug = sanitizeSlug(product_slug)
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Invalid product_slug' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('product_events').insert({
      event_type,
      product_slug: slug,
      visitor_id:   typeof visitor_id === 'string' ? visitor_id.slice(0, 100) : null,
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

// ─── GET — обобщена статистика по продукт/event тип, последните 90 дни ──────
export async function GET() {
  try {
    const since = new Date(Date.now() - 90 * 86400000).toISOString()
    const { data, error } = await supabaseAdmin
      .from('product_events')
      .select('event_type, product_slug, created_at')
      .gte('created_at', since)
      .limit(50000)

    if (error) throw error

    const byProduct: Record<string, { add_to_cart: number; checkout_started: number }> = {}
    for (const row of data || []) {
      if (!byProduct[row.product_slug]) {
        byProduct[row.product_slug] = { add_to_cart: 0, checkout_started: 0 }
      }
      if (row.event_type === 'add_to_cart')       byProduct[row.product_slug].add_to_cart++
      if (row.event_type === 'checkout_started')  byProduct[row.product_slug].checkout_started++
    }

    return NextResponse.json({ byProduct }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[product-event GET]', err)
    return NextResponse.json({ byProduct: {} }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
