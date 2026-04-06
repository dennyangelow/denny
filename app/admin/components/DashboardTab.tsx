'use client'
// app/admin/components/DashboardTab.tsx — v6 redesigned

import { useMemo, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts'
import type { AdminStats, PageViewStats } from '@/hooks/useAdminData'
import type { Order, Lead, AffiliateAnalytics } from '@/lib/supabase'
import { STATUS_LABELS } from '@/lib/constants'
import { useCurrency } from './CurrencyContext'

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

function Sparkline({ data, color }: { data: number[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2}
          dot={false} animationDuration={500} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function SkeletonCard() {
  return (
    <div className="skel-card">
      {[55, 75, 40].map((w, i) => (
        <div key={i} className="skel-line" style={{ width: `${w}%`, height: i === 1 ? 24 : 10, marginBottom: i < 2 ? 8 : 0 }} />
      ))}
    </div>
  )
}

function TrendBadge({ value }: { value: number }) {
  const up = value >= 0
  return (
    <span className={`trend ${up ? 'up' : 'down'}`}>
      {up ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%
    </span>
  )
}

const STATUS_ICON: Record<string, string> = {
  delivered: '✅', cancelled: '❌', shipped: '🚚', processing: '⚙️', new: '🆕',
}

export function DashboardTab({
  stats, orders, leads, analytics, pageViews,
  onRefresh, onViewOrder, onTabChange, loading = false,
}: Props) {
  const { fmt: formatPrice } = useCurrency()
  const [hovered, setHovered] = useState<string | null>(null)
  const recentOrders = useMemo(() => orders.slice(0, 6), [orders])

  const revenueChart = useMemo(() => {
    const map: Record<string, number> = {}
    orders.filter(o => o.status !== 'cancelled').forEach(o => {
      const d = o.created_at.slice(0, 10)
      map[d] = (map[d] || 0) + Number(o.total)
    })
    const now = new Date()
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now.getTime() - (29 - i) * 86400000).toISOString().slice(0, 10)
      return { date: d.slice(5), revenue: map[d] || 0 }
    })
  }, [orders])

  const sparklines = useMemo(() => {
    const now = new Date()
    const days7 = Array.from({ length: 7 }, (_, i) =>
      new Date(now.getTime() - (6 - i) * 86400000).toISOString().slice(0, 10)
    )
    const revMap: Record<string, number> = {}
    const ordMap: Record<string, number> = {}
    orders.filter(o => o.status !== 'cancelled').forEach(o => {
      const d = o.created_at.slice(0, 10)
      revMap[d] = (revMap[d] || 0) + Number(o.total)
      ordMap[d] = (ordMap[d] || 0) + 1
    })
    return {
      revenue: days7.map(d => revMap[d] || 0),
      orders:  days7.map(d => ordMap[d] || 0),
    }
  }, [orders])

  const trends = useMemo(() => {
    const now = Date.now()
    const last7 = orders.filter(o => new Date(o.created_at).getTime() > now - 7 * 86400000)
    const prev7 = orders.filter(o => {
      const t = new Date(o.created_at).getTime()
      return t > now - 14 * 86400000 && t <= now - 7 * 86400000
    })
    const lastRev = last7.reduce((s, o) => s + Number(o.total), 0)
    const prevRev = prev7.reduce((s, o) => s + Number(o.total), 0)
    return {
      revenue: prevRev ? ((lastRev - prevRev) / prevRev) * 100 : 0,
      orders:  prev7.length ? ((last7.length - prev7.length) / prev7.length) * 100 : 0,
    }
  }, [orders])

  const statCards = [
    { id: 'revenue',    label: 'Общ приход',        value: formatPrice(stats.revenue),                          icon: '💶', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', spark: sparklines.revenue, trend: trends.revenue,  tab: 'analytics', sub: `Днес: ${formatPrice(stats.todayRevenue)}` },
    { id: 'week',       label: 'Тази седмица',      value: formatPrice(stats.weekRevenue),                      icon: '📆', color: '#8b5cf6', bg: '#faf5ff', border: '#e9d5ff', spark: sparklines.revenue, trend: null,            tab: 'analytics', sub: `Ср. поръчка: ${formatPrice(stats.avgOrderValue)}` },
    { id: 'orders',     label: 'Поръчки',            value: stats.totalOrders,                                   icon: '📦', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', spark: sparklines.orders,  trend: trends.orders,   tab: 'orders',    sub: `Нови: ${stats.newOrders}` },
    { id: 'conversion', label: 'Конверсия (30д)',    value: `${stats.conversionRate.toFixed(2)}%`,               icon: '🎯', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe', spark: sparklines.orders,  trend: null,            tab: 'analytics', sub: pageViews ? `${pageViews.last30.toLocaleString()} посещения` : '' },
    { id: 'leads',      label: 'Email абонати',      value: stats.leads,                                         icon: '✉️', color: '#06b6d4', bg: '#ecfeff', border: '#a5f3fc', spark: sparklines.orders,  trend: null,            tab: 'leads',     sub: 'Общо записани' },
    { id: 'affiliate',  label: 'Affiliate (30д)',    value: analytics?.last30days?.toLocaleString() || '—',     icon: '🔗', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', spark: sparklines.orders,  trend: null,            tab: 'analytics', sub: 'Кликове' },
  ]

  return (
    <div className="dash-root">
      <style>{`
        .dash-root{padding:20px 24px;max-width:1200px}
        @media(max-width:640px){.dash-root{padding:14px 12px}}

        /* animations */
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}

        /* skeleton */
        .skel-card{background:#f9fafb;border:1px solid #f0f0f0;border-radius:14px;padding:16px 18px;flex:1;min-width:140px}
        .skel-line{border-radius:6px;background:linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%);background-size:400px 100%;animation:shimmer 1.4s infinite}

        /* stat cards */
        .stat-card{flex:1;min-width:140px;border-radius:14px;padding:16px 18px;cursor:pointer;transition:transform .18s,box-shadow .18s;animation:fadeUp .3s ease both}
        .stat-card:hover{transform:translateY(-2px)}

        /* trend badges */
        .trend{font-size:11px;font-weight:700;padding:2px 7px;border-radius:99px}
        .trend.up{background:#dcfce7;color:#15803d}
        .trend.down{background:#fee2e2;color:#dc2626}

        /* order rows */
        .ord-row{display:flex;align-items:center;justify-content:space-between;padding:10px 18px;border-bottom:1px solid #f5f5f5;cursor:pointer;transition:background .1s}
        .ord-row:hover{background:#f9fafb}
        .ord-row:last-child{border-bottom:none}

        /* referrers */
        .ref-row{margin-bottom:8px}
        .ref-bar-track{height:4px;background:#f3f4f6;border-radius:99px;margin-top:3px}

        /* refresh btn */
        .refresh-btn{background:#fff;border:1px solid #e5e7eb;border-radius:9px;padding:7px 14px;cursor:pointer;font-family:inherit;font-size:13px;color:#374151;font-weight:600;transition:all .15s}
        .refresh-btn:hover{border-color:#16a34a;color:#16a34a}

        /* grid helpers */
        .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
        @media(max-width:700px){.grid-2{grid-template-columns:1fr}.grid-3{grid-template-columns:1fr 1fr}}
        @media(max-width:440px){.grid-3{grid-template-columns:1fr}}

        /* card */
        .card{background:#fff;border:1px solid #e8eaed;border-radius:14px;overflow:hidden}
        .card-head{padding:14px 18px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center}
        .card-head h3{font-size:13px;font-weight:700;margin:0;color:#111}
        .card-body{padding:16px 18px}
        .link-btn{font-size:12px;color:#16a34a;background:none;border:none;cursor:pointer;font-family:inherit;font-weight:600}
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:900, color:'#111', letterSpacing:'-.02em', margin:0 }}>Дашборд</h1>
          <p style={{ fontSize:12, color:'#9ca3af', margin:'2px 0 0' }}>
            {new Date().toLocaleDateString('bg-BG', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </p>
        </div>
        <button className="refresh-btn" onClick={onRefresh}>🔄 Обнови</button>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:20 }}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : statCards.map((c, i) => (
            <div key={c.id} className="stat-card"
              onClick={() => onTabChange?.(c.tab)}
              onMouseEnter={() => setHovered(c.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: c.bg,
                border: `1px solid ${hovered === c.id ? c.color + '60' : c.border}`,
                boxShadow: hovered === c.id ? `0 6px 20px ${c.color}18` : 'none',
                animationDelay: `${i * 0.04}s`,
              }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <span style={{ fontSize:16 }}>{c.icon}</span>
                {c.trend !== null && <TrendBadge value={c.trend} />}
              </div>
              <div style={{ fontSize:22, fontWeight:900, color:c.color, letterSpacing:'-.02em', lineHeight:1.2 }}>{c.value}</div>
              <div style={{ fontSize:11, color:'#6b7280', fontWeight:500, marginBottom:6 }}>{c.label}</div>
              <div style={{ margin:'0 -4px' }}><Sparkline data={c.spark} color={c.color} /></div>
              {c.sub && (
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:6, paddingTop:6, borderTop:`1px solid ${c.border}` }}>
                  {c.sub}
                </div>
              )}
            </div>
          ))}
      </div>

      {/* ── Revenue Chart ───────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-head">
          <h3>💶 Приход — последните 30 дни</h3>
          <span style={{ fontSize:12, color:'#9ca3af' }}>
            Общо: <strong style={{ color:'#16a34a' }}>{formatPrice(stats.revenue)}</strong>
          </span>
        </div>
        <div className="card-body" style={{ paddingTop:10 }}>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={revenueChart}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize:10, fill:'#9ca3af' }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fontSize:10, fill:'#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} width={44} />
              <Tooltip
                formatter={(v: number) => [formatPrice(v), 'Приход']}
                contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12, boxShadow:'0 4px 12px rgba(0,0,0,.06)' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2.5} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Recent Orders + Page Views ──────────────────────────────── */}
      <div className="grid-2">
        {/* Orders */}
        <div className="card">
          <div className="card-head">
            <h3>📦 Последни поръчки</h3>
            {onTabChange && (
              <button className="link-btn" onClick={() => onTabChange('orders')}>
                Всички →
              </button>
            )}
          </div>
          {recentOrders.length === 0 ? (
            <div style={{ padding:'32px', textAlign:'center', color:'#9ca3af', fontSize:13 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>📭</div>Няма поръчки
            </div>
          ) : recentOrders.map(o => {
            const s = STATUS_LABELS[o.status]
            return (
              <div key={o.id} className="ord-row" onClick={() => onViewOrder(o)}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:32, height:32, borderRadius:9, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
                    {STATUS_ICON[o.status] || '📦'}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#111' }}>{o.customer_name}</div>
                    <div style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace' }}>{o.order_number}</div>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#16a34a' }}>{formatPrice(o.total)}</div>
                  <span style={{ fontSize:10, padding:'2px 7px', borderRadius:99, background:s.bg, color:s.color, fontWeight:700 }}>{s.label}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Page Views */}
        {pageViews && (
          <div className="card">
            <div className="card-head"><h3>👁️ Посещения</h3></div>
            <div className="card-body">
              {/* Mini stats grid */}
              <div className="grid-3" style={{ marginBottom:14 }}>
                {[
                  { label:'Днес',   value:pageViews.today,  unique:pageViews.todayUnique, color:'#6366f1' },
                  { label:'7 дни',  value:pageViews.last7,  unique:pageViews.last7Unique, color:'#0ea5e9' },
                  { label:'30 дни', value:pageViews.last30, unique:pageViews.last30Unique, color:'#8b5cf6' },
                ].map(r => (
                  <div key={r.label} style={{ background:'#f9fafb', borderRadius:10, padding:'10px 12px', border:'1px solid #f0f0f0' }}>
                    <div style={{ fontSize:10, color:'#9ca3af', fontWeight:700, marginBottom:3 }}>{r.label}</div>
                    <div style={{ fontSize:18, fontWeight:800, color:r.color, lineHeight:1.1 }}>{r.value.toLocaleString()}</div>
                    <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>{r.unique} уник.</div>
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
                  <div style={{ height:'100%', width:`${pageViews.mobilePercent}%`, background:'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius:99 }} />
                </div>
              </div>

              {/* Top referrers */}
              {pageViews.topReferrers?.[0] && (
                <div>
                  <div style={{ fontSize:10, fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Топ източници</div>
                  {pageViews.topReferrers.slice(0, 4).map((r, i) => {
                    const maxCount = pageViews.topReferrers![0].count
                    return (
                      <div key={r.name} className="ref-row">
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                          <span style={{ color:'#374151' }}>{r.name}</span>
                          <span style={{ fontWeight:700 }}>{r.count}</span>
                        </div>
                        <div className="ref-bar-track">
                          <div style={{ height:'100%', width:`${(r.count/maxCount)*100}%`, background:['#16a34a','#0ea5e9','#8b5cf6','#f59e0b'][i], borderRadius:99 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
