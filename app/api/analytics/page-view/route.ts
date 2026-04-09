// app/api/analytics/page-view/route.ts — v8 FIXED
// ✅ ПОПРАВКИ v8:
//   - Добавени last90 / last90Unique / last365 / last365Unique COUNT заявки
//   - dailyChart разширен до 90 дни (беше само 30)
//   - detailRes лимит вдигнат до 10000 за по-точни referrers/pages при 90д

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
    const now    = new Date()
    const today  = now.toISOString().slice(0, 10)
    const day7   = new Date(now.getTime() -   7 * 86400000).toISOString()
    const day30  = new Date(now.getTime() -  30 * 86400000).toISOString()
    const day90  = new Date(now.getTime() -  90 * 86400000).toISOString()
    const day365 = new Date(now.getTime() - 365 * 86400000).toISOString()

    // ✅ COUNT заявки — точни числа без лимит на редовете
    const [
      totalCountRes,
      todayCountRes,
      last7CountRes,
      last30CountRes,
      last90CountRes,   // ← НОВО
      last365CountRes,  // ← НОВО
      // Уникални visitor_hash — само нужната колона
      todayVisitorsRes,
      last7VisitorsRes,
      last30VisitorsRes,
      last90VisitorsRes,   // ← НОВО
      last365VisitorsRes,  // ← НОВО
      allVisitorsRes,
      // Детайли за chart/pages/referrers — разширено до 90 дни
      detailRes,
    ] = await Promise.all([
      supabaseAdmin.from('page_views').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', today),
      supabaseAdmin.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', day7),
      supabaseAdmin.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', day30),
      supabaseAdmin.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', day90),   // ← НОВО
      supabaseAdmin.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', day365), // ← НОВО

      supabaseAdmin.from('page_views').select('visitor_hash').gte('created_at', today).limit(10000),
      supabaseAdmin.from('page_views').select('visitor_hash').gte('created_at', day7).limit(10000),
      supabaseAdmin.from('page_views').select('visitor_hash').gte('created_at', day30).limit(10000),
      supabaseAdmin.from('page_views').select('visitor_hash').gte('created_at', day90).limit(10000),   // ← НОВО
      supabaseAdmin.from('page_views').select('visitor_hash').gte('created_at', day365).limit(10000), // ← НОВО
      supabaseAdmin.from('page_views').select('visitor_hash').limit(10000), // all-time unique

      // ✅ Детайли за последните 90 дни (разширено от 30д) — за chart, pages, referrers
      supabaseAdmin
        .from('page_views')
        .select('visitor_hash, page, referrer, user_agent, is_mobile, created_at, utm_source, utm_medium, utm_campaign')
        .gte('created_at', day90)
        .order('created_at', { ascending: false })
        .limit(10000),
    ])

    // Точни числа от COUNT
    const totalCount   = totalCountRes.count   ?? 0
    const todayCount   = todayCountRes.count   ?? 0
    const last7Count   = last7CountRes.count   ?? 0
    const last30Count  = last30CountRes.count  ?? 0
    const last90Count  = last90CountRes.count  ?? 0  // ← НОВО
    const last365Count = last365CountRes.count ?? 0  // ← НОВО

    // Уникални посетители
    const uniq = (rows: any[] | null) => new Set((rows || []).map(r => r.visitor_hash)).size

    const todayUnique   = uniq(todayVisitorsRes.data)
    const last7Unique   = uniq(last7VisitorsRes.data)
    const last30Unique  = uniq(last30VisitorsRes.data)
    const last90Unique  = uniq(last90VisitorsRes.data)   // ← НОВО
    const last365Unique = uniq(last365VisitorsRes.data)  // ← НОВО
    const totalUnique   = uniq(allVisitorsRes.data)

    const detailRows = detailRes.data || []

    // ── Обработка на детайлните данни ──────────────────────────────────────────
    const pageMap:     Record<string, number> = {}
    const refMap:      Record<string, number> = {}
    const utmMap:      Record<string, number> = {}
    const campaignMap: Record<string, number> = {}
    // ✅ dayMap вече за 90 дни
    const dayMap: Record<string, { count: number; unique: Set<string> }> = {}

    for (let i = 89; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000).toISOString().slice(5, 10) // MM-DD
      dayMap[d] = { count: 0, unique: new Set() }
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

      const d = r.created_at.slice(5, 10)
      if (!dayMap[d]) dayMap[d] = { count: 0, unique: new Set() }
      dayMap[d].count++
      if (r.visitor_hash) dayMap[d].unique.add(r.visitor_hash)

      if (
        r.is_mobile === true ||
        (r.is_mobile === null && /mobile|android|iphone|ipad/i.test(r.user_agent || ''))
      ) mobileCount++
    })

    return NextResponse.json({
      // ✅ Точни числа от COUNT
      total:        totalCount,
      unique:       totalUnique,
      today:        todayCount,
      todayUnique,
      last7:        last7Count,
      last7Unique,
      last30:       last30Count,
      last30Unique,
      last90:       last90Count,   // ← НОВО
      last90Unique,                // ← НОВО
      last365:      last365Count,  // ← НОВО
      last365Unique,               // ← НОВО
      mobilePercent: detailRows.length
        ? Math.round(mobileCount / detailRows.length * 100) : 0,
      // ✅ dailyChart сега е 90 дни
      dailyChart: Object.entries(dayMap)
        .sort()
        .map(([date, v]) => ({ date, count: v.count, unique: v.unique.size })),
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
      dailyChart: [], topPages: [], topReferrers: [], topUtm: [], topCampaigns: [],
    }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
