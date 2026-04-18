// app/api/analytics/page-view/route.ts — v12
// ✅ ПОПРАВКИ v12 (спрямо v11):
//   - bgDateNDaysAgo(): премахнат hardcoded '+03:00' offset (грешен зимата при UTC+2)
//     → Ново: парсира като UTC полунощ на БГ датата + setUTCDate() → toBulgarianDate()
//     → Работи правилно и лято (UTC+3) и зима (UTC+2) без DST проблеми

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, getIP } from '@/lib/rate-limit'
import crypto from 'crypto'

const IGNORE_PATHS = [
  '/admin', '/api', '/_next', '/favicon', '/robots', '/sitemap',
  '.js', '.css', '.png', '.jpg', '.webp', '.ico', '.woff', '.svg',
]

function shouldIgnore(path: string): boolean {
  return IGNORE_PATHS.some(p => path.startsWith(p) || path.includes(p))
}

function isMobile(ua: string): boolean {
  return /mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(ua)
}

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
 * Пример: "2026-04-17" (UTC+3) → "2026-04-16T21:00:00.000Z"
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
 * ✅ Изчислява се в Europe/Sofia — не прост UTC offset.
 */
function bgDateNDaysAgo(now: Date, days: number): string {
  const todayBg = toBulgarianDate(now)
  // ✅ UTC полунощ на БГ датата — без hardcoded +03:00 (грешно зимата при UTC+2)
  const utcMidnight = new Date(todayBg + 'T00:00:00Z')
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() - days)
  return toBulgarianDate(utcMidnight)
}

