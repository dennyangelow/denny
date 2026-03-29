'use client'
// app/admin/components/DashboardTab.tsx — v5 с trends, sparklines, skeleton

import { useMemo, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts'
import type { AdminStats, PageViewStats } from '@/hooks/useAdminData'
import type { Order, Lead, AffiliateAnalytics } from '@/lib/supabase'
import { STATUS_LABELS, formatPrice } from '@/lib/constants'

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
  const points = data.map((v, i) => ({ i, v }))
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={points} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.8}
          dot={false} animationDuration={600} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function SkeletonCard() {
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #f0f0f0', borderRadius: 16, padding: '18px 20px' }}>
      <style>{`@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`}</style>
      {[60, 80, 40].map((w, i) => (
        <div key={i} style={{
          height: i === 1 ? 28 : 12, width: `${w}%`, borderRadius: 6, marginBottom: i === 2 ? 0 : 10,
          background: 'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)',
          backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite',
        }} />
      ))}
    </div>
  )
}

function TrendBadge({ value }: { value: number }) {
  const up = value >= 0
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
      background: up ? '#dcfce7' : '#fee2e2',
      color: up ? '#15803d' : '#dc2626',
      display: 'inline-flex', alignItems: 'center', gap: 2,
    }}>
      {up ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%
    </span>
  )
}

