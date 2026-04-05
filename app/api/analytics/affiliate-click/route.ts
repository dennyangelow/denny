// app/api/analytics/affiliate-click/route.ts — v3
// POST: записва клик с bot protection
// GET:  детайлна статистика — общо, по продукт, по партньор, daily chart

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const BOT_UA = /bot|crawler|spider|headless|lighthouse|pagespeed|googlebot|bingbot|semrush|ahrefsbot|python-requests|axios|node-fetch|go-http|curl\//i

// ─── POST — записва клик ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { partner, product_slug } = body

    if (!partner || typeof partner !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing partner' }, { status: 400 })
    }

    const ua = req.headers.get('user-agent') || ''
    if (BOT_UA.test(ua)) {
      return NextResponse.json({ success: true, skipped: 'bot' })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || req.headers.get('x-real-ip')
      || 'unknown'

    const { error } = await supabaseAdmin.from('affiliate_clicks').insert({
      partner:      partner.trim(),
      product_slug: product_slug?.trim() || null,
      ip_address:   ip,
      user_agent:   ua || null,
      referrer:     req.headers.get('referer') || null,
      created_at:   new Date().toISOString(),
    })

    if (error) {
      console.error('[affiliate-click POST]', error.message)
      // Не блокираме потребителя — просто логваме
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
    // Вземаме последните 90 дни за пълна статистика
    const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabaseAdmin
      .from('affiliate_clicks')
      .select('partner, product_slug, created_at, ip_address')
      .gte('created_at', since90)
      .order('created_at', { ascending: false })
      .limit(10000)

    if (error) throw error

    const now      = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const ts30     = now.getTime() - 30 * 24 * 60 * 60 * 1000
    const ts7      = now.getTime() -  7 * 24 * 60 * 60 * 1000

    // ── Агрегати ──────────────────────────────────────────────────────────────
    const byPartner:  Record<string, number> = {}
    const byProduct:  Record<string, number> = {}
    // Детайлни: за всеки продукт → { total, last30, last7, today }
    const productDetails: Record<string, { total: number; last30: number; last7: number; today: number }> = {}
    // Daily chart (последните 30 дни)
    const byDay:      Record<string, number> = {}

    let total = 0, total30 = 0, total7 = 0, totalToday = 0

    for (const click of data || []) {
      const ts  = new Date(click.created_at).getTime()
      const day = click.created_at.slice(0, 10)
      const product = click.product_slug || '(без slug)'
      const partner = click.partner || '(unknown)'

      total++
      byPartner[partner] = (byPartner[partner] || 0) + 1
      byProduct[product] = (byProduct[product] || 0) + 1

      if (!productDetails[product]) {
        productDetails[product] = { total: 0, last30: 0, last7: 0, today: 0 }
      }
      productDetails[product].total++

      if (ts >= ts30) {
        total30++
        byDay[day] = (byDay[day] || 0) + 1
        productDetails[product].last30++
      }
      if (ts >= ts7) {
        total7++
        productDetails[product].last7++
      }
      if (day === todayStr) {
        totalToday++
        productDetails[product].today++
      }
    }

    // Топ продукти по last30 кликове
    const topProducts = Object.entries(productDetails)
      .sort(([, a], [, b]) => b.last30 - a.last30)
      .slice(0, 20)
      .map(([slug, stats]) => ({ slug, ...stats }))

    // Топ партньори
    const topPartners = Object.entries(byPartner)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))

    // Daily chart — последните 30 дни
    const dailyChart = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now.getTime() - (29 - i) * 86400000).toISOString().slice(0, 10)
      return { date: d.slice(5), count: byDay[d] || 0 }
    })

    return NextResponse.json({
      // Основни числа (за Dashboard stat card)
      total,
      last30days:  total30,
      last7days:   total7,
      today:       totalToday,

      // По продукт и партньор (за AnalyticsTab графиките)
      byProduct,
      byPartner,

      // Детайлни данни по продукт с разбивка по период
      productDetails,
      topProducts,
      topPartners,

      // За графика
      dailyChart,
    })
  } catch (err) {
    console.error('[affiliate-click GET]', err)
    return NextResponse.json({
      total: 0, last30days: 0, last7days: 0, today: 0,
      byProduct: {}, byPartner: {}, productDetails: {}, topProducts: [], topPartners: [], dailyChart: [],
    })
  }
}
