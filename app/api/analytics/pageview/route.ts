// app/api/analytics/pageview/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { page, referrer, utm_source, utm_medium, utm_campaign } = await req.json()
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
    const ua = req.headers.get('user-agent') || ''
    const isMobile = /mobile|android|iphone|ipad/i.test(ua)

    await supabaseAdmin.from('page_views').insert({
      page: page || '/',
      referrer: referrer || null,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      ip_address: ip,
      user_agent: ua,
      is_mobile: isMobile,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from('page_views')
      .select('page, referrer, utm_source, is_mobile, created_at')
      .order('created_at', { ascending: false })
      .limit(5000)

    if (!data) return NextResponse.json({ views: [], total: 0, today: 0, unique: 0, mobile: 0 })

    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const last7 = new Date(now.getTime() - 7 * 86400000).toISOString()
    const last30 = new Date(now.getTime() - 30 * 86400000).toISOString()

    // Daily chart — last 30 days
    const dailyMap: Record<string, number> = {}
    data.forEach(v => {
      const d = v.created_at.slice(0, 10)
      dailyMap[d] = (dailyMap[d] || 0) + 1
    })

    // Fill missing days
    const dailyChart = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10)
      dailyChart.push({ date: d.slice(5), count: dailyMap[d] || 0 })
    }

    // Referrers
    const refMap: Record<string, number> = {}
    data.forEach(v => {
      const ref = v.referrer
        ? new URL(v.referrer.startsWith('http') ? v.referrer : 'https://' + v.referrer).hostname.replace('www.', '')
        : 'Direct'
      refMap[ref] = (refMap[ref] || 0) + 1
    })
    const topReferrers = Object.entries(refMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }))

    // UTM sources
    const utmMap: Record<string, number> = {}
    data.forEach(v => {
      if (v.utm_source) utmMap[v.utm_source] = (utmMap[v.utm_source] || 0) + 1
    })
    const topUtm = Object.entries(utmMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }))

    // Pages
    const pageMap: Record<string, number> = {}
    data.forEach(v => { pageMap[v.page] = (pageMap[v.page] || 0) + 1 })
    const topPages = Object.entries(pageMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }))

    const totalToday = data.filter(v => v.created_at.slice(0, 10) === today).length
    const last7Count = data.filter(v => v.created_at >= last7).length
    const last30Count = data.filter(v => v.created_at >= last30).length
    const mobileCount = data.filter(v => v.is_mobile).length
    const mobilePercent = data.length ? Math.round(mobileCount / data.length * 100) : 0

    return NextResponse.json({
      total: data.length,
      today: totalToday,
      last7: last7Count,
      last30: last30Count,
      mobilePercent,
      dailyChart,
      topReferrers,
      topUtm,
      topPages,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ views: [], total: 0, today: 0 })
  }
}
