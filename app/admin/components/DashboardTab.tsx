'use client'
// app/admin/components/DashboardTab.tsx — v4 с евро

import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { AdminStats, PageViewStats } from '@/hooks/useAdminData'
import type { Order, Lead, AffiliateAnalytics } from '@/lib/supabase'
import { STATUS_LABELS, formatPrice } from '@/lib/constants'

interface Props {
  stats:     AdminStats
  orders:    Order[]
  leads:     Lead[]
  analytics: AffiliateAnalytics | null
  pageViews: PageViewStats | null
  onRefresh: () => void
  onViewOrder: (o: Order) => void
}

export function DashboardTab({ stats, orders, leads, analytics, pageViews, onRefresh, onViewOrder }: Props) {
  const recentOrders = useMemo(() => orders.slice(0, 8), [orders])

  // Revenue chart — last 30 days
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

  const statCards = [
    { label: 'Общ приход',      value: formatPrice(stats.revenue),         icon: '€', color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Приход днес',     value: formatPrice(stats.todayRevenue),     icon: '📅', color: '#0ea5e9', bg: '#f0f9ff' },
    { label: 'Приход тази седм.',value: formatPrice(stats.weekRevenue),     icon: '📆', color: '#8b5cf6', bg: '#faf5ff' },
    { label: 'Поръчки общо',    value: stats.totalOrders,                   icon: '📦', color: '#f59e0b', bg: '#fffbeb' },
    { label: 'Нови поръчки',    value: stats.newOrders,                     icon: '🆕', color: '#ef4444', bg: '#fef2f2' },
    { label: 'Email абоната',   value: stats.leads,                         icon: '✉️', color: '#06b6d4', bg: '#ecfeff' },
    { label: 'Ср. поръчка',     value: formatPrice(stats.avgOrderValue),    icon: '📊', color: '#10b981', bg: '#ecfdf5' },
    { label: 'Конверсия (30д)', value: `${stats.conversionRate.toFixed(2)}%`,icon: '🎯', color: '#6366f1', bg: '#eef2ff' },
  ]

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Дашборд</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>
            {new Date().toLocaleDateString('bg-BG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={onRefresh} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--text)', transition: 'all .15s' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#2d6a4f')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          🔄 Обнови
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
        {statCards.map(c => (
          <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.color}22`, borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: c.color, marginBottom: 2 }}>{c.value}</div>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px', color: 'var(--text)' }}>Приход — последните 30 дни</h2>
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
            <Tooltip
              formatter={(v: number) => [formatPrice(v), 'Приход']}
              contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 12 }}
            />
            <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} fill="url(#revGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Page views + recent orders */}
      <div style={{ display: 'grid', gridTemplateColumns: pageViews ? '1fr 1fr' : '1fr', gap: 20 }}>
        {/* Recent orders */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
            Последни поръчки
          </div>
          {recentOrders.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Няма поръчки</div>
          ) : (
            recentOrders.map(o => {
              const s = STATUS_LABELS[o.status]
              return (
                <div key={o.id} onClick={() => onViewOrder(o)} style={{ padding: '12px 20px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{o.customer_name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{o.order_number}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{formatPrice(o.total)}</div>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: s.bg, color: s.color, fontWeight: 700 }}>{s.label}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Page views summary */}
        {pageViews && (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Посещения</div>
            {[
              { label: 'Днес',         value: pageViews.today,    sub: `${pageViews.todayUnique} уникални` },
              { label: 'Последни 7д',  value: pageViews.last7,    sub: `${pageViews.last7Unique} уникални` },
              { label: 'Последни 30д', value: pageViews.last30,   sub: `${pageViews.last30Unique} уникални` },
              { label: 'Мобилни',      value: `${pageViews.mobilePercent}%`, sub: 'от всички' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
                <div>
                  <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{row.label}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{row.sub}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>{row.value}</div>
              </div>
            ))}
            {pageViews.topReferrers?.[0] && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8 }}>Топ източници</div>
                {pageViews.topReferrers.slice(0, 4).map(r => (
                  <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: '#374151' }}>{r.name}</span>
                    <span style={{ fontWeight: 700 }}>{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