// ─── POST — записва нов page view ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { path, session_id, visitor_id, referrer, utm_source, utm_medium, utm_campaign } = body

    if (!path || typeof path !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    if (shouldIgnore(path)) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const ip = getIP(req)
    const rlKey = `pv:${session_id || ip}:${path}`
    const rl = rateLimit(rlKey, { limit: 1, window: 300 })

    if (!rl.success) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'rate_limited' })
    }

    const ipHash = crypto
      .createHash('sha256')
      .update(ip + (process.env.IP_HASH_SALT || 'salt'))
      .digest('hex')
      .slice(0, 16)

    const ua = req.headers.get('user-agent') || ''

    const { error } = await supabaseAdmin
      .from('page_views')
      .insert({
        page:         path.slice(0, 500),
        referrer:     referrer ? String(referrer).slice(0, 500) : null,
        utm_source:   utm_source   || null,
        utm_medium:   utm_medium   || null,
        utm_campaign: utm_campaign || null,
        ip_address:   ip.slice(0, 100),
        user_agent:   ua.slice(0, 300),
        is_mobile:    isMobile(ua),
        visitor_hash: visitor_id || ipHash,
        path:         path.slice(0, 500),
        session_id:   session_id || `anon-${ipHash}`,
        visitor_id:   visitor_id || ipHash,
        ip_hash:      ipHash,
      })

    if (error) {
      if (error.message?.includes('column') || error.code === '42703') {
        const { error: err2 } = await supabaseAdmin
          .from('page_views')
          .insert({
            page:         path.slice(0, 500),
            referrer:     referrer ? String(referrer).slice(0, 500) : null,
            utm_source:   utm_source   || null,
            utm_medium:   utm_medium   || null,
            utm_campaign: utm_campaign || null,
            ip_address:   ip.slice(0, 100),
            user_agent:   ua.slice(0, 300),
            is_mobile:    isMobile(ua),
            visitor_hash: visitor_id || ipHash,
          })
        if (err2) {
          console.error('[page-view] insert fallback error:', err2.message)
          return NextResponse.json({ ok: false }, { status: 500 })
        }
      } else {
        console.error('[page-view] insert error:', error.message)
        return NextResponse.json({ ok: false }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[page-view] POST error:', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

// ─── GET — агрегирани статистики за admin панела ────────────────────────────
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_page_view_stats')
    if (!error && data) {
      return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
    }
    console.warn('[page-view] rpc not available, using fallback:', error?.message)
    return getFallbackStats()
  } catch (e) {
    return getFallbackStats()
  }
}

async function getFallbackStats() {
  try {
    const now = new Date()

    // ✅ БГ дати за всеки период — всички се нулират в 00:00 БГ
    const todayBg   = toBulgarianDate(now)
    const bgDate7   = bgDateNDaysAgo(now, 7)
    const bgDate30  = bgDateNDaysAgo(now, 30)
    const bgDate90  = bgDateNDaysAgo(now, 90)
    const bgDate365 = bgDateNDaysAgo(now, 365)

    // ✅ UTC ISO strings за Supabase .gte() — от БГ полунощ, не UTC полунощ
    const todayStartUtc  = bulgarianDayStartUtc(todayBg)
    const since7Utc      = bulgarianDayStartUtc(bgDate7)
    const since30Utc     = bulgarianDayStartUtc(bgDate30)
    const since90Utc     = bulgarianDayStartUtc(bgDate90)
    const since365Utc    = bulgarianDayStartUtc(bgDate365)

    const [
      totalCountRes,
      todayCountRes,
      last7CountRes,
      last30CountRes,
      last90CountRes,
      last365CountRes,
      todayVisitorsRes,
      last7VisitorsRes,
      last30VisitorsRes,
      last90VisitorsRes,
      last365VisitorsRes,
      allVisitorsRes,
      todayDetailRes,
      detailRes,
    ] = await Promise.all([
      supabaseAdmin.from('page_views').select('*', { count: 'exact', head: true }),

      // ✅ Днес от 00:00 БГ
      supabaseAdmin.from('page_views').select('*', { count: 'exact', head: true })
        .gte('created_at', todayStartUtc),

      // ✅ 7 дни от 00:00 БГ на bgDate7
      supabaseAdmin.from('page_views').select('*', { count: 'exact', head: true })
        .gte('created_at', since7Utc),

      // ✅ 30 дни от 00:00 БГ на bgDate30
      supabaseAdmin.from('page_views').select('*', { count: 'exact', head: true })
        .gte('created_at', since30Utc),

      // ✅ 90 дни от 00:00 БГ на bgDate90
      supabaseAdmin.from('page_views').select('*', { count: 'exact', head: true })
        .gte('created_at', since90Utc),

      // ✅ 365 дни от 00:00 БГ на bgDate365
      supabaseAdmin.from('page_views').select('*', { count: 'exact', head: true })
        .gte('created_at', since365Utc),

      // Unique visitors — от БГ полунощ
      supabaseAdmin.from('page_views').select('visitor_hash')
        .gte('created_at', todayStartUtc).limit(10000),
      supabaseAdmin.from('page_views').select('visitor_hash')
        .gte('created_at', since7Utc).limit(10000),
      supabaseAdmin.from('page_views').select('visitor_hash')
        .gte('created_at', since30Utc).limit(10000),
      supabaseAdmin.from('page_views').select('visitor_hash')
        .gte('created_at', since90Utc).limit(10000),
      supabaseAdmin.from('page_views').select('visitor_hash')
        .gte('created_at', since365Utc).limit(10000),
      supabaseAdmin.from('page_views').select('visitor_hash').limit(10000),

      // ✅ Hourly данни за днес — от БГ полунощ
      supabaseAdmin
        .from('page_views')
        .select('visitor_hash, created_at')
        .gte('created_at', todayStartUtc)
        .order('created_at', { ascending: true })
        .limit(20000),

      // Детайли за 90 дни (топ страници, референри, daily chart)
      supabaseAdmin
        .from('page_views')
        .select('visitor_hash, page, referrer, user_agent, is_mobile, created_at, utm_source, utm_medium, utm_campaign')
        .gte('created_at', since90Utc)
        .order('created_at', { ascending: false })
        .limit(10000),
    ])

    const totalCount   = totalCountRes.count   ?? 0
    const todayCount   = todayCountRes.count   ?? 0
    const last7Count   = last7CountRes.count   ?? 0
    const last30Count  = last30CountRes.count  ?? 0
    const last90Count  = last90CountRes.count  ?? 0
    const last365Count = last365CountRes.count ?? 0

    const uniq = (rows: any[] | null) => new Set((rows || []).map(r => r.visitor_hash)).size

    const todayUnique   = uniq(todayVisitorsRes.data)
    const last7Unique   = uniq(last7VisitorsRes.data)
    const last30Unique  = uniq(last30VisitorsRes.data)
    const last90Unique  = uniq(last90VisitorsRes.data)
    const last365Unique = uniq(last365VisitorsRes.data)
    const totalUnique   = uniq(allVisitorsRes.data)

    // ── hourlyChart за днес с БГ часове ───────────────────────────────────
    const hourlyCountMap:  Record<number, number>      = {}
    const hourlyUniqueMap: Record<number, Set<string>> = {}
    for (let h = 0; h < 24; h++) {
      hourlyCountMap[h]  = 0
      hourlyUniqueMap[h] = new Set()
    }
    for (const r of todayDetailRes.data || []) {
      const hour = toBulgarianHour(new Date(r.created_at))  // ✅ БГ час
      hourlyCountMap[hour]++
      if (r.visitor_hash) hourlyUniqueMap[hour].add(r.visitor_hash)
    }
    // ✅ До текущия БГ час
    const currentBgHour = toBulgarianHour(now)
    const hourlyChart = Array.from({ length: currentBgHour + 1 }, (_, h) => ({
      hour:   h,
      count:  hourlyCountMap[h],
      unique: hourlyUniqueMap[h].size,
    }))

    // ── dailyChart (90 дни) с БГ дати ────────────────────────────────────
    const detailRows = detailRes.data || []
    const pageMap:     Record<string, number> = {}
    const refMap:      Record<string, number> = {}
    const utmMap:      Record<string, number> = {}
    const campaignMap: Record<string, number> = {}

    // ✅ dayMap ключовете са "MM-DD" в БГ timezone
    const dayMap: Record<string, { count: number; unique: Set<string> }> = {}
    for (let i = 89; i >= 0; i--) {
      // ✅ Строим масива с правилните БГ дати (не UTC дати)
      const d     = new Date(now.getTime() - i * 86400000)
      const bgDay = toBulgarianDate(d).slice(5) // MM-DD
      dayMap[bgDay] = { count: 0, unique: new Set() }
    }

    let mobileCount = 0

    detailRows.forEach((r: any) => {
      const pg = r.page || '/'
      pageMap[pg] = (pageMap[pg] || 0) + 1

      let ref = 'Direct'
      if (r.referrer) {
        try {
          const hostname = new URL(r.referrer).hostname.replace('www.', '')
          if      (hostname.includes('facebook') || hostname.includes('fb.com')) ref = 'Facebook'
          else if (hostname.includes('google'))                                  ref = 'Google'
          else if (hostname.includes('instagram'))                               ref = 'Instagram'
          else if (hostname.includes('tiktok'))                                  ref = 'TikTok'
          else if (hostname.includes('youtube'))                                 ref = 'YouTube'
          else if (hostname.includes('t.co') || hostname.includes('twitter'))   ref = 'Twitter/X'
          else                                                                   ref = hostname
        } catch { ref = 'Direct' }
      }
      refMap[ref] = (refMap[ref] || 0) + 1

      if (r.utm_source)   utmMap[r.utm_source]       = (utmMap[r.utm_source]       || 0) + 1
      if (r.utm_campaign) campaignMap[r.utm_campaign] = (campaignMap[r.utm_campaign] || 0) + 1

      // ✅ dayMap ключ = "MM-DD" в БГ timezone
      const bgDay = toBulgarianDate(new Date(r.created_at)).slice(5)
      if (!dayMap[bgDay]) dayMap[bgDay] = { count: 0, unique: new Set() }
      dayMap[bgDay].count++
      if (r.visitor_hash) dayMap[bgDay].unique.add(r.visitor_hash)

      if (
        r.is_mobile === true ||
        (r.is_mobile === null && /mobile|android|iphone|ipad/i.test(r.user_agent || ''))
      ) mobileCount++
    })

    return NextResponse.json({
      total:        totalCount,
      unique:       totalUnique,
      today:        todayCount,
      todayUnique,
      last7:        last7Count,
      last7Unique,
      last30:       last30Count,
      last30Unique,
      last90:       last90Count,
      last90Unique,
      last365:      last365Count,
      last365Unique,
      mobilePercent: detailRows.length
        ? Math.round(mobileCount / detailRows.length * 100) : 0,
      dailyChart: Object.entries(dayMap)
        .sort()
        .map(([date, v]) => ({ date, count: v.count, unique: v.unique.size })),
      hourlyChart,
      topPages: Object.entries(pageMap)
        .sort(([, a], [, b]) => b - a).slice(0, 15)
        .map(([name, count]) => ({ name, count })),
      topReferrers: Object.entries(refMap)
        .sort(([, a], [, b]) => b - a).slice(0, 10)
        .map(([name, count]) => ({ name, count })),
      topUtm: Object.entries(utmMap)
        .sort(([, a], [, b]) => b - a).slice(0, 10)
        .map(([name, count]) => ({ name, count })),
      topCampaigns: Object.entries(campaignMap)
        .sort(([, a], [, b]) => b - a).slice(0, 10)
        .map(([name, count]) => ({ name, count })),
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[page-view] fallback error:', err)
    return NextResponse.json({
      total: 0, unique: 0,
      today: 0, todayUnique: 0,
      last7: 0, last7Unique: 0,
      last30: 0, last30Unique: 0,
      last90: 0, last90Unique: 0,
      last365: 0, last365Unique: 0,
      mobilePercent: 0,
      dailyChart: [], hourlyChart: [],
      topPages: [], topReferrers: [], topUtm: [], topCampaigns: [],
    }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
