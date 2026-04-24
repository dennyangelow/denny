'use client'
// app/admin/components/DashboardTab.tsx — v14
// ✅ ПОДОБРЕНИЯ v14 (спрямо v13):
//   - Quick Stats Bar: компактен ред отгоре с бързи числа (нови поръчки, чакат плащане, приход днес/седмица)
//   - Посещения: 5 клетки (Днес/7д/30д/90д/Всичко) — правилен highlight за ВСЕКИ range
//   - Топ източници: следва range-а (topReferrers7/30/Today) — не е вечно за 90д
//   - Mini AreaChart за visits тенденция (последните 14 дни)
//   - Order status mini pie в footer-а на поръчките card
//   - Дата на поръчката в листа (не само order_number)
//   - Revenue chart: по часове за range=1
//   - Сигнатура на функциите — без (as any), пълни типове

import { useMemo, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell,
} from 'recharts'
import type { AdminStats, PageViewStats } from '@/hooks/useAdminData'
import type { Order, Lead, AffiliateAnalytics } from '@/lib/supabase'
import { STATUS_LABELS } from '@/lib/constants'
import { useCurrency } from './CurrencyContext'
import { RangePicker } from './AnalyticsTab'
import {
  type Range, getRangeLabel, calcTrend,
  filterByRange, filterPrevPeriod, buildRevenueChart, getXAxisInterval,
  toBulgarianDateStr, bgDateNDaysAgo, toBulgarianHour, getCurrentBulgarianHour,
} from './rangeUtils'

interface Props {
  stats:        AdminStats
  orders:       Order[]
  leads:        Lead[]
  analytics:    AffiliateAnalytics | null
  pageViews:    PageViewStats | null
  onRefresh:    () => void
  onViewOrder:  (o: Order) => void
  onTabChange?: (tab: string) => void
  loading?:     boolean
}

// ─── Small components ─────────────────────────────────────────────────────────

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
    <span className={`trend-badge ${up?'up':'down'}`}>
      {up?'↑':'↓'} {Math.abs(trend).toFixed(1)}%
    </span>
  )
}

const STATUS_ICON: Record<string, string> = {
  delivered:'✅', cancelled:'❌', shipped:'🚚', processing:'⚙️', new:'🆕', confirmed:'✔️',
}
const STATUS_PIE_COLOR: Record<string, string> = {
  new:'#f59e0b', confirmed:'#3b82f6', shipped:'#8b5cf6',
  delivered:'#16a34a', cancelled:'#ef4444',
}

// Quick top-bar stat pill
function QuickStat({ icon, label, value, color }: { icon:string; label:string; value:string|number; color:string }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8, padding:'9px 13px',
      background:'#fff', border:'1px solid #e8eaed', borderRadius:10,
      flex:'1 1 130px', minWidth:0, boxSizing:'border-box',
    }}>
      <span style={{ fontSize:17, flexShrink:0 }}>{icon}</span>
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:15, fontWeight:800, color, lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value}</div>
        <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600, marginTop:1 }}>{label}</div>
      </div>
    </div>
  )
}

