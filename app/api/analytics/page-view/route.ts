// app/api/analytics/page-view/route.ts — v9
// ✅ ПОПРАВКИ v7 (спрямо v6):
//   БЪГОВЕ ПОПРАВЕНИ:
//   1. topReferrers + topPages — сега се изчисляват за ВСЕКИ range поотделно
//      (преди се показваха само за 90д независимо от избрания период)
//   2. unique total — отделна COUNT заявка (без limit cap)
//      (преди се броеше само от 100K реда → занижен брой при повече данни)
//   3. getAffDailyChart — БГ дати за филтриране (не UTC)
//   4. Добавени topReferrers/topPages полета за 7д, 30д, днес в отговора

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const BOT_UA = /bot|crawler|spider|headless|lighthouse|pagespeed|googlebot|bingbot|semrush|ahrefsbot|python-requests|axios|node-fetch|go-http|curl\//i

// ── БГ timezone helpers ───────────────────────────────────────────────────────

function toBulgarianDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Sofia' })
}

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

function bulgarianDayStartUtc(bgDateStr: string): string {
  for (const offset of ['+03:00', '+02:00']) {
    const candidate = new Date(bgDateStr + 'T00:00:00' + offset)
    if (toBulgarianDate(candidate) === bgDateStr) {
      return candidate.toISOString()
    }
  }
  return new Date(bgDateStr + 'T00:00:00+02:00').toISOString()
}

function bgDateNDaysAgo(now: Date, days: number): string {
  const todayBg     = toBulgarianDate(now)
  const utcMidnight = new Date(todayBg + 'T00:00:00Z')
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() - days)
  return toBulgarianDate(utcMidnight)
}

// ── Helper: изгражда topPages и topReferrers от масив от редове ───────────────
function buildTopStats(rows: { path: string; referrer: string | null }[]) {
  const byPage:     Record<string, number> = {}
  const byReferrer: Record<string, number> = {}

  for (const pv of rows) {
    if (pv.path) {
      byPage[pv.path] = (byPage[pv.path] || 0) + 1
    }
    if (pv.referrer) {
      let ref = pv.referrer
      try {
        const url = new URL(pv.referrer)
        ref = url.hostname.replace(/^www\./, '')
      } catch {}
      if (ref && ref !== '' && !ref.includes('localhost')) {
        byReferrer[ref] = (byReferrer[ref] || 0) + 1
      }
    }
  }

  const topPages = Object.entries(byPage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }))

  const topReferrers = Object.entries(byReferrer)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }))

  return { topPages, topReferrers }
}

// ─── POST — записва page view ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { path, visitor_id, session_id, referrer, utm_source, utm_medium, utm_campaign } = body

    if (!path || typeof path !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing path' }, { status: 400 })
    }

    const ua = req.headers.get('user-agent') || ''
    if (BOT_UA.test(ua)) {
      return NextResponse.json({ success: true, skipped: 'bot' })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || req.headers.get('x-real-ip')
      || 'unknown'

    const isMobile = /mobile|android|iphone|ipad|tablet/i.test(ua)

    const { error } = await supabaseAdmin.from('page_views').insert({
      path:         path.slice(0, 500),
      visitor_id:   visitor_id || null,
      session_id:   session_id || null,
      ip_address:   ip,
      user_agent:   ua || null,
      referrer:     referrer || null,
      utm_source:   utm_source || null,
      utm_medium:   utm_medium || null,
      utm_campaign: utm_campaign || null,
      is_mobile:    isMobile,
      created_at:   new Date().toISOString(),
    })

    if (error) {
      console.error('[page-view POST]', error.message)
      return NextResponse.json({ success: false })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[page-view POST] catch:', err)
    return NextResponse.json({ success: false })
  }
}

