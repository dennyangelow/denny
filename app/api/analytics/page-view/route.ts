// app/api/analytics/page-view/route.ts — v14
// ✅ v14: приема internal=true от PageViewTracker (устройство, отворило ?da_internal=1) → is_internal.
// (v13 слива твоя v12 с подобренията)
// POST (публичен — вика го PageViewTracker от посетителите) записва едно посещение.
// GET  (само admin — middleware.ts го защитава) връща готовата статистика от SQL
//      функцията page_view_stats() (виж page_views_v2.sql).
//
// ✅ v13 спрямо твоя v12:
//   • ПРИЧИНАТА ЗА НУЛИТЕ: GET викаше rpc('get_pageview_analytics') и при ВСЯКАКВА
//     грешка тихо връщаше обект с нули (catch блока). Истинската грешка оставаше само
//     в терминала. Сега GET вика page_view_stats() (виж page_views_v2.sql), а при
//     грешка връща 500 със съобщение — таблото показва грешка, не фалшиви нули.
//   • Запазено от v12: rate limit 90/60 сек (429), ограничения по дължина, path
//     започва с "/", разширеният списък с ботове.
//   • Ботове (Googlebot, Lighthouse, headless…) не се записват.
//   • Собственият ти трафик (localhost, dev, IP от ANALYTICS_EXCLUDE_IPS) се записва
//     с is_internal=true и не влиза в статистиките.
//   • Суров IP вече не се пази — само HMAC хеш (ip_hash). Старите колони
//     visitor_hash/page не се ползват (page = path, за съвместимост).
//   • Всички входове се чистят и ограничават по дължина.

import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, getIP } from '@/lib/rate-limit'

const BOT_RE = /(googlebot|adsbot|bingbot|\bbot\b|crawler|spider|headless|lighthouse|gtmetrix|pagespeed|facebookexternalhit|meta-externalagent|bytespider|petalbot|ahrefsbot|semrushbot|gptbot|amazonbot|python-requests|axios|node-fetch|go-http|curl\/)/i
const MOBILE_RE = /Mobi|Android|iPhone|iPod/i
const ID_RE     = /^[A-Za-z0-9_-]{6,64}$/
const LOCAL_IPS = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1'])

const clean = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''

function cleanPath(v: unknown): string | null {
  const s = clean(v, 300)
  if (!s.startsWith('/')) return null
  const p = s.split(/[?#]/)[0] || '/'
  if (p.startsWith('/admin') || p.startsWith('/api')) return null
  return p
}

function hashIp(ip: string): string | null {
  if (!ip || ip === 'unknown') return null
  const salt = process.env.ANALYTICS_SALT || process.env.ADMIN_SECRET || 'dev-analytics-salt'
  return createHmac('sha256', salt).update(ip).digest('hex').slice(0, 32)
}

const noContent = () => new NextResponse(null, { status: 204 })

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = rateLimit(`pv:${ip}`, { limit: 90, window: 60 })
  if (!rl.success) {
    return NextResponse.json({ success: false, error: 'rate_limited' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return noContent()

  const ua   = clean(req.headers.get('user-agent'), 400)
  if (!ua || BOT_RE.test(ua)) return noContent()

  const path = cleanPath((body as any).path)
  if (!path) return noContent()

  const excluded = (process.env.ANALYTICS_EXCLUDE_IPS || '').split(',').map(s => s.trim()).filter(Boolean)
  const host = req.headers.get('host') || ''
  const is_internal =
    process.env.NODE_ENV !== 'production' ||
    LOCAL_IPS.has(ip) || excluded.includes(ip) || /^(localhost|127\.)/.test(host) ||
    (body as any).internal === true

  const vid = clean((body as any).visitor_id, 64)
  const sid = clean((body as any).session_id, 64)

  const row = {
    page:         path,                                  // старата колона — държим я = path
    path,
    referrer:     clean((body as any).referrer, 500) || null,
    utm_source:   clean((body as any).utm_source, 100)   || null,
    utm_medium:   clean((body as any).utm_medium, 100)   || null,
    utm_campaign: clean((body as any).utm_campaign, 100) || null,
    ip_address:   null,                                  // не пазим суров IP
    ip_hash:      hashIp(ip),
    user_agent:   ua,
    is_mobile:    MOBILE_RE.test(ua),
    visitor_id:   ID_RE.test(vid) ? vid : null,
    session_id:   ID_RE.test(sid) ? sid : null,
    is_internal,
    is_bot:       false,
  }

  const { error } = await supabaseAdmin.from('page_views').insert(row)
  if (error) {
    console.error('[page-view] insert:', error.message)
    return new NextResponse(null, { status: 500 })
  }
  return noContent()
}

export async function GET() {
  const { data, error } = await supabaseAdmin.rpc('page_view_stats', { p_tz: 'Europe/Sofia' })
  if (error || !data) {
    console.error('[page-view] stats:', error?.message)
    return NextResponse.json(
      { error: 'Статистиката не може да се изчисли', detail: error?.message ?? 'празен отговор',
        hint: 'Пуснал ли си page_views_v2.sql в Supabase → SQL Editor?' },
      { status: 500 }
    )
  }
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, max-age=30' } })
}
