// app/api/analytics/pageview/route.ts — v4

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createHash } from 'crypto'

// ── Бот детекция ──────────────────────────────────────────────────────────────
const BOT_PATTERN = /bot|crawler|spider|crawling|headless|lighthouse|pagespeed|chrome-lighthouse|googlebot|bingbot|yandex|semrush|ahrefsbot|facebookexternalhit|twitterbot|slurp|duckduckbot|sogou|exabot|ia_archiver|python-requests|axios|node-fetch|go-http|java\/|curl\//i

function isBot(ua: string): boolean {
  return !ua || BOT_PATTERN.test(ua)
}

// ── Прост in-memory кеш за GET ────────────────────────────────────────────────
let cache: { data: unknown; ts: number } | null = null
const CACHE_TTL = 60 * 1000 // 1 минута

export async function POST(req: NextRequest) {
  try {
    const { page, referrer, utm_source, utm_medium, utm_campaign } = await req.json()

    // Пропускаме admin и bot посещения
    if (page?.startsWith('/admin')) {
      return NextResponse.json({ ok: true, skipped: true })
    }
if (page?.startsWith('/tr/') || page?.includes('/tr/2/')) {
  return NextResponse.json({ ok: true, skipped: true })
}
    const ua = req.headers.get('user-agent') || ''
    if (isBot(ua)) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const ip       = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
    const isMobile = /mobile|android|iphone|ipad/i.test(ua)

    // Hash включва и час (не само ден) за по-точни уникални посетители
    const visitorHash = createHash('sha256')
      .update(`${ip}:${ua}:${new Date().toISOString().slice(0, 13)}`) // до час
      .digest('hex')
      .slice(0, 16)

    await supabaseAdmin.from('page_views').insert({
      page:         page || '/',
      referrer:     referrer || null,
      utm_source:   utm_source || null,
      utm_medium:   utm_medium || null,
      utm_campaign: utm_campaign || null,
      ip_address:   ip,
      visitor_hash: visitorHash,
      user_agent:   ua,
      is_mobile:    isMobile,
    })

    // Инвалидираме кеша при нов запис
    cache = null

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}

export async function GET() {
  try {
    // Върни от кеш ако е пресен
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json(cache.data)
    }

    const now    = new Date()
    const today  = now.toISOString().slice(0, 10)
    const last7  = new Date(now.getTime() - 7  * 86400000).toISOString()
    const last30 = new Date(now.getTime() - 30 * 86400000).toISOString()

    // Вземаме само последните 30 дни (не 10k безлимитно)
    const { data } = await supabaseAdmin
      .from('page_views')
      .select('page, referrer, utm_source, utm_campaign, is_mobile, visitor_hash, created_at')
      .gte('created_at', last30)
      .order('created_at', { ascending: false })
      .limit(50000) // достатъчно за 30 дни

    if (!data) return NextResponse.json({ total: 0, unique: 0, today: 0 })

    // ── Агрегация ─────────────────────────────────────────────────────────────
    const allHashes    = new Set<string>()
    const todayHashes  = new Set<string>()
    const last7Hashes  = new Set<string>()
    const last30Hashes = new Set<string>()

    const dailyMap:    Record<string, { total: number; unique: Set<string> }> = {}
    const refMap:      Record<string, number> = {}
    const utmMap:      Record<string, number> = {}
    const campaignMap: Record<string, number> = {}
    const pageMap:     Record<string, number> = {}

    let totalCount   = 0
    let todayCount   = 0
    let last7Count   = 0
    let mobileCount  = 0

    for (const v of data) {
      const hash = v.visitor_hash
      const date = v.created_at.slice(0, 10)
      const isToday  = date === today
      const isLast7  = v.created_at >= last7
      const isLast30 = v.created_at >= last30

      if (!isLast30) continue
if (v.page?.startsWith('/tr/') || v.page?.includes('/tr/2/')) continue

      totalCount++
      if (hash) {
        allHashes.add(hash)
        last30Hashes.add(hash)
        if (isToday)  { todayHashes.add(hash) }
        if (isLast7)  { last7Hashes.add(hash) }
      }
      if (isToday) todayCount++
      if (isLast7) last7Count++
      if (v.is_mobile) mobileCount++

      // Daily chart
      if (!dailyMap[date]) dailyMap[date] = { total: 0, unique: new Set() }
      dailyMap[date].total++
      if (hash) dailyMap[date].unique.add(hash)

      // Pages
      pageMap[v.page] = (pageMap[v.page] || 0) + 1

      // Referrers
      if (v.referrer) {
        try {
          const host = new URL(
            v.referrer.startsWith('http') ? v.referrer : 'https://' + v.referrer
          ).hostname.replace('www.', '')
          refMap[host] = (refMap[host] || 0) + 1
        } catch {
          refMap['Direct'] = (refMap['Direct'] || 0) + 1
        }
      } else {
        refMap['Direct'] = (refMap['Direct'] || 0) + 1
      }

      // UTM
      if (v.utm_source)   utmMap[v.utm_source]         = (utmMap[v.utm_source]         || 0) + 1
      if (v.utm_campaign) campaignMap[v.utm_campaign]   = (campaignMap[v.utm_campaign]  || 0) + 1
    }

    // Daily chart — последните 30 дни
    const dailyChart = Array.from({ length: 30 }, (_, i) => {
      const d     = new Date(now.getTime() - (29 - i) * 86400000).toISOString().slice(0, 10)
      const entry = dailyMap[d]
      return { date: d.slice(5), count: entry?.total || 0, unique: entry?.unique.size || 0 }
    })

    const topN = (map: Record<string, number>, n: number) =>
      Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, n).map(([name, count]) => ({ name, count }))

    const mobilePercent = totalCount ? Math.round(mobileCount / totalCount * 100) : 0

    const result = {
      total:        totalCount,
      unique:       allHashes.size,
      today:        todayCount,
      todayUnique:  todayHashes.size,
      last7:        last7Count,
      last7Unique:  last7Hashes.size,
      last30:       totalCount,
      last30Unique: last30Hashes.size,
      mobilePercent,
      dailyChart,
      topReferrers: topN(refMap,      8),
      topUtm:       topN(utmMap,      6),
      topCampaigns: topN(campaignMap, 6),
      topPages:     topN(pageMap,     8),
    }

    // Запази в кеш
    cache = { data: result, ts: Date.now() }

    return NextResponse.json(result)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ total: 0, unique: 0, today: 0 })
  }
}
