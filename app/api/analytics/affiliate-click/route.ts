// app/api/analytics/affiliate-click/route.ts — v13
// ✅ v13: приема internal=true от trackAffiliateClick (устройство с ?da_internal=1) → is_internal.
// ✅ v12: твоите кликове (localhost, dev, IP от ANALYTICS_EXCLUDE_IPS) се записват с is_internal=true
//    и НЕ влизат в статистиката (нужна е колоната — виж product_events_and_affiliate.sql).
// ✅ v12: периодите са точно 7/30/90 дни ВКЛЮЧИТЕЛНО днес (бяха 8/31/91) — както rangeUtils v5.
// ✅ v11 спрямо v10:
//   • GET: детайлните редове (за графиките и разбивките по продукт/партньор/канал) се
//     четат ПО СТРАНИЦИ от 1000. v10 викаше .limit(50000), но Supabase връща най-много
//     1000 реда на заявка — щом кликовете за 90 дни минат 1000, графиките и
//     разбивките тихо се занижаваха, а общите броячи (COUNT) оставаха верни.
//   • GET: при грешка връща 500 със съобщение, а не обект с нули (AnalyticsTab вече
//     показва съобщение за грешка при неуспешен fetch).
//   • POST: rate limit (60/мин по IP) — преди всеки можеше да залее таблицата.
//   • POST: не пази суров IP — в колоната ip_address се записва HMAC хеш (колоната
//     остава същата, не е нужна промяна в базата).
//   (всичко останало е 1:1 с v10)
//
// ✅ v10: 'source' поле — откъде е дошъл кликът ('blog', 'produkt-page'), отделно от
//    'partner'. Изисква: alter table affiliate_clicks add column if not exists source text;

import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, getIP } from '@/lib/rate-limit'

const BOT_UA = /bot|crawler|spider|headless|lighthouse|pagespeed|googlebot|bingbot|semrush|ahrefsbot|python-requests|axios|node-fetch|go-http|curl\//i
const PAGE = 1000
const LOCAL_IPS = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1'])

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

/** ISO string на началото на БГ деня в UTC (пробва UTC+3 лято и UTC+2 зима). */
function bulgarianDayStartUtc(bgDateStr: string): string {
  for (const offset of ['+03:00', '+02:00']) {
    const candidate = new Date(bgDateStr + 'T00:00:00' + offset)
    if (toBulgarianDate(candidate) === bgDateStr) {
      return candidate.toISOString()
    }
  }
  return new Date(bgDateStr + 'T00:00:00+02:00').toISOString()
}

/** "yyyy-mm-dd" за N дни назад в БГ timezone. */
function bgDateNDaysAgo(now: Date, days: number): string {
  const todayBg = toBulgarianDate(now)
  const utcMidnight = new Date(todayBg + 'T00:00:00Z')
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() - days)
  return toBulgarianDate(utcMidnight)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function sanitizeSource(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null
  const s = raw.trim().toLowerCase().slice(0, 40)
  return s.length > 0 ? s : null
}

function hashIp(ip: string): string {
  if (!ip || ip === 'unknown') return 'unknown'
  const salt = process.env.ANALYTICS_SALT || process.env.ADMIN_SECRET || 'dev-analytics-salt'
  return createHmac('sha256', salt).update(ip).digest('hex').slice(0, 32)
}