// Mini visits area sparkline for last 14 days
function VisitsMiniChart({ data }: { data: { date:string; count:number; unique?:number }[] }) {
  const last14 = data.slice(-14)
  if (!last14.length) return null
  return (
    <ResponsiveContainer width="100%" height={44}>
      <AreaChart data={last14} margin={{ top:3, bottom:0, left:0, right:0 }}>
        <defs>
          <linearGradient id="pvMiniGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.18}/>
            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={1.5} fill="url(#pvMiniGrad)" dot={false} />
        <Tooltip
          contentStyle={{ border:'1px solid #e5e7eb', borderRadius:6, fontSize:11, padding:'4px 8px' }}
          formatter={(v:number) => [v, 'Посещения']}
          labelFormatter={l => `📅 ${l}`}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// Mini status breakdown chips
function StatusBreakdown({ orders }: { orders: Order[] }) {
  const counts = useMemo(() => {
    const m: Record<string,number> = {}
    orders.forEach(o => { m[o.status] = (m[o.status]||0)+1 })
    return m
  }, [orders])
  const total = orders.length
  if (!total) return null
  const STATUSES = ['new','confirmed','shipped','delivered','cancelled']
  return (
    <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center' }}>
      {STATUSES.filter(s => counts[s]).map(s => {
        const info = STATUS_LABELS[s] || { label:s, color:'#666', bg:'#f9fafb' }
        return (
          <span key={s} style={{
            fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:99,
            background:info.bg, color:info.color, whiteSpace:'nowrap',
          }}>
            {STATUS_ICON[s]} {counts[s]}
            <span style={{ opacity:.6 }}> ({Math.round(counts[s]/total*100)}%)</span>
          </span>
        )
      })}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSparkline(orders: Order[], days: number) {
  const now   = new Date()
  const dates = Array.from({ length:days }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate()-(days-1-i))
    return toBulgarianDateStr(d)
  })
  const revMap: Record<string,number> = {}
  const ordMap: Record<string,number> = {}
  orders.filter(o => o.status!=='cancelled').forEach(o => {
    const d = toBulgarianDateStr(new Date(o.created_at))
    revMap[d] = (revMap[d]||0) + Number(o.total)
    ordMap[d] = (ordMap[d]||0) + 1
  })
  return {
    revenue: dates.map(d => revMap[d]||0),
    orders:  dates.map(d => ordMap[d]||0),
  }
}

function buildHourlyRevenueChart(orders: Order[]): { date:string; revenue:number; count:number }[] {
  const now      = new Date()
  const todayStr = toBulgarianDateStr(now)
  const maxHour  = getCurrentBulgarianHour()
  const map: Record<number,{revenue:number;count:number}> = {}
  for (let h=0; h<=maxHour; h++) map[h] = { revenue:0, count:0 }
  orders.forEach(o => {
    const d = toBulgarianDateStr(new Date(o.created_at))
    if (d!==todayStr || o.status==='cancelled') return
    const h = toBulgarianHour(new Date(o.created_at))
    if (map[h]) { map[h].revenue += Number(o.total); map[h].count++ }
  })
  return Object.entries(map).map(([h,v]) => ({ date:`${String(h).padStart(2,'0')}ч`, ...v }))
}

function getVisitsForRange(pv: PageViewStats|null, range: Range): number {
  if (!pv) return 0
  if (range===1)   return pv.today   ?? 0
  if (range===7)   return pv.last7   ?? 0
  if (range===30)  return pv.last30  ?? 0
  if (range===90)  return pv.last90  ?? pv.total ?? 0
  if (range===365) return pv.total   ?? 0
  return pv.total ?? pv.last30 ?? 0
}

function getUniqueForRange(pv: PageViewStats|null, range: Range): number {
  if (!pv) return 0
  if (range===1)   return pv.todayUnique  ?? 0
  if (range===7)   return pv.last7Unique  ?? 0
  if (range===30)  return pv.last30Unique ?? 0
  if (range===90)  return pv.last90Unique ?? pv.unique ?? 0
  return pv.unique ?? pv.last30Unique ?? 0
}

// ✅ Правилни refs за всеки range — използва полетата от API v7+
function getRefsForRange(pv: PageViewStats|null, range: Range): {name:string;count:number}[] {
  if (!pv) return []
  if (range===1)  return pv.topReferrersToday ?? pv.topReferrers ?? []
  if (range===7)  return pv.topReferrers7     ?? pv.topReferrers ?? []
  if (range===30) return pv.topReferrers30    ?? pv.topReferrers ?? []
  return pv.topReferrers ?? []
}

function getAffClicksForRange(analytics: AffiliateAnalytics|null, range: Range): { value:number; approx:boolean } {
  if (!analytics) return { value:0, approx:false }
  if (range===1)     return { value:analytics.today      ?? 0, approx:false }
  if (range===7)     return { value:analytics.last7days  ?? 0, approx:false }
  if (range===30)    return { value:analytics.last30days ?? 0, approx:false }
  if (range===90)    return { value:analytics.last90days ?? analytics.last30days ?? 0, approx:!analytics.last90days }
  if (range==='all') return { value:analytics.total      ?? 0, approx:false }
  return { value:analytics.total??0, approx:false }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DashboardTab({
  stats, orders, leads, analytics, pageViews,
  onRefresh, onViewOrder, onTabChange, loading=false,
}: Props) {
  const { fmt: formatPrice } = useCurrency()
  const [hovered, setHovered] = useState<string|null>(null)
  const [range,   setRange]   = useState<Range>(30)

  const recentOrders   = useMemo(() => orders.slice(0, 8),               [orders])
  const filteredOrders = useMemo(() => filterByRange(orders, range),      [orders, range])
  const prevOrders     = useMemo(() => filterPrevPeriod(orders, range),   [orders, range])

  const rangeMetrics = useMemo(() => {
    const active     = filteredOrders.filter(o => o.status!=='cancelled')
    const prevActive = prevOrders.filter(o => o.status!=='cancelled')
    return {
      rev:     active.reduce((s,o)    => s+Number(o.total), 0),
      prevRev: prevActive.reduce((s,o) => s+Number(o.total), 0),
      cnt:     filteredOrders.length,
      prevCnt: prevOrders.length,
    }
  }, [filteredOrders, prevOrders])

  const visitsForRange = useMemo(() => getVisitsForRange(pageViews, range),    [pageViews, range])
  const uniqueForRange = useMemo(() => getUniqueForRange(pageViews, range),    [pageViews, range])
  const refsForRange   = useMemo(() => getRefsForRange(pageViews, range),      [pageViews, range])
  const affResult      = useMemo(() => getAffClicksForRange(analytics, range), [analytics, range])

  const conversionRate = useMemo(() => {
    if (!visitsForRange || !filteredOrders.length) return 0
    return Math.min(99, (filteredOrders.length/visitsForRange)*100)
  }, [visitsForRange, filteredOrders])

  const newLeadsCount = useMemo(() => {
    if (!leads?.length) return 0
    const now = new Date()
    if (range==='all') return leads.length
    if (range===1) {
      const todayBg = toBulgarianDateStr(now)
      return leads.filter(l => l.created_at ? toBulgarianDateStr(new Date(l.created_at))===todayBg : false).length
    }
    const cutoffBg = bgDateNDaysAgo(now, range as number)
    return leads.filter(l => l.created_at ? toBulgarianDateStr(new Date(l.created_at))>=cutoffBg : false).length
  }, [leads, range])

  const revenueChart = useMemo(
    () => range===1 ? buildHourlyRevenueChart(filteredOrders) : buildRevenueChart(filteredOrders, range),
    [filteredOrders, range]
  )
  const sparklines = useMemo(() => buildSparkline(orders, 7), [orders])

  // Status pie for mini chart
  const statusPieData = useMemo(() => {
    const m: Record<string,number> = {}
    filteredOrders.forEach(o => { m[o.status] = (m[o.status]||0)+1 })
    return Object.entries(m)
      .map(([k,v]) => ({ name:k, value:v, color:STATUS_PIE_COLOR[k]||'#9ca3af' }))
      .sort((a,b) => b.value-a.value)
  }, [filteredOrders])

  const rl = getRangeLabel(range)

  const statCards = [
    {
      id:'revenue', label:`Приход (${rl})`, value:formatPrice(rangeMetrics.rev),
      icon:'💶', color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0',
      spark:sparklines.revenue, trend:{ current:rangeMetrics.rev, prev:rangeMetrics.prevRev },
      tab:'analytics', sub:`Днес: ${formatPrice(stats.todayRevenue)} · Тази сед.: ${formatPrice(stats.weekRevenue)}`,
    },
    {
      id:'orders', label:`Поръчки (${rl})`, value:rangeMetrics.cnt,
      icon:'📦', color:'#f59e0b', bg:'#fffbeb', border:'#fde68a',
      spark:sparklines.orders, trend:{ current:rangeMetrics.cnt, prev:rangeMetrics.prevCnt },
      tab:'orders', sub:`Нови: ${stats.newOrders} · Чакат плащане: ${stats.pendingPayments}`,
    },
    {
      id:'conversion', label:`Конверсия (${rl})`, value:`${conversionRate.toFixed(2)}%`,
      icon:'🎯', color:'#6366f1', bg:'#eef2ff', border:'#c7d2fe',
      spark:sparklines.orders, trend:null as null,
      tab:'analytics', sub:visitsForRange>0 ? `${visitsForRange.toLocaleString()} посещения · ${uniqueForRange.toLocaleString()} уник.` : 'Няма данни за посещения',
    },
    {
      id:'leads', label:range==='all'?'Email абонати':`Нови абонати (${rl})`, value:range==='all'?stats.leads:newLeadsCount,
      icon:'✉️', color:'#06b6d4', bg:'#ecfeff', border:'#a5f3fc',
      spark:sparklines.orders, trend:null as null,
      tab:'leads', sub:`Общо записани: ${stats.leads}`,
    },
    {
      id:'affiliate', label:`Affiliate (${rl})`, value:affResult.value.toLocaleString()+(affResult.approx?' ~':''),
      icon:'🔗', color:'#10b981', bg:'#ecfdf5', border:'#a7f3d0',
      spark:sparklines.orders, trend:null as null,
      tab:'analytics', sub:affResult.approx ? '≈ приблизително' : `Всичко: ${(analytics?.total??0).toLocaleString()}`,
    },
    {
      id:'avg', label:'Средна поръчка', value:formatPrice(stats.avgOrderValue),
      icon:'📊', color:'#8b5cf6', bg:'#faf5ff', border:'#e9d5ff',
      spark:sparklines.revenue, trend:null as null,
      tab:'analytics', sub:`Тази сед.: ${formatPrice(stats.weekRevenue)}`,
    },
  ]

  return (
    <div className="dash-root">
      <style>{`
        .dash-root { padding:20px 24px; max-width:1200px; overflow-x:hidden; box-sizing:border-box }
        @media(max-width:640px){ .dash-root { padding:12px 10px } }

        @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }

        .skel-card { background:#f9fafb;border:1px solid #f0f0f0;border-radius:14px;padding:16px 18px;flex:1 1 calc(50% - 5px);min-width:0;box-sizing:border-box }
        .skel-line { border-radius:6px;background:linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%);background-size:400px 100%;animation:shimmer 1.4s infinite }

        .stat-card { flex:1 1 calc(33% - 8px);min-width:0;max-width:100%;border-radius:14px;padding:16px 18px;cursor:pointer;transition:transform .18s,box-shadow .18s;animation:fadeUp .3s ease both;box-sizing:border-box }
        .stat-card:hover { transform:translateY(-2px) }
        @media(max-width:700px){ .stat-card { flex:1 1 calc(50% - 5px) } }
        @media(max-width:360px){ .stat-card { flex:1 1 100% } }

        .trend-badge { font-size:11px;font-weight:700;padding:2px 7px;border-radius:99px }
        .trend-badge.up   { background:#dcfce7;color:#15803d }
        .trend-badge.down { background:#fee2e2;color:#dc2626 }

        .ord-row { display:flex;align-items:center;justify-content:space-between;padding:9px 16px;border-bottom:1px solid #f5f5f5;cursor:pointer;transition:background .12s;min-width:0 }
        .ord-row:hover { background:#f9fafb }
        .ord-row:last-child { border-bottom:none }

        .d-card { background:#fff;border:1px solid #e8eaed;border-radius:14px;overflow:hidden;min-width:0 }
        .d-card-head { padding:13px 18px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap }
        .d-card-head h3 { font-size:13px;font-weight:700;margin:0;color:#111;white-space:nowrap }
        .d-card-body { padding:14px 18px }

        .grid-2 { display:grid;grid-template-columns:1fr 1fr;gap:16px;min-width:0 }
        @media(max-width:700px){ .grid-2 { grid-template-columns:1fr } }

        /* ✅ 5-клетъчен visits grid */
        .grid-visits { display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-bottom:12px }
        @media(max-width:680px){ .grid-visits { grid-template-columns:repeat(3,1fr) } }
        @media(max-width:360px){ .grid-visits { grid-template-columns:repeat(2,1fr) } }

        /* Quick stats top row */
        .quick-row { display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px }
        .quick-row > * { flex:1 1 130px;min-width:0 }
        @media(max-width:480px){ .quick-row > * { flex:1 1 calc(50% - 4px) } }

        .refresh-btn { background:#fff;border:1px solid #e5e7eb;border-radius:9px;padding:7px 14px;cursor:pointer;font-family:inherit;font-size:13px;color:#374151;font-weight:600;transition:all .15s;white-space:nowrap;flex-shrink:0 }
        .refresh-btn:hover { border-color:#16a34a;color:#16a34a }
        .link-btn { font-size:12px;color:#16a34a;background:none;border:none;cursor:pointer;font-family:inherit;font-weight:600;white-space:nowrap;flex-shrink:0 }
        .ref-bar-wrap { height:4px;background:#f3f4f6;border-radius:99px;margin-top:3px }
        .range-scroll { overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px }
        .range-scroll::-webkit-scrollbar { display:none }
        .dash-header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:10px }
        @media(max-width:540px){ .dash-header { flex-direction:column } .dash-controls { width:100%;display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap } }
        .stat-row { display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px }
        .ord-name { max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap }
        .ord-num  { max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap }
        @media(max-width:400px){ .ord-row{padding:8px 10px} .ord-name{max-width:100px} .ord-num{max-width:65px} }
        @media(max-width:640px){ .recharts-wrapper { font-size:10px } }
      `}</style>

      {/* ── Header ── */}
      <div className="dash-header">
        <div>
          <h1 style={{ fontSize:20, fontWeight:900, color:'#111', letterSpacing:'-.02em', margin:0 }}>Дашборд</h1>
          <p style={{ fontSize:12, color:'#94a3b8', margin:'2px 0 0' }}>
            {new Date().toLocaleDateString('bg-BG', { weekday:'long', year:'numeric', month:'long', day:'numeric', timeZone:'Europe/Sofia' })}
          </p>
        </div>
        <div className="dash-controls" style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <div className="range-scroll"><RangePicker range={range} onChange={setRange} /></div>
          <button className="refresh-btn" onClick={onRefresh}>🔄 Обнови</button>
        </div>
      </div>

      {/* ── Quick Stats Bar ── */}
      <div className="quick-row">
        <QuickStat icon="🆕"  label="Нови поръчки"      value={stats.newOrders}                      color="#f59e0b" />
        <QuickStat icon="⏳"  label="Чакат плащане"     value={stats.pendingPayments}                 color="#ef4444" />
        <QuickStat icon="📅"  label="Приход днес"       value={formatPrice(stats.todayRevenue)}       color="#16a34a" />
        <QuickStat icon="📆"  label="Приход тази сед."  value={formatPrice(stats.weekRevenue)}        color="#0ea5e9" />
        <QuickStat icon="📊"  label="Средна поръчка"    value={formatPrice(stats.avgOrderValue)}      color="#8b5cf6" />
        {pageViews && (
          <QuickStat icon="👁️" label={`Посещения (${rl})`} value={visitsForRange.toLocaleString()}   color="#6366f1" />
        )}
      </div>

      {/* ── KPI Stat Cards ── */}
      <div className="stat-row">
        {loading
          ? Array.from({length:6}).map((_,i) => <SkeletonCard key={i} />)
          : statCards.map((c,i) => (
            <div key={c.id} className="stat-card"
              onClick={() => onTabChange?.(c.tab)}
              onMouseEnter={() => setHovered(c.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: c.bg,
                border:    `1px solid ${hovered===c.id ? c.color+'55' : c.border}`,
                boxShadow:  hovered===c.id ? `0 6px 24px ${c.color}18` : 'none',
                animationDelay:`${i*.04}s`,
              }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <span style={{ fontSize:18 }}>{c.icon}</span>
                {c.trend && <TrendBadge current={c.trend.current} prev={c.trend.prev} />}
              </div>
              <div style={{ fontSize:22, fontWeight:900, color:c.color, letterSpacing:'-.02em', lineHeight:1.2 }}>{c.value}</div>
              <div style={{ fontSize:11, color:'#6b7280', fontWeight:500, marginBottom:6 }}>{c.label}</div>
              <div style={{ margin:'0 -4px' }}><Sparkline data={c.spark} color={c.color} /></div>
              {c.sub && (
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:6, paddingTop:6, borderTop:`1px solid ${c.border}` }}>{c.sub}</div>
              )}
            </div>
          ))}
      </div>

      {/* ── Revenue Chart ── */}
      <div className="d-card" style={{ marginBottom:16 }}>
        <div className="d-card-head">
          <h3>💶 Приход — {rl}</h3>
          <div style={{ display:'flex', gap:14, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:12, color:'#94a3b8' }}>
              Поръчки: <strong style={{ color:'#f59e0b' }}>{rangeMetrics.cnt}</strong>
            </span>
            <span style={{ fontSize:12, color:'#94a3b8' }}>
              Общо: <strong style={{ color:'#16a34a' }}>{formatPrice(rangeMetrics.rev)}</strong>
            </span>
          </div>
        </div>
        <div className="d-card-body" style={{ paddingTop:8 }}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueChart}>
              <defs>
                <linearGradient id="revGrad-db" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.14}/>
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
              <XAxis dataKey="date" tick={{fontSize:10,fill:'#94a3b8'}} tickLine={false} axisLine={false} interval={range===1?1:getXAxisInterval(range)}/>
              <YAxis tick={{fontSize:10,fill:'#94a3b8'}} tickLine={false} axisLine={false} tickFormatter={v=>`${v}€`} width={44} domain={[0,(dataMax:number)=>Math.ceil((dataMax||1)*1.2)]}/>
              <Tooltip
                formatter={(v:number, name:string) => [name==='revenue'?formatPrice(v):v, name==='revenue'?'Приход':'Поръчки']}
                contentStyle={{border:'1px solid #e5e7eb',borderRadius:8,fontSize:12,boxShadow:'0 4px 12px rgba(0,0,0,.06)'}}
              />
              <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2.5} fill="url(#revGrad-db)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Последни поръчки + Посещения ── */}
      <div className="grid-2">

        {/* Последни поръчки */}
        <div className="d-card">
          <div className="d-card-head">
            <h3>📦 Последни поръчки</h3>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {onTabChange && (
                <button className="link-btn" onClick={()=>onTabChange('orders')}>Всички →</button>
              )}
            </div>
          </div>

          {/* Status breakdown */}
          {filteredOrders.length > 0 && (
            <div style={{ padding:'8px 16px', borderBottom:'1px solid #f5f5f5', background:'#fafafa' }}>
              <StatusBreakdown orders={filteredOrders} />
            </div>
          )}

          {recentOrders.length === 0 ? (
            <div style={{padding:'32px',textAlign:'center',color:'#94a3b8',fontSize:13}}>
              <div style={{fontSize:32,marginBottom:8}}>📭</div>Няма поръчки
            </div>
          ) : recentOrders.map(o => {
            const s = STATUS_LABELS[o.status] || { label:o.status, color:'#666', bg:'#f9fafb' }
            const bgDate = toBulgarianDateStr(new Date(o.created_at))
            return (
              <div key={o.id} className="ord-row" onClick={()=>onViewOrder(o)}>
                <div style={{display:'flex',alignItems:'center',gap:9,minWidth:0,flex:1}}>
                  <div style={{width:32,height:32,borderRadius:8,background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>
                    {STATUS_ICON[o.status]||'📦'}
                  </div>
                  <div style={{minWidth:0}}>
                    <div className="ord-name" style={{fontSize:13,fontWeight:600,color:'#111'}}>{o.customer_name}</div>
                    <div style={{display:'flex',gap:5,alignItems:'center',marginTop:1}}>
                      <span className="ord-num" style={{fontSize:10,color:'#94a3b8',fontFamily:'monospace'}}>{o.order_number}</span>
                      <span style={{fontSize:10,color:'#d1d5db'}}>·</span>
                      <span style={{fontSize:10,color:'#94a3b8'}}>{bgDate}</span>
                    </div>
                  </div>
                </div>
                <div style={{textAlign:'right',flexShrink:0,marginLeft:8}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#16a34a',whiteSpace:'nowrap'}}>{formatPrice(o.total)}</div>
                  <span style={{fontSize:10,padding:'2px 7px',borderRadius:99,background:s.bg,color:s.color,fontWeight:700,whiteSpace:'nowrap'}}>{s.label}</span>
                </div>
              </div>
            )
          })}

          {/* Mini pie footer */}
          {statusPieData.length > 0 && (
            <div style={{padding:'10px 16px',borderTop:'1px solid #f5f5f5',display:'flex',alignItems:'center',gap:10}}>
              <PieChart width={48} height={48}>
                <Pie data={statusPieData} cx={23} cy={23} innerRadius={11} outerRadius={22} paddingAngle={2} dataKey="value" strokeWidth={0}>
                  {statusPieData.map((e,i) => <Cell key={i} fill={e.color}/>)}
                </Pie>
              </PieChart>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',flex:1}}>
                {statusPieData.map(s => (
                  <span key={s.name} style={{fontSize:10,color:s.color,fontWeight:700,display:'flex',alignItems:'center',gap:3}}>
                    <span style={{width:6,height:6,borderRadius:99,background:s.color,display:'inline-block'}}/>
                    {STATUS_LABELS[s.name]?.label||s.name}: {s.value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Посещения */}
        {pageViews ? (
          <div className="d-card">
            <div className="d-card-head">
              <h3>👁️ Посещения</h3>
              <span style={{fontSize:11,color:'#94a3b8'}}>
                {uniqueForRange.toLocaleString()} уникални ({rl})
              </span>
            </div>
            <div className="d-card-body">

              {/* ✅ 5 клетки */}
              <div className="grid-visits">
                {([
                  {label:'Днес',   value:pageViews.today,  unique:pageViews.todayUnique,  color:'#6366f1', match:range===1 },
                  {label:'7 дни',  value:pageViews.last7,  unique:pageViews.last7Unique,  color:'#0ea5e9', match:range===7 },
                  {label:'30 дни', value:pageViews.last30, unique:pageViews.last30Unique, color:'#8b5cf6', match:range===30},
                  {label:'90 дни', value:pageViews.last90  ?? pageViews.total, unique:pageViews.last90Unique ?? pageViews.unique, color:'#f59e0b', match:range===90},
                  {label:'Всичко', value:pageViews.total   ?? pageViews.last30, unique:pageViews.unique ?? pageViews.last30Unique, color:'#111', match:range==='all'||(range as number)>=365},
                ]).map(r => (
                  <div key={r.label} style={{
                    borderRadius:9, padding:'8px 8px', transition:'all .2s',
                    background: r.match ? '#f0fdf4' : '#f9fafb',
                    border:     r.match ? `2px solid ${r.color}` : '1px solid #f0f0f0',
                    minWidth:0,
                  }}>
                    <div style={{fontSize:8,color:'#94a3b8',fontWeight:700,marginBottom:2,textTransform:'uppercase',letterSpacing:'.04em'}}>{r.label}</div>
                    <div style={{fontSize:14,fontWeight:800,color:r.color,lineHeight:1.15}}>{(r.value??0).toLocaleString()}</div>
                    <div style={{fontSize:8,color:'#94a3b8',marginTop:1}}>{(r.unique??0).toLocaleString()} уник.</div>
                  </div>
                ))}
              </div>

              {/* Mini sparkline */}
              {pageViews.dailyChart?.length > 0 && (
                <div style={{marginBottom:12}}>
                  <VisitsMiniChart data={pageViews.dailyChart} />
                </div>
              )}

              {/* Mobile % */}
              <div style={{marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                  <span style={{color:'#374151',fontWeight:600}}>📱 Мобилни</span>
                  <span style={{fontWeight:700}}>{pageViews.mobilePercent}%</span>
                </div>
                <div style={{height:5,background:'#f3f4f6',borderRadius:99,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pageViews.mobilePercent}%`,background:'linear-gradient(90deg,#6366f1,#8b5cf6)',borderRadius:99,transition:'width .6s ease'}}/>
                </div>
              </div>

              {/* ✅ Топ източници — следват range-а */}
              {refsForRange.length > 0 && (
                <div>
                  <div style={{fontSize:10,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:8}}>
                    Топ източници ({rl})
                  </div>
                  {refsForRange.slice(0,6).map((r,i) => {
                    const maxCount = refsForRange[0].count
                    return (
                      <div key={r.name} style={{marginBottom:6}}>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
                          <span style={{color:'#374151',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'75%'}}>{r.name}</span>
                          <span style={{fontWeight:700,flexShrink:0}}>{r.count}</span>
                        </div>
                        <div className="ref-bar-wrap">
                          <div style={{
                            height:'100%', width:`${(r.count/maxCount)*100}%`,
                            background:['#16a34a','#0ea5e9','#8b5cf6','#f59e0b','#ef4444','#06b6d4'][i]||'#94a3b8',
                            borderRadius:99,
                          }}/>
                        </div>
                      </div>
                    )
                  })}
                  {onTabChange && refsForRange.length > 6 && (
                    <button className="link-btn" style={{marginTop:6}} onClick={()=>onTabChange('analytics')}>
                      +{refsForRange.length-6} още →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="d-card">
            <div className="d-card-head"><h3>📊 Обобщение</h3></div>
            <div className="d-card-body">
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[
                  {label:'Общ приход',    value:formatPrice(stats.revenue),       color:'#16a34a'},
                  {label:'Общо поръчки',  value:stats.totalOrders,                color:'#f59e0b'},
                  {label:'Email абонати', value:stats.leads,                      color:'#06b6d4'},
                  {label:'Средна поръчка',value:formatPrice(stats.avgOrderValue),  color:'#8b5cf6'},
                ].map(item => (
                  <div key={item.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',background:'#f9fafb',borderRadius:10,border:'1px solid #f0f0f0'}}>
                    <span style={{fontSize:13,color:'#374151'}}>{item.label}</span>
                    <span style={{fontSize:16,fontWeight:800,color:item.color}}>{item.value}</span>
                  </div>
                ))}
              </div>
              <div style={{marginTop:14,padding:'12px',background:'#fff7ed',borderRadius:10,border:'1px solid #fed7aa',fontSize:12,color:'#92400e'}}>
                ⚠️ Данните за посещения не се зареждат. Провери дали <code>PageViewTracker</code> е добавен в layout.tsx
              </div>
            </div>
          </div>
        )}
      </div>
      <div style={{height:24}}/>
    </div>
  )
}
