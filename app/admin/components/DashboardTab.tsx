'use client'
// app/admin/components/DashboardTab.tsx — v12
// ✅ ПОПРАВКИ v12 (спрямо v11):
//   - getVisitsForRange: добавена поддръжка за range=90 (last90) и range=365
//   - newLeadsCount: изчислява се с БГ дата (не UTC cutoff)
//   - Мобилен дизайн: overflow-x:hidden навсякъде, stat cards 2 на ред на мобилен
//   - Таблицата с поръчки: truncate на дълги имена на мобилен
//   - Range picker: scrollable на мобилен без хоризонтален overflow
//   - Header: flex-wrap + column на <480px

import { useMemo, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts'
import type { AdminStats, PageViewStats } from '@/hooks/useAdminData'
import type { Order, Lead, AffiliateAnalytics } from '@/lib/supabase'
import { STATUS_LABELS } from '@/lib/constants'
import { useCurrency } from './CurrencyContext'
import { RangePicker } from './AnalyticsTab'
import {
  type Range, getRangeLabel, calcTrend,
  filterByRange, filterPrevPeriod, buildRevenueChart, getXAxisInterval,
  toBulgarianDateStr, bgDateNDaysAgo, getCutoff,
} from './rangeUtils'

interface Props {
  stats:       AdminStats
  orders:      Order[]
  leads:       Lead[]
  analytics:   AffiliateAnalytics | null
  pageViews:   PageViewStats | null
  onRefresh:   () => void
  onViewOrder: (o: Order) => void
  onTabChange?: (tab: string) => void
  loading?:    boolean
}

// ─── Малки компоненти ─────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={data.map((v, i) => ({ i, v }))} margin={{ top:2, bottom:2, left:0, right:0 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} animationDuration={400} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function SkeletonCard() {
  return (
    <div className="skel-card">
      {[55, 75, 40].map((w, i) => (
        <div key={i} className="skel-line" style={{ width:`${w}%`, height:i===1?24:10, marginBottom:i<2?8:0 }} />
      ))}
    </div>
  )
}

function TrendBadge({ current, prev }: { current: number; prev: number }) {
  const trend = calcTrend(current, prev)
  if (trend === null) return null
  const up = trend >= 0
  return (
    <span className={`trend-badge ${up ? 'up' : 'down'}`}>
      {up ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
    </span>
  )
}

const STATUS_ICON: Record<string, string> = {
  delivered:'✅', cancelled:'❌', shipped:'🚚', processing:'⚙️', new:'🆕', confirmed:'✔️',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSparkline(orders: Order[], days: number) {
  const now   = new Date()
  // ✅ БГ дати за sparkline
  const dates = Array.from({ length:days }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (days-1-i))
    return toBulgarianDateStr(d)
  })
  const revMap: Record<string, number> = {}
  const ordMap: Record<string, number> = {}
  orders.filter(o => o.status !== 'cancelled').forEach(o => {
    const d = toBulgarianDateStr(new Date(o.created_at))
    revMap[d] = (revMap[d] || 0) + Number(o.total)
    ordMap[d] = (ordMap[d] || 0) + 1
  })
  return {
    revenue: dates.map(d => revMap[d] || 0),
    orders:  dates.map(d => ordMap[d] || 0),
  }
}

// ✅ v12: правилен брой посещения за ВСЕКИ range включително 90 и 365
function getVisitsForRange(pageViews: PageViewStats | null, range: Range): number {
  if (!pageViews) return 0
  if (range === 1)   return pageViews.today    ?? 0
  if (range === 7)   return pageViews.last7    ?? 0
  if (range === 30)  return pageViews.last30   ?? 0
  if (range === 90)  return pageViews.last90   ?? pageViews.total ?? 0
  if (range === 365) return (pageViews as any).last365 ?? pageViews.total ?? 0
  return pageViews.total ?? pageViews.last30   ?? 0
}

