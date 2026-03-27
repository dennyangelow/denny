// app/api/analytics/pageview/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createHash } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { page, referrer, utm_source, utm_medium, utm_campaign } = body

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
    const ua = req.headers.get('user-agent') || ''
    
    // Филтрираме ботове (Googlebot и т.н.), за да не ти цапат статистиката
    if (/bot|spider|crawler|lighthouse/i.test(ua)) {
      return NextResponse.json({ ok: true, skipped: 'bot' })
    }

    const isMobile = /mobile|android|iphone|ipad/i.test(ua)

    // Генерираме уникален ID за деня (сменя се всеки ден за по-добра анонимност)
    const salt = new Date().toISOString().slice(0, 10)
    const visitorHash = createHash('sha256')
      .update(`${ip}:${ua}:${salt}`)
      .digest('hex')
      .slice(0, 16)

    await supabaseAdmin.from('page_views').insert({
      page: page || '/',
      referrer: referrer || null,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      visitor_hash: visitorHash,
      is_mobile: isMobile,
      // Не записваме чист IP адрес, ако искаме пълна GDPR съвместимост
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Вземаме само последните 30 дни от базата, за да не теглим милиони редове
    const limitDate = new Date(Date.now() - 30 * 86400000).toISOString()
    
    const { data, error } = await supabaseAdmin
      .from('page_views')
      .select('page, referrer, utm_source, is_mobile, visitor_hash, created_at')
      .gt('created_at', limitDate)
      .order('created_at', { ascending: false })

    if (error) throw error
    if (!data) return NextResponse.json({ total: 0 })

    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)

    // Обекти за събиране на статистика
    const stats = {
      total: data.length,
      hashes: new Set(),
      todayTotal: 0,
      todayHashes: new Set(),
      mobileCount: 0,
      pages: {} as Record<string, number>,
      refs: {} as Record<string, number>,
      utms: {} as Record<string, number>,
      daily: {} as Record<string, { t: number; u: Set<string> }>
    }

    // Едно минаване през данните (O(n) сложност) - много по-бързо!
    data.forEach(v => {
      const date = v.created_at.slice(0, 10)
      const h = v.visitor_hash
      
      // Общи
      stats.hashes.add(h)
      if (v.is_mobile) stats.mobileCount++
      
      // Днешни
      if (date === todayStr) {
        stats.todayTotal++
        stats.todayHashes.add(h)
      }

      // Трафик източници
      const host = v.referrer ? v.referrer.replace(/https?:\/\/(www\.)?/, '').split('/')[0] : 'Direct'
      stats.refs[host] = (stats.refs[host] || 0) + 1
      
      // Страници и UTM
      stats.pages[v.page] = (stats.pages[v.page] || 0) + 1
      if (v.utm_source) stats.utms[v.utm_source] = (stats.utms[v.utm_source] || 0) + 1

      // Данни за графиката
      if (!stats.daily[date]) stats.daily[date] = { t: 0, u: new Set() }
      stats.daily[date].t++
      stats.daily[date].u.add(h)
    })

    // Форматиране на графиката
    const dailyChart = Object.keys(stats.daily).sort().map(d => ({
      date: d.slice(5),
      count: stats.daily[d].t,
      unique: stats.daily[d].u.size
    })).slice(-30)

    return NextResponse.json({
      total: stats.total,
      unique: stats.hashes.size,
      today: stats.todayTotal,
      todayUnique: stats.todayHashes.size,
      mobilePercent: Math.round((stats.mobileCount / stats.total) * 100) || 0,
      dailyChart,
      topPages: sortAndSlice(stats.pages, 6),
      topReferrers: sortAndSlice(stats.refs, 8),
      topUtm: sortAndSlice(stats.utms, 6),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Помощна функция за сортиране на обекти
function sortAndSlice(obj: Record<string, number>, limit: number) {
  return Object.entries(obj)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }))
}