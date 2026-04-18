// app/api/analytics/affiliate-click/route.ts — v9
// ✅ ПОПРАВКИ v9 (спрямо v8):
//   - bgDateNDaysAgo(): премахнат hardcoded '+03:00' offset (грешен зимата при UTC+2)
//     → Ново: парсира като UTC полунощ на БГ датата + setUTCDate() → toBulgarianDate()
//     → Работи правилно и лято (UTC+3) и зима (UTC+2) без DST проблеми

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

/**
 * Връща ISO string на началото на БГ деня в UTC.
 * ✅ Пробва UTC+3 (лято) и UTC+2 (зима) — взима правилния.
 * Пример: "2026-04-17" (UTC+3 лято) → "2026-04-16T21:00:00.000Z"
 */
function bulgarianDayStartUtc(bgDateStr: string): string {
  for (const offset of ['+03:00', '+02:00']) {
    const candidate = new Date(bgDateStr + 'T00:00:00' + offset)
    if (toBulgarianDate(candidate) === bgDateStr) {
      return candidate.toISOString()
    }
  }
  return new Date(bgDateStr + 'T00:00:00+02:00').toISOString()
}

/**
 * Връща "yyyy-mm-dd" за N дни назад в БГ timezone.
 * ✅ Изчислява се коректно в Europe/Sofia — не прост UTC offset.
 */
function bgDateNDaysAgo(now: Date, days: number): string {
  const todayBg = toBulgarianDate(now)                    // "2026-04-17"
  // ✅ Парсираме като UTC полунощ на БГ датата — работи правилно и лято и зима
  // (без hardcoded +03:00 който е грешен зимата при UTC+2)
  const utcMidnight = new Date(todayBg + 'T00:00:00Z')
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() - days)
  return toBulgarianDate(utcMidnight)
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
    const now = new Date()

    // ✅ БГ дати — всички периоди се нулират в 00:00 БГ
    const todayStr = toBulgarianDate(now)
    const bgDate7  = bgDateNDaysAgo(now, 7)
    const bgDate30 = bgDateNDaysAgo(now, 30)
    const bgDate90 = bgDateNDaysAgo(now, 90)

    // ✅ UTC ISO strings за Supabase .gte() заявките
    const todayStartUtc = bulgarianDayStartUtc(todayStr)
    const since7Utc     = bulgarianDayStartUtc(bgDate7)
    const since30Utc    = bulgarianDayStartUtc(bgDate30)
    const since90Utc    = bulgarianDayStartUtc(bgDate90)

    const [
      totalRes,
      last30Res,
      last7Res,
      todayRes,
      last90Res,   // ✅ Ново — точна COUNT заявка за 90д
      detailRes,
    ] = await Promise.all([
      // Общо всичко
      supabaseAdmin
        .from('affiliate_clicks')
        .select('*', { count: 'exact', head: true })
        .not('product_slug', 'is', null)
        .neq('product_slug', '')
        .neq('product_slug', '-'),

      // ✅ 30 дни от БГ полунощ на bgDate30
      supabaseAdmin
        .from('affiliate_clicks')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since30Utc)
        .not('product_slug', 'is', null)
        .neq('product_slug', '')
        .neq('product_slug', '-'),

      // ✅ 7 дни от БГ полунощ на bgDate7
      supabaseAdmin
        .from('affiliate_clicks')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since7Utc)
        .not('product_slug', 'is', null)
        .neq('product_slug', '')
        .neq('product_slug', '-'),

      // ✅ Днес от 00:00 БГ
      supabaseAdmin
        .from('affiliate_clicks')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStartUtc)
        .not('product_slug', 'is', null)
        .neq('product_slug', '')
        .neq('product_slug', '-'),

      // ✅ 90 дни от БГ полунощ на bgDate90 — точна COUNT, не approximation!
      supabaseAdmin
        .from('affiliate_clicks')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since90Utc)
        .not('product_slug', 'is', null)
        .neq('product_slug', '')
        .neq('product_slug', '-'),

      // Детайли за 90 дни (за chart + per-product breakdown)
      supabaseAdmin
        .from('affiliate_clicks')
        .select('partner, product_slug, created_at')
        .gte('created_at', since90Utc)
        .not('product_slug', 'is', null)
        .neq('product_slug', '')
        .neq('product_slug', '-')
        .order('created_at', { ascending: false })
        .limit(50000),
    ])

    if (totalRes.error)  throw totalRes.error
    if (detailRes.error) throw detailRes.error

    const total      = totalRes.count   ?? 0
    const total30    = last30Res.count  ?? 0
    const total7     = last7Res.count   ?? 0
    const totalToday = todayRes.count   ?? 0
    const total90    = last90Res.count  ?? 0   // ✅ Точен брой за 90д

    const byPartner:      Record<string, number> = {}
    const byProduct:      Record<string, number> = {}
    const productDetails: Record<string, { total: number; last30: number; last7: number; today: number }> = {}
    const byDay:          Record<string, number> = {}
    const byHour:         Record<number, number> = {}
    const slugsByPartner: Record<string, Set<string>> = {}

    for (let h = 0; h < 24; h++) byHour[h] = 0

    for (const click of detailRes.data || []) {
      const rawSlug = click.product_slug
      if (!rawSlug || rawSlug.trim() === '' || rawSlug === '-' || rawSlug === '(без slug)') continue

      const clickDate = new Date(click.created_at)
      const bgDay     = toBulgarianDate(clickDate)   // ✅ БГ дата
      const product   = rawSlug.trim()
      const partner   = click.partner?.trim() || '(unknown)'

      byPartner[partner] = (byPartner[partner] || 0) + 1
      byProduct[product] = (byProduct[product] || 0) + 1

      if (!slugsByPartner[partner]) slugsByPartner[partner] = new Set()
      slugsByPartner[partner].add(product)

      if (!productDetails[product]) {
        productDetails[product] = { total: 0, last30: 0, last7: 0, today: 0 }
      }
      // total в productDetails = брой за 90 дни (detailRes обхваща 90д)
      productDetails[product].total++

      // ✅ String сравнение на БГ дати — нулиране в 00:00 БГ, не UTC
      if (bgDay >= bgDate30) productDetails[product].last30++
      if (bgDay >= bgDate7)  productDetails[product].last7++

      // ✅ byDay по БГ дата — MM-DD
      byDay[bgDay] = (byDay[bgDay] || 0) + 1

      // ✅ Hourly само за БГ "Днес" + БГ час
      if (bgDay === todayStr) {
        productDetails[product].today++
        const hour = toBulgarianHour(clickDate)
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
      const d     = new Date(now.getTime() - (89 - i) * 86400000)
      const bgDay = toBulgarianDate(d)
      return { date: bgDay.slice(5), count: byDay[bgDay] || 0 }
    })

    // ✅ hourlyChart — до текущия БГ час
    const currentBgHour = toBulgarianHour(now)
    const hourlyChart = Array.from({ length: currentBgHour + 1 }, (_, h) => ({
      hour:  h,
      count: byHour[h] || 0,
    }))

    return NextResponse.json({
      total,
      last30days:  total30,
      last7days:   total7,
      today:       totalToday,
      last90days:  total90,    // ✅ Точен брой за 90д (ново поле)
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
      total: 0, last30days: 0, last7days: 0, today: 0, last90days: 0,
      byProduct: {}, byPartner: {}, productDetails: {},
      topProducts: [], topPartners: [], dailyChart: [], hourlyChart: [],
      slugsByPartner: {},
    }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