// ✅ Affiliate кликове спрямо range
function getAffClicksForRange(analytics: AffiliateAnalytics | null, range: Range): { value: number; approx: boolean } {
  if (!analytics) return { value: 0, approx: false }
  if (range === 1)     return { value: (analytics as any).today      ?? 0, approx: false }
  if (range === 7)     return { value: (analytics as any).last7days  ?? 0, approx: false }
  if (range === 30)    return { value: analytics.last30days          ?? 0, approx: false }
  if (range === 90)    return { value: (analytics as any).last90days ?? analytics.last30days ?? 0, approx: !(analytics as any).last90days }
  if (range === 'all') return { value: analytics.total               ?? 0, approx: false }
  return { value: analytics.total ?? 0, approx: false }
}

// ─── Главен компонент ─────────────────────────────────────────────────────────

export function DashboardTab({
  stats, orders, leads, analytics, pageViews,
  onRefresh, onViewOrder, onTabChange, loading = false,
}: Props) {
  const { fmt: formatPrice } = useCurrency()
  const [hovered, setHovered] = useState<string | null>(null)
  const [range,   setRange]   = useState<Range>(30)

  const recentOrders = useMemo(() => orders.slice(0, 6), [orders])

  // ── Филтрирани поръчки по range ──────────────────────────────────
  const filteredOrders = useMemo(() => filterByRange(orders, range),    [orders, range])
  const prevOrders     = useMemo(() => filterPrevPeriod(orders, range), [orders, range])

  const rangeMetrics = useMemo(() => {
    const active     = filteredOrders.filter(o => o.status !== 'cancelled')
    const prevActive = prevOrders.filter(o => o.status !== 'cancelled')
    const rev     = active.reduce((s, o) => s + Number(o.total), 0)
    const prevRev = prevActive.reduce((s, o) => s + Number(o.total), 0)
    const cnt     = filteredOrders.length
    const prevCnt = prevOrders.length
    return { rev, prevRev, cnt, prevCnt }
  }, [filteredOrders, prevOrders])

  // ✅ Конверсия спрямо range
  const conversionRate = useMemo(() => {
    const visits = getVisitsForRange(pageViews, range)
    if (!visits || !filteredOrders.length) return 0
    return Math.min(99, (filteredOrders.length / visits) * 100)
  }, [pageViews, filteredOrders, range])

  const visitsForRange = useMemo(() => getVisitsForRange(pageViews, range), [pageViews, range])
  const affResult      = useMemo(() => getAffClicksForRange(analytics, range), [analytics, range])
  const affClicks      = affResult.value
  const affApprox      = affResult.approx

  // ✅ v12: Нови абонати за периода — с БГ дата
  const newLeadsCount = useMemo(() => {
    if (!leads?.length) return 0
    const now = new Date()
    if (range === 'all') return leads.length
    if (range === 1) {
      const todayBg = toBulgarianDateStr(now)
      return leads.filter(l => {
        const d = l.created_at ? toBulgarianDateStr(new Date(l.created_at)) : ''
        return d === todayBg
      }).length
    }
    const cutoffBg = bgDateNDaysAgo(now, range as number)
    return leads.filter(l => {
      const d = l.created_at ? toBulgarianDateStr(new Date(l.created_at)) : ''
      return d >= cutoffBg
    }).length
  }, [leads, range])

  const revenueChart = useMemo(() => buildRevenueChart(filteredOrders, range), [filteredOrders, range])
  const sparklines   = useMemo(() => buildSparkline(orders, 7), [orders])
  const rl           = getRangeLabel(range)

  // ── Stat cards ───────────────────────────────────────────────────
  const statCards = [
    {
      id: 'revenue',
      label:  `Приход (${rl})`,
      value:  formatPrice(rangeMetrics.rev),
      icon:   '💶', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0',
      spark:  sparklines.revenue,
      trend:  { current: rangeMetrics.rev, prev: rangeMetrics.prevRev },
      tab:    'analytics',
      sub:    `Днес: ${formatPrice(stats.todayRevenue)}`,
    },
    {
      id: 'week',
      label:  'Тази седмица',
      value:  formatPrice(stats.weekRevenue),
      icon:   '📆', color: '#8b5cf6', bg: '#faf5ff', border: '#e9d5ff',
      spark:  sparklines.revenue,
      trend:  null as null,
      tab:    'analytics',
      sub:    `Ср. поръчка: ${formatPrice(stats.avgOrderValue)}`,
    },
    {
      id: 'orders',
      label:  `Поръчки (${rl})`,
      value:  rangeMetrics.cnt,
      icon:   '📦', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a',
      spark:  sparklines.orders,
      trend:  { current: rangeMetrics.cnt, prev: rangeMetrics.prevCnt },
      tab:    'orders',
      sub:    `Нови: ${stats.newOrders} · Чакат плащане: ${stats.pendingPayments}`,
    },
    {
      id: 'conversion',
      label:  `Конверсия (${rl})`,
      value:  `${conversionRate.toFixed(2)}%`,
      icon:   '🎯', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe',
      spark:  sparklines.orders,
      trend:  null as null,
      tab:    'analytics',
      sub:    visitsForRange > 0 ? `${visitsForRange.toLocaleString()} посещения` : 'Няма данни',
    },
    {
      id: 'leads',
      label:  range === 'all' ? 'Email абонати' : `Нови абонати (${rl})`,
      value:  range === 'all' ? stats.leads : newLeadsCount,
      icon:   '✉️', color: '#06b6d4', bg: '#ecfeff', border: '#a5f3fc',
      spark:  sparklines.orders,
      trend:  null as null,
      tab:    'leads',
      sub:    range === 'all' ? `Общо: ${stats.leads}` : `Общо записани: ${stats.leads}`,
    },
    {
      id: 'affiliate',
      label:  `Affiliate (${rl})`,
      value:  affClicks.toLocaleString() + (affApprox ? ' ~' : ''),
      icon:   '🔗', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0',
      spark:  sparklines.orders,
      trend:  null as null,
      tab:    'analytics',
      sub:    affApprox ? '≈ прибл. (виж Аналитика)' : 'Кликове',
    },
  ]

  return (
    <div className="dash-root">
      <style>{`
        .dash-root {
          padding: 20px 24px;
          max-width: 1200px;
          overflow-x: hidden;
          box-sizing: border-box;
        }
        @media(max-width:640px) {
          .dash-root { padding: 12px 10px }
        }

        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }

        .skel-card {
          background:#f9fafb; border:1px solid #f0f0f0; border-radius:14px;
          padding:16px 18px; flex:1 1 calc(50% - 5px); min-width:0; max-width:100%;
        }
        .skel-line {
          border-radius:6px;
          background:linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%);
          background-size:400px 100%; animation:shimmer 1.4s infinite
        }

        /* ── Stat cards — 2 на ред на мобилен ── */
        .stat-card {
          flex: 1 1 calc(33% - 8px);
          min-width: 0; max-width: 100%;
          border-radius:14px; padding:16px 18px; cursor:pointer;
          transition:transform .18s, box-shadow .18s;
          animation:fadeUp .3s ease both;
          box-sizing: border-box;
        }
        .stat-card:hover { transform:translateY(-2px) }
        @media(max-width:700px) {
          .stat-card { flex: 1 1 calc(50% - 5px) }
        }
        @media(max-width:360px) {
          .stat-card { flex: 1 1 100% }
        }

        .trend-badge { font-size:11px; font-weight:700; padding:2px 7px; border-radius:99px }
        .trend-badge.up   { background:#dcfce7; color:#15803d }
        .trend-badge.down { background:#fee2e2; color:#dc2626 }

        .ord-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:10px 18px; border-bottom:1px solid #f5f5f5;
          cursor:pointer; transition:background .12s;
          min-width:0;
        }
        .ord-row:hover { background:#f9fafb }
        .ord-row:last-child { border-bottom:none }

        .d-card {
          background:#fff; border:1px solid #e8eaed;
          border-radius:14px; overflow:hidden; min-width:0;
        }
        .d-card-head {
          padding:14px 18px; border-bottom:1px solid #f3f4f6;
          display:flex; justify-content:space-between; align-items:center;
        }
        .d-card-head h3 { font-size:13px; font-weight:700; margin:0; color:#111 }
        .d-card-body { padding:16px 18px }

        .grid-2 {
          display:grid; grid-template-columns:1fr 1fr; gap:16px;
          min-width:0;
        }
        .grid-4 {
          display:grid; grid-template-columns:repeat(4,1fr); gap:9px;
        }
        @media(max-width:700px) {
          .grid-2 { grid-template-columns:1fr }
        }
        @media(max-width:640px) {
          .grid-4 { grid-template-columns:1fr 1fr }
        }

        .refresh-btn {
          background:#fff; border:1px solid #e5e7eb; border-radius:9px;
          padding:7px 14px; cursor:pointer; font-family:inherit; font-size:13px;
          color:#374151; font-weight:600; transition:all .15s; white-space:nowrap;
          flex-shrink:0;
        }
        .refresh-btn:hover { border-color:#16a34a; color:#16a34a }
        .link-btn {
          font-size:12px; color:#16a34a; background:none; border:none;
          cursor:pointer; font-family:inherit; font-weight:600; white-space:nowrap;
        }

        .ref-bar-wrap { height:4px; background:#f3f4f6; border-radius:99px; margin-top:3px }

        .range-scroll {
          overflow-x:auto; -webkit-overflow-scrolling:touch; padding-bottom:2px;
        }
        .range-scroll::-webkit-scrollbar { display:none }

        /* ── Header responsive ── */
        .dash-header {
          display:flex; justify-content:space-between; align-items:flex-start;
          margin-bottom:20px; flex-wrap:wrap; gap:10px;
        }
        @media(max-width:540px) {
          .dash-header { flex-direction:column }
          .dash-controls { width:100%; display:flex; gap:8px; justify-content:space-between }
        }

        /* ── Stat cards row ── */
        .stat-row {
          display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px;
        }

        /* ── Truncate order names ── */
        .ord-name {
          max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }
        .ord-num {
          max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }
        @media(max-width:400px) {
          .ord-row { padding:9px 12px }
          .ord-name { max-width:100px }
          .ord-num { max-width:70px }
        }

        /* ── Chart размер на мобилен ── */
        @media(max-width:640px) {
          .recharts-wrapper { font-size: 10px }
        }

        /* ── Visits grid на мобилен ── */
        @media(max-width:360px) {
          .grid-4 { grid-template-columns: 1fr 1fr }
        }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="dash-header">
        <div>
          <h1 style={{ fontSize:20, fontWeight:900, color:'#111', letterSpacing:'-.02em', margin:0 }}>Дашборд</h1>
          <p style={{ fontSize:12, color:'#94a3b8', margin:'2px 0 0' }}>
            {new Date().toLocaleDateString('bg-BG', { weekday:'long', year:'numeric', month:'long', day:'numeric', timeZone:'Europe/Sofia' })}
          </p>
        </div>
        <div className="dash-controls" style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <div className="range-scroll">
            <RangePicker range={range} onChange={setRange} />
          </div>
          <button className="refresh-btn" onClick={onRefresh}>🔄 Обнови</button>
        </div>
      </div>

      {/* ── KPI Stat Cards ───────────────────────────────────────────── */}
      <div className="stat-row">
        {loading
          ? Array.from({ length:6 }).map((_, i) => <SkeletonCard key={i} />)
          : statCards.map((c, i) => (
            <div key={c.id} className="stat-card"
              onClick={() => onTabChange?.(c.tab)}
              onMouseEnter={() => setHovered(c.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background:  c.bg,
                border:     `1px solid ${hovered === c.id ? c.color + '55' : c.border}`,
                boxShadow:   hovered === c.id ? `0 6px 24px ${c.color}18` : 'none',
                animationDelay: `${i * 0.04}s`,
              }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <span style={{ fontSize:18 }}>{c.icon}</span>
                {c.trend && <TrendBadge current={c.trend.current} prev={c.trend.prev} />}
              </div>
              <div style={{ fontSize:22, fontWeight:900, color:c.color, letterSpacing:'-.02em', lineHeight:1.2 }}>{c.value}</div>
              <div style={{ fontSize:11, color:'#6b7280', fontWeight:500, marginBottom:6 }}>{c.label}</div>
              <div style={{ margin:'0 -4px' }}><Sparkline data={c.spark} color={c.color} /></div>
              {c.sub && (
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:6, paddingTop:6, borderTop:`1px solid ${c.border}` }}>
                  {c.sub}
                </div>
              )}
            </div>
          ))}
      </div>

      {/* ── Revenue Chart ─────────────────────────────────────────────── */}
      <div className="d-card" style={{ marginBottom:16 }}>
        <div className="d-card-head">
          <h3>💶 Приход — {rl}</h3>
          <span style={{ fontSize:12, color:'#94a3b8' }}>
            Общо: <strong style={{ color:'#16a34a' }}>{formatPrice(rangeMetrics.rev)}</strong>
          </span>
        </div>
        <div className="d-card-body" style={{ paddingTop:10 }}>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={revenueChart}>
              <defs>
                <linearGradient id="revGrad-db" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.14} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} interval={getXAxisInterval(range)} />
              <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} width={44} />
              <Tooltip
                formatter={(v: number) => [formatPrice(v), 'Приход']}
                contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12, boxShadow:'0 4px 12px rgba(0,0,0,.06)' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2.5} fill="url(#revGrad-db)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Последни поръчки + Посещения ──────────────────────────────── */}
      <div className="grid-2">
        {/* Последни поръчки */}
        <div className="d-card">
          <div className="d-card-head">
            <h3>📦 Последни поръчки</h3>
            {onTabChange && (
              <button className="link-btn" onClick={() => onTabChange('orders')}>Всички →</button>
            )}
          </div>
          {recentOrders.length === 0 ? (
            <div style={{ padding:'32px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📭</div>Няма поръчки
            </div>
          ) : recentOrders.map(o => {
            const s = STATUS_LABELS[o.status] || { label:o.status, color:'#666', bg:'#f9fafb' }
            return (
              <div key={o.id} className="ord-row" onClick={() => onViewOrder(o)}>
                <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0, flex:1 }}>
                  <div style={{ width:34, height:34, borderRadius:9, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>
                    {STATUS_ICON[o.status] || '📦'}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div className="ord-name" style={{ fontSize:13, fontWeight:600, color:'#111' }}>{o.customer_name}</div>
                    <div className="ord-num" style={{ fontSize:11, color:'#94a3b8', fontFamily:'monospace' }}>{o.order_number}</div>
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0, marginLeft:8 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#16a34a', whiteSpace:'nowrap' }}>{formatPrice(o.total)}</div>
                  <span style={{ fontSize:10, padding:'2px 7px', borderRadius:99, background:s.bg, color:s.color, fontWeight:700, whiteSpace:'nowrap' }}>{s.label}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ✅ Посещения — 4 периода в grid, активният highlight-нат спрямо range */}
        {pageViews ? (
          <div className="d-card">
            <div className="d-card-head">
              <h3>👁️ Посещения</h3>
              <span style={{ fontSize:11, color:'#94a3b8' }}>{rl}</span>
            </div>
            <div className="d-card-body">
              {/* ✅ 4-колонен grid: Днес / 7д / 30д / Всичко */}
              <div className="grid-4" style={{ marginBottom:14 }}>
                {([
                  { label:'Днес',    value: pageViews.today,   unique: pageViews.todayUnique,  color:'#6366f1', match: range===1    },
                  { label:'7 дни',   value: pageViews.last7,   unique: pageViews.last7Unique,  color:'#0ea5e9', match: range===7    },
                  { label:'30 дни',  value: pageViews.last30,  unique: pageViews.last30Unique, color:'#8b5cf6', match: range===30   },
                  {
                    label: 'Всичко',
                    value:  pageViews.total  ?? pageViews.last30,
                    unique: pageViews.unique ?? pageViews.last30Unique,
                    color: '#111', match: range==='all' || (range as number) >= 90,
                  },
                ] as const).map(r => (
                  <div key={r.label} style={{
                    borderRadius:10, padding:'9px 10px', transition:'all .2s',
                    background: r.match ? '#f0fdf4' : '#f9fafb',
                    border:     r.match ? `2px solid ${r.color}` : '1px solid #f0f0f0',
                    minWidth: 0,
                  }}>
                    <div style={{ fontSize:9, color:'#94a3b8', fontWeight:700, marginBottom:3, textTransform:'uppercase', letterSpacing:'.03em' }}>{r.label}</div>
                    <div style={{ fontSize:17, fontWeight:800, color:r.color, lineHeight:1.1 }}>{(r.value ?? 0).toLocaleString()}</div>
                    <div style={{ fontSize:9, color:'#94a3b8', marginTop:2 }}>{(r.unique ?? 0).toLocaleString()} уник.</div>
                  </div>
                ))}
              </div>

              {/* Mobile % */}
              <div style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
                  <span style={{ color:'#374151', fontWeight:600 }}>📱 Мобилни</span>
                  <span style={{ fontWeight:700 }}>{pageViews.mobilePercent}%</span>
                </div>
                <div style={{ height:5, background:'#f3f4f6', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pageViews.mobilePercent}%`, background:'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius:99, transition:'width .6s ease' }} />
                </div>
              </div>

              {/* ✅ Топ източници — показва всички */}
              {pageViews.topReferrers && pageViews.topReferrers.length > 0 && (
                <div>
                  <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Топ източници</div>
                  {pageViews.topReferrers.map((r, i) => {
                    const maxCount = pageViews.topReferrers![0].count
                    return (
                      <div key={r.name} style={{ marginBottom:7 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                          <span style={{ color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'75%' }}>{r.name}</span>
                          <span style={{ fontWeight:700, flexShrink:0 }}>{r.count}</span>
                        </div>
                        <div className="ref-bar-wrap">
                          <div style={{ height:'100%', width:`${(r.count/maxCount)*100}%`, background:['#16a34a','#0ea5e9','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899','#10b981'][i] || '#94a3b8', borderRadius:99 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          // Fallback ако няма pageViews данни
          <div className="d-card">
            <div className="d-card-head"><h3>📊 Обобщение</h3></div>
            <div className="d-card-body">
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {[
                  { label:'Общ приход',    value:formatPrice(stats.revenue),      color:'#16a34a' },
                  { label:'Общо поръчки',  value:stats.totalOrders,               color:'#f59e0b' },
                  { label:'Email абонати', value:stats.leads,                     color:'#06b6d4' },
                  { label:'Конверсия',     value:`${conversionRate.toFixed(2)}%`, color:'#6366f1' },
                ].map(item => (
                  <div key={item.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'#f9fafb', borderRadius:10, border:'1px solid #f0f0f0' }}>
                    <span style={{ fontSize:13, color:'#374151' }}>{item.label}</span>
                    <span style={{ fontSize:16, fontWeight:800, color:item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:14, padding:'12px', background:'#fff7ed', borderRadius:10, border:'1px solid #fed7aa', fontSize:12, color:'#92400e' }}>
                ⚠️ Данните за посещения не се зареждат. Провери дали <code>PageViewTracker</code> е добавен в layout.tsx
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
