// app/api/analytics/page-view/route.ts — v12
// ✅ v11 → v12 (само POST; GET е непроменен):
//   • Rate limit по IP (90 записа / 60 сек) — преди всеки можеше да залее таблицата
//     page_views (безплатният Supabase план има малък лимит на размера).
//   • Всички полета се ограничават по дължина (visitor_id/session_id 64, referrer 500,
//     utm_* 100). Преди бяха неограничени.
//   • path трябва да започва с "/".
// ✅ GET вече изисква admin вход (middleware.ts v13) — преди статистиките бяха публични.
//
// ✅ v11 (запазено): GET вика SQL функцията get_pageview_analytics() вместо да тегли
//    до 200 000 реда — виж 1_run_this_in_supabase_sql_editor.sql.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, getIP } from '@/lib/rate-limit'

const BOT_UA = /bot|crawler|spider|headless|lighthouse|pagespeed|googlebot|bingbot|semrush|ahrefsbot|python-requests|axios|node-fetch|go-http|curl\//i

const cap = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null

// ─── POST — записва page view ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req)
    const rl = rateLimit(`pv:${ip}`, { limit: 90, window: 60 })
    if (!rl.success) {
      return NextResponse.json({ success: false, error: 'rate_limited' }, { status: 429 })
    }

    const body = await req.json().catch(() => ({}))
    const { path, visitor_id, session_id, referrer, utm_source, utm_medium, utm_campaign } = body

    if (!path || typeof path !== 'string' || !path.startsWith('/')) {
      return NextResponse.json({ success: false, error: 'Missing path' }, { status: 400 })
    }

    const ua = req.headers.get('user-agent') || ''
    if (BOT_UA.test(ua)) {
      return NextResponse.json({ success: true, skipped: 'bot' })
    }

    const isMobile = /mobile|android|iphone|ipad|tablet/i.test(ua)

    const { error } = await supabaseAdmin.from('page_views').insert({
      path:         path.slice(0, 500),
      visitor_id:   cap(visitor_id, 64),
      session_id:   cap(session_id, 64),
      ip_address:   ip,
      user_agent:   ua ? ua.slice(0, 300) : null,
      referrer:     cap(referrer, 500),
      utm_source:   cap(utm_source, 100),
      utm_medium:   cap(utm_medium, 100),
      utm_campaign: cap(utm_campaign, 100),
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

// ─── GET — статистика за посещенията (admin) ─────────────────────────────────
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_pageview_analytics')

    if (error) {
      console.error('[page-view GET] RPC error:', error.message)
      throw error
    }

    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })

  } catch (err) {
    console.error('[page-view GET] catch:', err)
    return NextResponse.json({
      total: 0, last30: 0, last7: 0, today: 0, last90: 0, last365: 0,
      unique: 0, todayUnique: 0, last7Unique: 0, last30Unique: 0, last90Unique: 0,
      mobilePercent: 0,
      dailyChart: [], hourlyChart: [],
      topPages: [], topReferrers: [],
      topPages90: [], topReferrers90: [],
      topPages30: [], topReferrers30: [],
      topPages7: [], topReferrers7: [],
      topPagesToday: [], topReferrersToday: [],
      topPages365: [], topReferrers365: [],
      topUtm: [], topCampaigns: [],
    }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
