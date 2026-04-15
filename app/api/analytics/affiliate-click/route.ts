// app/api/analytics/affiliate-click/route.ts — v6
// ✅ ПОПРАВКИ v6:
//   - toBulgarianDate() и toBulgarianHour() — ВСИЧКИ дати и часове са в Europe/Sofia
//   - todayStr вече е БГ дата (не UTC) → "Днес" клиовете са правилни
//   - hourlyChart bucket-ите са в БГ часове (не UTC) → графиката показва правилни часове
//   - Проблемът: UTC е UTC+0, България е UTC+2 зима / UTC+3 лято
//     → при 07:00 сутринта в БГ, UTC е 04:00 — поради това графиката показваше "03ч"

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const BOT_UA = /bot|crawler|spider|headless|lighthouse|pagespeed|googlebot|bingbot|semrush|ahrefsbot|python-requests|axios|node-fetch|go-http|curl\//i

// ── БГ timezone helpers ───────────────────────────────────────────────────────

/** "yyyy-mm-dd" в Europe/Sofia timezone */
function toBulgarianDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Sofia' })
}

/** Час (0-23) в Europe/Sofia timezone */
function toBulgarianHour(d: Date): number {
  return parseInt(
    d.toLocaleTimeString('en-GB', {
      timeZone: 'Europe/Sofia',
      hour: '2-digit',
      hour12: false,
    }).slice(0, 2),
    10
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────

function sanitizeSlug(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null
  const s = raw.trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
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

    const slug = sanitizeSlug(product_slug)
    if (!slug) {
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
      product_slug: slug,
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
    const now      = new Date()
    // ✅ БГ дата за "днес" — не UTC дата
    const todayStr = toBulgarianDate(now)

    const since7   = new Date(now.getTime() -   7 * 86400000).toISOString()
    const since30  = new Date(now.getTime() -  30 * 86400000).toISOString()
    const since90  = new Date(now.getTime() -  90 * 86400000).toISOString()

    // ── 1. Точни COUNT заявки — без никакъв limit ──────────────────────────
    // За "Днес" COUNT: използваме БГ начало на деня в ISO формат
    const todayStartIso = new Date(todayStr + 'T00:00:00+03:00').toISOString()
    // (работи и с UTC+2 — Supabase ще сравни правилно с UTC stored timestamps)
    // По-надежден начин: вземаме UTC midnight на БГ деня
    const bgDateParts = todayStr.split('-').map(Number)
    const bgMidnight  = new Date(Date.UTC(bgDateParts[0], bgDateParts[1] - 1, bgDateParts[2]))
    // Изваждаме БГ offset: лято UTC+3 = -180мин, зима UTC+2 = -120мин
    // Използваме прост тест: ако toBulgarianDate на 00:00 UTC е вчера → offset е +N часа
    const bgOffsetMs  = (now.getTime() - new Date(toBulgarianDate(now) + 'T00:00:00Z').getTime()) % 86400000
    const todayStartUtc = new Date(bgMidnight.getTime() - bgOffsetMs).toISOString()

    const [
      totalRes,
      last30Res,
      last7Res,
      todayRes,
      detailRes,
    ] = await Promise.all([
      supabaseAdmin
        .from('affiliate_clicks')
        .select('*', { count: 'exact', head: true })
        .not('product_slug', 'is', null)
        .neq('product_slug', '')
        .neq('product_slug', '-'),

      supabaseAdmin
        .from('affiliate_clicks')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since30)
        .not('product_slug', 'is', null)
        .neq('product_slug', '')
        .neq('product_slug', '-'),

      supabaseAdmin
        .from('affiliate_clicks')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since7)
        .not('product_slug', 'is', null)
        .neq('product_slug', '')
        .neq('product_slug', '-'),

      // ✅ "Днес" COUNT: от началото на БГ деня в UTC
      supabaseAdmin
        .from('affiliate_clicks')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStartUtc)
        .not('product_slug', 'is', null)
        .neq('product_slug', '')
        .neq('product_slug', '-'),

      supabaseAdmin
        .from('affiliate_clicks')
        .select('partner, product_slug, created_at')
        .gte('created_at', since90)
        .not('product_slug', 'is', null)
        .neq('product_slug', '')
        .neq('product_slug', '-')
        .order('created_at', { ascending: false })
        .limit(50000),
    ])

    if (totalRes.error)  throw totalRes.error
    if (detailRes.error) throw detailRes.error

    const total      = totalRes.count  ?? 0
    const total30    = last30Res.count ?? 0
    const total7     = last7Res.count  ?? 0
    const totalToday = todayRes.count  ?? 0

    const byPartner:      Record<string, number> = {}
    const byProduct:      Record<string, number> = {}
    const productDetails: Record<string, { total: number; last30: number; last7: number; today: number }> = {}
    const byDay:          Record<string, number> = {}
    const byHour:         Record<number, number> = {}
    const slugsByPartner: Record<string, Set<string>> = {}

    for (let h = 0; h < 24; h++) byHour[h] = 0

    const ts30 = now.getTime() - 30 * 86400000
    const ts7  = now.getTime() -  7 * 86400000

    for (const click of detailRes.data || []) {
      const rawSlug = click.product_slug
      if (!rawSlug || rawSlug.trim() === '' || rawSlug === '-' || rawSlug === '(без slug)') continue

      const clickDate = new Date(click.created_at)
      const ts        = clickDate.getTime()
      // ✅ БГ дата на клика (не UTC дата)
      const day       = toBulgarianDate(clickDate)
      const product   = rawSlug.trim()
      const partner   = click.partner?.trim() || '(unknown)'

      byPartner[partner] = (byPartner[partner] || 0) + 1
      byProduct[product] = (byProduct[product] || 0) + 1

      if (!slugsByPartner[partner]) slugsByPartner[partner] = new Set()
      slugsByPartner[partner].add(product)

      if (!productDetails[product]) {
        productDetails[product] = { total: 0, last30: 0, last7: 0, today: 0 }
      }
      productDetails[product].total++

      // ✅ byDay по БГ дата
      byDay[day] = (byDay[day] || 0) + 1

      if (ts >= ts30) productDetails[product].last30++
      if (ts >= ts7)  productDetails[product].last7++

      // ✅ "Днес" по БГ дата + БГ час за hourly bucket
      if (day === todayStr) {
        productDetails[product].today++
        const hour = toBulgarianHour(clickDate)  // ✅ БГ час
        byHour[hour] = (byHour[hour] || 0) + 1
      }
    }

    const topProducts = Object.entries(productDetails)
      .sort(([, a], [, b]) => b.last30 - a.last30)
      .slice(0, 30)
      .map(([slug, stats]) => {
        const partner = Object.entries(slugsByPartner)
          .find(([, slugSet]) => slugSet.has(slug))?.[0] || null
        return { slug, partner, ...stats }
      })

    const topPartners = Object.entries(byPartner)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))

    const slugsByPartnerArr: Record<string, string[]> = {}
    Object.entries(slugsByPartner).forEach(([p, s]) => {
      slugsByPartnerArr[p] = Array.from(s)
    })

    // ✅ dailyChart — 90 дни с БГ дати
    const dailyChart = Array.from({ length: 90 }, (_, i) => {
      const d = new Date(now.getTime() - (89 - i) * 86400000)
      const bgDay = toBulgarianDate(d)
      return { date: bgDay.slice(5), count: byDay[bgDay] || 0 }
    })

    // ✅ hourlyChart — до текущия БГ час (не UTC час)
    const currentBgHour = toBulgarianHour(now)
    const hourlyChart = Array.from({ length: currentBgHour + 1 }, (_, h) => ({
      hour:  h,
      count: byHour[h] || 0,
    }))

    return NextResponse.json({
      total,
      last30days: total30,
      last7days:  total7,
      today:      totalToday,
      byProduct,
      byPartner,
      productDetails,
      topProducts,
      topPartners,
      dailyChart,
      hourlyChart,
      slugsByPartner: slugsByPartnerArr,
    }, { headers: { 'Cache-Control': 'no-store' } })

  } catch (err) {
    console.error('[affiliate-click GET]', err)
    return NextResponse.json({
      total: 0, last30days: 0, last7days: 0, today: 0,
      byProduct: {}, byPartner: {}, productDetails: {},
      topProducts: [], topPartners: [], dailyChart: [], hourlyChart: [],
      slugsByPartner: {},
    }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
