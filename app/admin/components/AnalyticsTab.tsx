'use client'
// app/admin/components/AnalyticsTab.tsx

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import type { Order, AffiliateAnalytics } from '@/lib/supabase'
import { STATUS_LABELS } from '@/lib/constants'

interface Props {
  analytics: AffiliateAnalytics | null
  orders: Order[]
}

const PIE_COLORS = ['#2d6a4f', '#40916c', '#74c69d', '#b7e4c7', '#d8f3dc']

export function AnalyticsTab({ analytics, orders }: Props) {
  // Revenue by day (last 14)
  const revenueData = (() => {
    const m: Record<string, number> = {}
    orders.filter(o => o.status !== 'cancelled').forEach(o => {
      const day = o.created_at.slice(5, 10) // MM-DD
      m[day] = (m[day] || 0) + o.total
    })
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).slice(-14)
      .map(([date, total]) => ({ date, total: Math.round(total * 100) / 100 }))
  })()

  // Orders by status
  const statusData = Object.entries(STATUS_LABELS).map(([key, s]) => ({
    name: s.label,
    value: orders.filter(o => o.status === key).length,
    color: s.color,
  })).filter(d => d.value > 0)

  // Affiliate by partner
  const partnerData = Object.entries(analytics?.byPartner || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const maxClicks = Math.max(...partnerData.map(p => p.value), 1)

  // Product clicks
  const productData = Object.entries(analytics?.byProduct || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // Payment method breakdown
  const paymentData = (['cod', 'bank', 'card'] as const).map(m => ({
    name: m === 'cod' ? 'Наложен платеж' : m === 'bank' ? 'Банков превод' : 'Карта',
    value: orders.filter(o => o.payment_method === m).length,
  })).filter(d => d.value > 0)

  return (
    <div className="analytics-root">
      <div className="analytics-header">
        <h1 className="page-title">Аналитика</h1>
        <p className="page-sub">Последни {orders.length} поръчки · {analytics?.total || 0} афилиейт клика</p>
      </div>

      <div className="analytics-grid">
        {/* Revenue chart */}
        <div className="section-card span-2">
          <div className="card-hd"><h2>Приход (последните 14 дни)</h2></div>
          {revenueData.length > 0 ? (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                    tickFormatter={v => `${v} лв.`} width={70} />
                  <Tooltip
                    formatter={(v: number) => [`${v.toFixed(2)} лв.`, 'Приход']}
                    contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}
                  />
                  <Bar dataKey="total" fill="#2d6a4f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="empty-chart">Няма данни</div>}
        </div>

        {/* Status pie */}
        <div className="section-card">
          <div className="card-hd"><h2>Поръчки по статус</h2></div>
          {statusData.length > 0 ? (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    dataKey="value" nameKey="name" paddingAngle={3}>
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="empty-chart">Няма данни</div>}
        </div>

        {/* Payment methods */}
        <div className="section-card">
          <div className="card-hd"><h2>Методи на плащане</h2></div>
          {paymentData.length > 0 ? (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    dataKey="value" nameKey="name" paddingAngle={3}>
                    {paymentData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="empty-chart">Няма данни</div>}
        </div>

        {/* Affiliate partner bars */}
        <div className="section-card">
          <div className="card-hd">
            <h2>Афилиейт — партньори</h2>
            <span className="card-badge">{analytics?.last30days || 0} за 30 дни</span>
          </div>
          {partnerData.length > 0 ? (
            <div className="bar-list">
              {partnerData.map(p => (
                <div key={p.name} className="bar-item">
                  <div className="bar-info">
                    <span className="bar-name">{p.name}</span>
                    <span className="bar-val">{p.value}</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill-green" style={{ width: `${(p.value / maxClicks) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="empty-chart">Няма данни</div>}
        </div>

        {/* Product clicks */}
        <div className="section-card">
          <div className="card-hd"><h2>Кликове по продукт</h2></div>
          {productData.length > 0 ? (
            <div className="bar-list">
              {productData.map((p, i) => (
                <div key={p.name} className="bar-item">
                  <div className="bar-info">
                    <span className="bar-name">{p.name}</span>
                    <span className="bar-val">{p.value}</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill-green" style={{
                      width: `${(p.value / (productData[0]?.value || 1)) * 100}%`,
                      background: i === 0 ? '#2d6a4f' : '#74c69d',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="empty-chart">Няма данни</div>}
        </div>
      </div>

      <style>{`
        .analytics-root { padding: 28px 32px; }
        .analytics-header { margin-bottom: 22px; }
        .page-title { font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: -.02em; }
        .page-sub { font-size: 13px; color: var(--muted); margin-top: 2px; }

        .analytics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .span-2 { grid-column: 1 / -1; }
        @media(max-width:900px) { .analytics-grid { grid-template-columns: 1fr; } .span-2 { grid-column: 1; } }

        .section-card {
          background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 20px;
        }
        .card-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .card-hd h2 { font-size: 15px; font-weight: 600; color: var(--text); }
        .card-badge { background: #f3f4f6; color: var(--muted); padding: 3px 9px; border-radius: 99px; font-size: 12px; }
        .empty-chart { text-align: center; color: var(--muted); padding: 40px 0; font-size: 14px; }

        .bar-list { display: flex; flex-direction: column; gap: 12px; }
        .bar-item { display: flex; flex-direction: column; gap: 5px; }
        .bar-info { display: flex; justify-content: space-between; }
        .bar-name { font-size: 13px; color: var(--text); font-weight: 500; }
        .bar-val { font-size: 13px; color: var(--muted); }
        .bar-track { height: 6px; background: #f3f4f6; border-radius: 99px; overflow: hidden; }
        .bar-fill-green { height: 100%; background: #2d6a4f; border-radius: 99px; transition: width .6s cubic-bezier(.4,0,.2,1); }
      `}</style>
    </div>
  )
}