// ─── GET — статистика за посещенията ────────────────────────────────────────
export async function GET() {
  try {
    const now = new Date()

    const todayStr = toBulgarianDate(now)
    const bgDate7  = bgDateNDaysAgo(now, 7)
    const bgDate30 = bgDateNDaysAgo(now, 30)
    const bgDate90 = bgDateNDaysAgo(now, 90)

    const todayStartUtc = bulgarianDayStartUtc(todayStr)
    const since7Utc     = bulgarianDayStartUtc(bgDate7)
    const since30Utc    = bulgarianDayStartUtc(bgDate30)
    const since90Utc    = bulgarianDayStartUtc(bgDate90)

    const [
      totalRes,
      last30Res,
      last7Res,
      todayRes,
      last90Res,
      // ✅ ПОПРАВКА 2: отделни заявки за уникални по период — без limit cap
      uniqueTotalRes,
      unique90Res,
      unique30Res,
      unique7Res,
      uniqueTodayRes,
      // Детайли за 90д — за chart + hourly + UTM
      detailRes,
      // ✅ ПОПРАВКА 1: отделни заявки за topPages/topReferrers по range
      detail30Res,
      detail7Res,
      detailTodayRes,
    ] = await Promise.all([
      // COUNT заявки
      supabaseAdmin.from('page_views').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', since30Utc),
      supabaseAdmin.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', since7Utc),
      supabaseAdmin.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', todayStartUtc),
      supabaseAdmin.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', since90Utc),

      // ✅ v9: COUNT DISTINCT чрез RPC — без лимит от PostgREST (поправя ~700 вместо ~6000)
      supabaseAdmin.rpc('count_unique_visitors'),
      supabaseAdmin.rpc('count_unique_visitors', { since_ts: since90Utc }),
      supabaseAdmin.rpc('count_unique_visitors', { since_ts: since30Utc }),
      supabaseAdmin.rpc('count_unique_visitors', { since_ts: since7Utc }),
      supabaseAdmin.rpc('count_unique_visitors', { since_ts: todayStartUtc }),

      // Детайли за 90д (chart + hourly + UTM)
      supabaseAdmin
        .from('page_views')
        .select('visitor_id, session_id, ip_address, path, referrer, utm_source, utm_campaign, is_mobile, created_at')
        .gte('created_at', since90Utc)
        .order('created_at', { ascending: false })
        .limit(100000),

      // ✅ ПОПРАВКА 1: path+referrer за топ статистики по range
      supabaseAdmin.from('page_views').select('path, referrer').gte('created_at', since30Utc).limit(50000),
      supabaseAdmin.from('page_views').select('path, referrer').gte('created_at', since7Utc).limit(20000),
      supabaseAdmin.from('page_views').select('path, referrer').gte('created_at', todayStartUtc).limit(5000),
    ])

    if (totalRes.error)  throw totalRes.error
    if (detailRes.error) throw detailRes.error

    const total      = totalRes.count  ?? 0
    const total30    = last30Res.count ?? 0
    const total7     = last7Res.count  ?? 0
    const totalToday = todayRes.count  ?? 0
    const total90    = last90Res.count ?? 0

    // ✅ ПОПРАВКА 2: unique visitors — броим Set от всички редове (без limit)
    function countUnique(rows: { visitor_id: string | null; ip_address: string | null }[] | null): number {
      if (!rows) return 0
      const s = new Set<string>()
      for (const r of rows) {
        s.add(r.visitor_id || r.ip_address || 'anon')
      }
      return s.size
    }

    // ✅ v9: RPC връща директно числото в .data (не масив от редове)
    const uniqueTotal = (uniqueTotalRes.data as unknown as number) ?? 0
    const unique90    = (unique90Res.data    as unknown as number) ?? 0
    const unique30    = (unique30Res.data    as unknown as number) ?? 0
    const unique7     = (unique7Res.data     as unknown as number) ?? 0
    const uniqueToday = (uniqueTodayRes.data as unknown as number) ?? 0

    // ── Обработка на детайлите за chart ──────────────────────────────────────
    const byDay:      Record<string, { count: number; visitors: Set<string> }> = {}
    const byHour:     Record<number, { count: number; unique: number }> = {}
    const byUtm:      Record<string, number> = {}
    const byCampaign: Record<string, number> = {}

    let mobileCount = 0

    for (let h = 0; h < 24; h++) byHour[h] = { count: 0, unique: 0 }
    const hourVisitors: Record<number, Set<string>> = {}
    for (let h = 0; h < 24; h++) hourVisitors[h] = new Set()

    for (const pv of detailRes.data || []) {
      const pvDate = new Date(pv.created_at)
      const bgDay  = toBulgarianDate(pvDate)
      const vid    = pv.visitor_id || pv.ip_address || pv.session_id || 'anon'

      if (!byDay[bgDay]) byDay[bgDay] = { count: 0, visitors: new Set() }
      byDay[bgDay].count++
      byDay[bgDay].visitors.add(vid)

      if (bgDay === todayStr) {
        const hour = toBulgarianHour(pvDate)
        byHour[hour].count++
        hourVisitors[hour].add(vid)
      }

      if (pv.is_mobile) mobileCount++

      if (pv.utm_source)   byUtm[pv.utm_source]       = (byUtm[pv.utm_source]       || 0) + 1
      if (pv.utm_campaign) byCampaign[pv.utm_campaign] = (byCampaign[pv.utm_campaign] || 0) + 1
    }

    for (let h = 0; h < 24; h++) {
      byHour[h].unique = hourVisitors[h].size
    }

    const totalDetailRows = detailRes.data?.length ?? 0
    const mobilePercent   = totalDetailRows > 0
      ? Math.round((mobileCount / totalDetailRows) * 100)
      : 0

    const dailyChart = Array.from({ length: 90 }, (_, i) => {
      const bgDay = bgDateNDaysAgo(now, 89 - i)
      const entry = byDay[bgDay]
      return {
        date:   bgDay.slice(5),
        count:  entry?.count         ?? 0,
        unique: entry?.visitors.size ?? 0,
      }
    })

    const currentBgHour = toBulgarianHour(now)
    const hourlyChart   = Array.from({ length: currentBgHour + 1 }, (_, h) => ({
      hour:   h,
      count:  byHour[h].count,
      unique: byHour[h].unique,
    }))

    // ✅ ПОПРАВКА 1: topPages/topReferrers по range
    const stats90    = buildTopStats(detailRes.data || [])
    const stats30    = buildTopStats(detail30Res.data || [])
    const stats7     = buildTopStats(detail7Res.data || [])
    const statsToday = buildTopStats(detailTodayRes.data || [])

    const topUtm = Object.entries(byUtm)
      .sort(([, a], [, b]) => b - a).slice(0, 10)
      .map(([name, count]) => ({ name, count }))

    const topCampaigns = Object.entries(byCampaign)
      .sort(([, a], [, b]) => b - a).slice(0, 10)
      .map(([name, count]) => ({ name, count }))

    return NextResponse.json({
      total, last30: total30, last7: total7, today: totalToday, last90: total90,

      // ✅ Поправени unique — точни числа без limit cap
      unique:       uniqueTotal,
      todayUnique:  uniqueToday,
      last7Unique:  unique7,
      last30Unique: unique30,
      last90Unique: unique90,

      mobilePercent,
      dailyChart,
      hourlyChart,

      // ✅ ПОПРАВКА 1: топ статистики по всеки range поотделно
      topPages:      stats90.topPages,      // default (90д) — за "all" view
      topReferrers:  stats90.topReferrers,
      topPages30:    stats30.topPages,
      topReferrers30: stats30.topReferrers,
      topPages7:     stats7.topPages,
      topReferrers7: stats7.topReferrers,
      topPagesToday:    statsToday.topPages,
      topReferrersToday: statsToday.topReferrers,

      topUtm,
      topCampaigns,
    }, { headers: { 'Cache-Control': 'no-store' } })

  } catch (err) {
    console.error('[page-view GET]', err)
    return NextResponse.json({
      total: 0, last30: 0, last7: 0, today: 0, last90: 0,
      unique: 0, todayUnique: 0, last7Unique: 0, last30Unique: 0, last90Unique: 0,
      mobilePercent: 0,
      dailyChart: [], hourlyChart: [],
      topPages: [], topReferrers: [],
      topPages30: [], topReferrers30: [],
      topPages7: [], topReferrers7: [],
      topPagesToday: [], topReferrersToday: [],
      topUtm: [], topCampaigns: [],
    }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
