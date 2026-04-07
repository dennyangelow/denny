// app/api/analytics/affiliate-click/route.ts — v4
// ПОПРАВКИ:
//  - POST: sanitizeSlug() почиства slug-а преди запис — никога null/"–" в БД
//  - POST: отхвърля записи без валиден slug с 400 (вместо да пише null)
//  - GET:  пропуска стари редове с null/empty slug при агрегиране

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const BOT_UA = /bot|crawler|spider|headless|lighthouse|pagespeed|googlebot|bingbot|semrush|ahrefsbot|python-requests|axios|node-fetch|go-http|curl\//i

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Почиства slug-а: lowercase, само ASCII букви/цифри/тирета, max 80 символа.
 * Връща null ако резултатът е твърде кратък/безсмислен.
 */
function sanitizeSlug(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null

  const s = raw.trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')   // само ASCII — кирилицата → тирета
    .replace(/-+/g, '-')             // слива двойни тирета
    .replace(/^-|-$/g, '')           // маха водещи/крайни тирета
    .slice(0, 80)

  if (s.length < 2 || s === '-') return null
  return s
}

// ─── POST — записва клик ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { partner, product_slug } = body

    if (!partner || typeof partner !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing partner' }, { status: 400 })
    }

    // ✅ Отхвърли записи без валиден slug — те причиняват "–" в таблицата
    const slug = sanitizeSlug(product_slug)
    if (!slug) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[affiliate-click] Rejected invalid slug: "${product_slug}" (partner: ${partner})`)
      }
      return NextResponse.json({ success: false, error: 'Invalid product_slug' }, { status: 400 })
    }

    const ua = req.headers.get('user-agent') || ''
    if (BOT_UA.test(ua)) {
      return NextResponse.json({ success: true, skipped: 'bot' })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || req.headers.get('x-real-ip')
      || 'unknown'

    const { error } = await supabaseAdmin.from('affiliate_clicks').insert({
      partner:      partner.trim().slice(0, 60),
      product_slug: slug,          // ✅ винаги валиден string, никога null
      ip_address:   ip,
      user_agent:   ua || null,
      referrer:     req.headers.get('referer') || null,
      created_at:   new Date().toISOString(),
    })

    if (error) {
      console.error('[affiliate-click POST]', error.message)
      return NextResponse.json({ success: false })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[affiliate-click POST] catch:', err)
    return NextResponse.json({ success: false })
  }
}

// ─── GET — детайлна статистика ───────────────────────────────────────────────
export async function GET() {
  try {
    const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabaseAdmin
      .from('affiliate_clicks')
      .select('partner, product_slug, created_at, ip_address')
      .gte('created_at', since90)
      .order('created_at', { ascending: false })
      .limit(10000)

    if (error) throw error

    const now      = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const ts30     = now.getTime() - 30 * 24 * 60 * 60 * 1000
    const ts7      = now.getTime() -  7 * 24 * 60 * 60 * 1000

    const byPartner:      Record<string, number> = {}
    const byProduct:      Record<string, number> = {}
    const productDetails: Record<string, { total: number; last30: number; last7: number; today: number }> = {}
    const byDay:          Record<string, number> = {}

    let total = 0, total30 = 0, total7 = 0, totalToday = 0

    for (const click of data || []) {
      // ✅ Пропускай стари редове без slug (записани преди поправката)
      const rawSlug = click.product_slug
      // ✅ Пропускай всички невалидни slug-ове: null, '', '-', '(без slug)'
      if (!rawSlug || rawSlug.trim() === '' || rawSlug === '-' || rawSlug === '(без slug)') continue

      const ts      = new Date(click.created_at).getTime()
      const day     = click.created_at.slice(0, 10)
      const product = rawSlug.trim()
      const partner = click.partner?.trim() || '(unknown)'

      total++
      byPartner[partner] = (byPartner[partner] || 0) + 1
      byProduct[product] = (byProduct[product] || 0) + 1

      if (!productDetails[product]) {
        productDetails[product] = { total: 0, last30: 0, last7: 0, today: 0 }
      }
      productDetails[product].total++

      if (ts >= ts30) {
        total30++
        byDay[day] = (byDay[day] || 0) + 1
        productDetails[product].last30++
      }
      if (ts >= ts7) {
        total7++
        productDetails[product].last7++
      }
      if (day === todayStr) {
        totalToday++
        productDetails[product].today++
      }
    }

    const topProducts = Object.entries(productDetails)
      .sort(([, a], [, b]) => b.last30 - a.last30)
      .slice(0, 20)
      .map(([slug, stats]) => ({ slug, ...stats }))

    const topPartners = Object.entries(byPartner)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))

    const dailyChart = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now.getTime() - (29 - i) * 86400000).toISOString().slice(0, 10)
      return { date: d.slice(5), count: byDay[d] || 0 }
    })

    return NextResponse.json({
      total,
      last30days:  total30,
      last7days:   total7,
      today:       totalToday,
      byProduct,
      byPartner,
      productDetails,
      topProducts,
      topPartners,
      dailyChart,
    })
  } catch (err) {
    console.error('[affiliate-click GET]', err)
    return NextResponse.json({
      total: 0, last30days: 0, last7days: 0, today: 0,
      byProduct: {}, byPartner: {}, productDetails: {}, topProducts: [], topPartners: [], dailyChart: [],
    })
  }
}
