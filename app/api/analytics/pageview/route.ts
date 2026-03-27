// app/api/analytics/pageview/route.ts — v3 без Admin посещения

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createHash } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { page, referrer, utm_source, utm_medium, utm_campaign } = await req.json()

    // Изключваме admin посещенията
    if (page?.startsWith('/admin')) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const ip      = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
    const ua      = req.headers.get('user-agent') || ''
    const isMobile = /mobile|android|iphone|ipad/i.test(ua)

    const visitorHash = createHash('sha256')
      .update(`${ip}:${ua}:${new Date().toISOString().slice(0, 10)}`)
      .digest('hex')
      .slice(0, 16)

    await supabaseAdmin.from('page_views').insert({
      page:        page || '/',
      referrer:    referrer || null,
      utm_source:  utm_source || null,
      utm_medium:  utm_medium || null,
      utm_campaign: utm_campaign || null,
      ip_address:  ip,
      visitor_hash: visitorHash,
      user_agent:  ua,
      is_mobile:   isMobile,
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
      .select('page, referrer, utm_source, utm_campaign, is_mobile, visitor_hash, created_at')
      .order('created_at', { ascending: false })
      .limit(10000)

    if (!data) return NextResponse.json({ total: 0, unique: 0, today: 0 })

    const now    = new Date()
    const today  = now.toISOString().slice(0, 10)
    const last7  = new Date(now.getTime() - 7 * 86400000).toISOString()
    const last30 = new Date(now.getTime() - 30 * 86400000).toISOString()

    const allHashes    = new Set(data.map(v => v.visitor_hash).filter(Boolean))
    const todayData    = data.filter(v => v.created_at.slice(0, 10) === today)
    const last7Data    = data.filter(v => v.created_at >= last7)
    const last30Data   = data.filter(v => v.created_at >= last30)

    const todayHashes  = new Set(todayData.map(v => v.visitor_hash).filter(Boolean))
    const last7Hashes  = new Set(last7Data.map(v => v.visitor_hash).filter(Boolean))
    const last30Hashes = new Set(last30Data.map(v => v.visitor_hash).filter(Boolean))

    // Daily chart — last 30 days
    const dailyMap: Record<string, { total: number; unique: Set<string> }> = {}
    data.forEach(v => {
      const d = v.created_at.slice(0, 10)
      if (!dailyMap[d]) dailyMap[d] = { total: 0, unique: new Set() }
      dailyMap[d].total++
      if (v.visitor_hash) dailyMap[d].unique.add(v.visitor_hash)
    })

    const dailyChart = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10)
      const entry = dailyMap[d]
      dailyChart.push({
        date:   d.slice(5),
        count:  entry?.total || 0,
        unique: entry?.unique.size || 0,
      })
    }

    // Referrers
    const refMap: Record<string, number> = {}
    data.forEach(v => {
      try {
        const ref = v.referrer
          ? new URL(v.referrer.startsWith('http') ? v.referrer : 'https://' + v.referrer).hostname.replace('www.', '')
          : 'Direct'
        refMap[ref] = (refMap[ref] || 0) + 1
      } catch {
        refMap['Direct'] = (refMap['Direct'] || 0) + 1
      }
    })
    const topReferrers = Object.entries(refMap)
      .sort(([, a], [, b]) => b - a).slice(0, 8)
      .map(([name, count]) => ({ name, count }))

    // UTM
    const utmMap: Record<string, number> = {}
    data.forEach(v => {
      if (v.utm_source) utmMap[v.utm_source] = (utmMap[v.utm_source] || 0) + 1
    })
    const topUtm = Object.entries(utmMap)
      .sort(([, a], [, b]) => b - a).slice(0, 6)
      .map(([name, count]) => ({ name, count }))

    // UTM campaigns
    const campaignMap: Record<string, number> = {}
    data.forEach(v => {
      if (v.utm_campaign) campaignMap[v.utm_campaign] = (campaignMap[v.utm_campaign] || 0) + 1
    })
    const topCampaigns = Object.entries(campaignMap)
      .sort(([, a], [, b]) => b - a).slice(0, 6)
      .map(([name, count]) => ({ name, count }))

    // Pages
    const pageMap: Record<string, number> = {}
    data.forEach(v => { pageMap[v.page] = (pageMap[v.page] || 0) + 1 })
    const topPages = Object.entries(pageMap)
      .sort(([, a], [, b]) => b - a).slice(0, 8)
      .map(([name, count]) => ({ name, count }))

    const mobileCount   = data.filter(v => v.is_mobile).length
    const mobilePercent = data.length ? Math.round(mobileCount / data.length * 100) : 0

    return NextResponse.json({
      total:        data.length,
      unique:       allHashes.size,
      today:        todayData.length,
      todayUnique:  todayHashes.size,
      last7:        last7Data.length,
      last7Unique:  last7Hashes.size,
      last30:       last30Data.length,
      last30Unique: last30Hashes.size,
      mobilePercent,
      dailyChart,
      topReferrers,
      topUtm,
      topCampaigns,
      topPages,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ total: 0, unique: 0, today: 0 })
  }
}