export function DashboardTab({
  stats, orders, leads, analytics, pageViews,
  onRefresh, onViewOrder, onTabChange, loading = false,
}: Props) {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const recentOrders = useMemo(() => orders.slice(0, 8), [orders])

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
    {
      id: 'revenue', label: 'Общ приход', value: formatPrice(stats.revenue),
      icon: '€', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0',
      sparkData: sparklines.revenue, trend: trends.revenue,
      tab: 'analytics', sub: `Днес: ${formatPrice(stats.todayRevenue)}`,
    },
    {
      id: 'week', label: 'Приход тази седм.', value: formatPrice(stats.weekRevenue),
      icon: '📆', color: '#8b5cf6', bg: '#faf5ff', border: '#e9d5ff',
      sparkData: sparklines.revenue, trend: null,
      tab: 'analytics', sub: `Ср. поръчка: ${formatPrice(stats.avgOrderValue)}`,
    },
    {
      id: 'orders', label: 'Поръчки общо', value: stats.totalOrders,
      icon: '📦', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a',
      sparkData: sparklines.orders, trend: trends.orders,
      tab: 'orders', sub: `Нови: ${stats.newOrders}`,
    },
    {
      id: 'conversion', label: 'Конверсия (30д)', value: `${stats.conversionRate.toFixed(2)}%`,
      icon: '🎯', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe',
      sparkData: sparklines.orders, trend: null,
      tab: 'analytics', sub: pageViews ? `${pageViews.last30.toLocaleString()} посещения` : '',
    },
    {
      id: 'leads', label: 'Email абонати', value: stats.leads,
      icon: '✉️', color: '#06b6d4', bg: '#ecfeff', border: '#a5f3fc',
      sparkData: sparklines.orders, trend: null,
      tab: 'leads', sub: 'Общо записани',
    },
    {
      id: 'affiliate', label: 'Affiliate кликове', value: analytics?.last30days?.toLocaleString() || '—',
      icon: '🔗', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0',
      sparkData: sparklines.orders, trend: null,
      tab: 'analytics', sub: 'Последни 30 дни',
    },
  ]

  const statusIcon: Record<string, string> = {
    delivered: '✅', cancelled: '❌', shipped: '🚚', processing: '⚙️', new: '🆕',
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .stat-card{transition:transform .18s,box-shadow .18s;animation:fadeUp .35s ease both;cursor:pointer}
        .stat-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.08)!important}
        .order-row{transition:background .1s;cursor:pointer}
        .order-row:hover{background:#f9fafb!important}
        .refresh-btn:hover{border-color:#2d6a4f!important;color:#2d6a4f!important}
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Дашборд</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>
            {new Date().toLocaleDateString('bg-BG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button className="refresh-btn" onClick={onRefresh}
          style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--text)', transition: 'all .15s' }}>
          🔄 Обнови
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 14, marginBottom: 24 }}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : statCards.map((c, i) => (
            <div key={c.id} className="stat-card"
              onClick={() => onTabChange?.(c.tab)}
              onMouseEnter={() => setHoveredCard(c.id)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                background: c.bg,
                border: `1px solid ${hoveredCard === c.id ? c.color + '55' : c.border}`,
                borderRadius: 16, padding: '18px 20px',
                animationDelay: `${i * 0.05}s`,
                boxShadow: hoveredCard === c.id ? `0 8px 24px ${c.color}18` : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>{c.icon}</span>
                {c.trend !== null && <TrendBadge value={c.trend} />}
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: c.color, margin: '4px 0 2px', letterSpacing: '-.02em' }}>
                {c.value}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, marginBottom: 8 }}>{c.label}</div>
              <div style={{ margin: '0 -4px' }}>
                <Sparkline data={c.sparkData} color={c.color} />
              </div>
              {c.sub && (
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, borderTop: `1px solid ${c.border}`, paddingTop: 6 }}>
                  {c.sub}
                </div>
              )}
            </div>
          ))
        }
      </div>

      {/* Revenue chart */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Приход — последните 30 дни</h2>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            Общо: <strong style={{ color: '#16a34a' }}>{formatPrice(stats.revenue)}</strong>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={revenueChart}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#16a34a" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={4} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} width={48} />
            <Tooltip formatter={(v: number) => [formatPrice(v), 'Приход']} contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 12 }} />
            <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} fill="url(#revGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recent orders + page views */}
      <div style={{ display: 'grid', gridTemplateColumns: pageViews ? '1fr 1fr' : '1fr', gap: 20 }}>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Последни поръчки</span>
            {onTabChange && (
              <button onClick={() => onTabChange('orders')}
                style={{ fontSize: 12, color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                Виж всички →
              </button>
            )}
          </div>
          {recentOrders.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              Няма поръчки
            </div>
          ) : recentOrders.map(o => {
            const s = STATUS_LABELS[o.status]
            return (
              <div key={o.id} className="order-row" onClick={() => onViewOrder(o)}
                style={{ padding: '11px 20px', borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    {statusIcon[o.status] || '📦'}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{o.customer_name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{o.order_number}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{formatPrice(o.total)}</div>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: s.bg, color: s.color, fontWeight: 700 }}>{s.label}</span>
                </div>
              </div>
            )
          })}
        </div>

        {pageViews && (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Посещения</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Днес',       value: pageViews.today,  unique: pageViews.todayUnique, color: '#6366f1' },
                { label: 'Тази седм.', value: pageViews.last7,  unique: pageViews.last7Unique, color: '#0ea5e9' },
              ].map(row => (
                <div key={row.label} style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 4 }}>{row.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: row.color }}>{row.value.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{row.unique} уникални</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f5f5f5' }}>
              <span style={{ fontSize: 13, color: '#374151' }}>Последни 30д</span>
              <div>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{pageViews.last30.toLocaleString()}</span>
                <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>{pageViews.last30Unique} уникални</span>
              </div>
            </div>
            <div style={{ padding: '12px 0', borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: '#374151' }}>Мобилни</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{pageViews.mobilePercent}%</span>
              </div>
              <div style={{ height: 5, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pageViews.mobilePercent}%`, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: 99 }} />
              </div>
            </div>
            {pageViews.topReferrers?.[0] && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '.04em' }}>Топ източници</div>
                {pageViews.topReferrers.slice(0, 4).map((r, i) => {
                  const maxCount = pageViews.topReferrers![0].count
                  return (
                    <div key={r.name} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: '#374151' }}>{r.name}</span>
                        <span style={{ fontWeight: 700 }}>{r.count}</span>
                      </div>
                      <div style={{ height: 4, background: '#f3f4f6', borderRadius: 99 }}>
                        <div style={{ height: '100%', width: `${(r.count / maxCount) * 100}%`, background: ['#16a34a','#0ea5e9','#8b5cf6','#f59e0b'][i], borderRadius: 99 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