// ─── POST — записва клик ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req)
    const rl = rateLimit(`ac:${ip}`, { limit: 60, window: 60 })
    if (!rl.success) {
      return NextResponse.json({ success: false, error: 'rate_limited' }, { status: 429 })
    }

    const body = await req.json().catch(() => ({}))
    const { partner, product_slug, source, internal } = body

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

    const excluded = (process.env.ANALYTICS_EXCLUDE_IPS || '').split(',').map(x => x.trim()).filter(Boolean)
    const is_internal =
      process.env.NODE_ENV !== 'production' ||
      LOCAL_IPS.has(ip) || excluded.includes(ip) || /^(localhost|127\.)/.test(req.headers.get('host') || '') ||
      internal === true

    const { error } = await supabaseAdmin.from('affiliate_clicks').insert({
      is_internal,
      partner:      partner.trim().slice(0, 60),
      product_slug: slug,
      source:       sanitizeSource(source),
      ip_address:   hashIp(ip),                       // ← хеш, не суров IP
      user_agent:   ua ? ua.slice(0, 300) : null,
      referrer:     (req.headers.get('referer') || '').slice(0, 500) || null,
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

// Чете ВСИЧКИ детайлни редове за периода, по страници от 1000.
async function fetchDetailRows(sinceUtc: string) {
  const rows: { partner: string | null; product_slug: string; source: string | null; created_at: string }[] = []
  for (let from = 0; from < 200000; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('affiliate_clicks')
      .select('partner, product_slug, source, created_at')
      .gte('created_at', sinceUtc)
      .eq('is_internal', false)
      .not('product_slug', 'is', null)
      .neq('product_slug', '')
      .neq('product_slug', '-')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) return { data: null, error }
    rows.push(...((data || []) as typeof rows))
    if (!data || data.length < PAGE) break
  }
  return { data: rows, error: null }
}

// ─── GET — детайлна статистика (admin) ───────────────────────────────────────
export async function GET() {
  try {
    const now = new Date()

    const todayStr = toBulgarianDate(now)
    const bgDate7  = bgDateNDaysAgo(now, 6)
    const bgDate30 = bgDateNDaysAgo(now, 29)
    const bgDate90 = bgDateNDaysAgo(now, 89)

    const todayStartUtc = bulgarianDayStartUtc(todayStr)
    const since7Utc     = bulgarianDayStartUtc(bgDate7)
    const since30Utc    = bulgarianDayStartUtc(bgDate30)
    const since90Utc    = bulgarianDayStartUtc(bgDate90)

    const countSince = (sinceUtc?: string) => {
      let q = supabaseAdmin
        .from('affiliate_clicks')
        .select('*', { count: 'exact', head: true })
        .eq('is_internal', false)
        .not('product_slug', 'is', null)
        .neq('product_slug', '')
        .neq('product_slug', '-')
      if (sinceUtc) q = q.gte('created_at', sinceUtc)
      return q
    }

    const [totalRes, last30Res, last7Res, todayRes, last90Res, detailRes] = await Promise.all([
      countSince(),
      countSince(since30Utc),
      countSince(since7Utc),
      countSince(todayStartUtc),
      countSince(since90Utc),
      fetchDetailRows(since90Utc),
    ])

    if (totalRes.error)  throw totalRes.error
    if (detailRes.error) throw detailRes.error

    const total      = totalRes.count   ?? 0
    const total30    = last30Res.count  ?? 0
    const total7     = last7Res.count   ?? 0
    const totalToday = todayRes.count   ?? 0
    const total90    = last90Res.count  ?? 0

    const byPartner:      Record<string, number> = {}
    const byProduct:      Record<string, number> = {}
    const bySource:       Record<string, number> = {}
    const productDetails: Record<string, { total: number; last30: number; last7: number; today: number }> = {}
    const byDay:          Record<string, number> = {}
    const byHour:         Record<number, number> = {}
    const slugsByPartner: Record<string, Set<string>> = {}

    for (let h = 0; h < 24; h++) byHour[h] = 0

    for (const click of detailRes.data || []) {
      const rawSlug = click.product_slug
      if (!rawSlug || rawSlug.trim() === '' || rawSlug === '-' || rawSlug === '(без slug)') continue

      const clickDate = new Date(click.created_at)
      const bgDay     = toBulgarianDate(clickDate)
      const product   = rawSlug.trim()
      const partner   = click.partner?.trim() || '(unknown)'
      const source    = click.source?.trim() || '(direct)'

      byPartner[partner] = (byPartner[partner] || 0) + 1
      byProduct[product] = (byProduct[product] || 0) + 1
      bySource[source]   = (bySource[source]   || 0) + 1

      if (!slugsByPartner[partner]) slugsByPartner[partner] = new Set()
      slugsByPartner[partner].add(product)

      if (!productDetails[product]) {
        productDetails[product] = { total: 0, last30: 0, last7: 0, today: 0 }
      }
      productDetails[product].total++

      if (bgDay >= bgDate30) productDetails[product].last30++
      if (bgDay >= bgDate7)  productDetails[product].last7++

      byDay[bgDay] = (byDay[bgDay] || 0) + 1

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

    const topSources = Object.entries(bySource)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }))

    const slugsByPartnerArr: Record<string, string[]> = {}
    Object.entries(slugsByPartner).forEach(([p, s]) => {
      slugsByPartnerArr[p] = Array.from(s)
    })

    const dailyChart = Array.from({ length: 90 }, (_, i) => {
      const d     = new Date(now.getTime() - (89 - i) * 86400000)
      const bgDay = toBulgarianDate(d)
      return { date: bgDay.slice(5), count: byDay[bgDay] || 0 }
    })

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
      last90days:  total90,
      byProduct,
      byPartner,
      bySource,
      productDetails,
      topProducts,
      topPartners,
      topSources,
      dailyChart,
      hourlyChart,
      slugsByPartner: slugsByPartnerArr,
    }, { headers: { 'Cache-Control': 'no-store' } })

  } catch (err: any) {
    console.error('[affiliate-click GET]', err?.message || err)
    return NextResponse.json(
      { error: 'Статистиката не може да се изчисли', detail: err?.message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
