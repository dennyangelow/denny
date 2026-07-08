// app/api/analytics/page-view/route.ts — v11 (оптимизирано за Nano compute)
// ✅ POST е ИДЕНТИЧЕН с v10 — нищо не се променя в записването на посещения
// ✅ GET вече не тегли до 200,000 реда наведнъж — вместо това вика
//    SQL функцията get_pageview_analytics(), която брои директно в базата
//    (виж 1_run_this_in_supabase_sql_editor.sql — трябва да е пуснат ПРЕДИ този файл)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const BOT_UA = /bot|crawler|spider|headless|lighthouse|pagespeed|googlebot|bingbot|semrush|ahrefsbot|python-requests|axios|node-fetch|go-http|curl\//i

// ─── POST — записва page view (БЕЗ ПРОМЯНА от v10) ───────────────────────────
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

// ─── GET — статистика за посещенията (v11 — ОПТИМИЗИРАНО) ────────────────────
// Преди: 17 паралелни заявки, до 200,000 реда тегляни в паметта на функцията
// Сега:  1 RPC извикване — цялото броене/групиране става вътре в Postgres
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_pageview_analytics')

    if (error) {
      console.error('[page-view GET] RPC error:', error.message)
      throw error
    }

    // data вече е готов JSON обект със същата форма като преди —
    // фронтендът (AnalyticsTab.tsx) не се нуждае от никаква промяна
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
