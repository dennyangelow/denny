'use client'
// app/admin/components/DashboardTab.tsx

import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type { Order, Lead, AffiliateAnalytics } from '@/lib/supabase'
import type { AdminStats } from '@/hooks/useAdminData'
import { STATUS_LABELS, PAYMENT_LABELS } from '@/lib/constants'

interface Props {
  stats: AdminStats
  orders: Order[]
  leads: Lead[]
  analytics: AffiliateAnalytics | null
  onRefresh: () => void
  onViewOrder: (o: Order) => void
}

function buildRevenueChart(orders: Order[]) {
  const map: Record<string, number> = {}
  orders
    .filter(o => o.status !== 'cancelled')
    .forEach(o => {
      const day = o.created_at.slice(0, 10)
      map[day] = (map[day] || 0) + o.total
    })
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, total]) => ({
      date: date.slice(5), // MM-DD
      total: Math.round(total * 100) / 100,
    }))
}

const STAT_CONFIG = (stats: AdminStats, analytics: AffiliateAnalytics | null) => [
  {
    label: 'Общо приход',
    value: `${stats.revenue.toFixed(2)} лв.`,
    sub: `Днес: ${stats.todayRevenue.toFixed(2)} лв.`,
    accent: '#4ade80',
    icon: '₣',
  },
  {
    label: 'Поръчки',
    value: stats.totalOrders,
    sub: `${stats.newOrders} нови`,
    accent: '#60a5fa',
    icon: '◫',
  },
  {
    label: 'Email абонати',
    value: stats.leads,
    sub: 'от наръчника',
    accent: '#c084fc',
    icon: '◉',
  },
  {
    label: 'Афилиейт кликове',
    value: analytics?.total || 0,
    sub: `${analytics?.last30days || 0} за 30 дни`,
    accent: '#fb923c',
    icon: '▲',
  },
  {
    label: 'Чакат плащане',
    value: stats.pendingPayments,
    sub: 'наложен платеж',
    accent: '#f472b6',
    icon: '◎',
  },
]

export function DashboardTab({ stats, orders, leads, analytics, onRefresh, onViewOrder }: Props) {
  const chartData = buildRevenueChart(orders)
  const recentOrders = [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6)
  const statConfig = STAT_CONFIG(stats, analytics)

  return (
    <div className="dash-root">
      {/* Header */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Дашборд</h1>
          <p className="dash-sub">Преглед на бизнеса</p>
        </div>
        <button className="btn-refresh" onClick={onRefresh}>
          ↻ Обнови
        </button>
      </div>

      {/* Stats grid */}
      <div className="stats-grid">
        {statConfig.map((s, i) => (
          <div key={i} className="stat-card" style={{ '--accent': s.accent } as React.CSSProperties}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-body">
              <span className="stat-label">{s.label}</span>
              <span className="stat-value">{s.value}</span>
              <span className="stat-sub">{s.sub}</span>
            </div>
            <div className="stat-glow" />
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="section-card">
        <div className="card-hd">
          <h2>Приход — последните 30 дни</h2>
          <span className="card-badge">{chartData.length} дни с данни</span>
        </div>
        {chartData.length > 0 ? (
          <div style={{ height: 220, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2d6a4f" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2d6a4f" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                  tickFormatter={v => `${v} лв.`} width={70} />
                <Tooltip
                  formatter={(v: number) => [`${v.toFixed(2)} лв.`, 'Приход']}
                  contentStyle={{
                    background: '#fff', border: '1px solid #e5e7eb',
                    borderRadius: 8, fontSize: 13,
                  }}
                />
                <Area type="monotone" dataKey="total" stroke="#2d6a4f" strokeWidth={2}
                  fill="url(#rev-grad)" dot={false} activeDot={{ r: 4, fill: '#2d6a4f' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="empty-chart">Няма данни за графиката</div>
        )}
      </div>

      <div className="dash-bottom-grid">
        {/* Recent orders */}
        <div className="section-card">
          <div className="card-hd">
            <h2>Последни поръчки</h2>
          </div>
          <div className="recent-orders">
            {recentOrders.length === 0 && (
              <p className="empty-msg">Няма поръчки</p>
            )}
            {recentOrders.map(o => {
              const s = STATUS_LABELS[o.status]
              return (
                <div key={o.id} className="recent-row" onClick={() => onViewOrder(o)}>
                  <div>
                    <span className="recent-num">{o.order_number}</span>
                    <span className="recent-name">{o.customer_name}</span>
                  </div>
                  <div className="recent-right">
                    <span className="status-pill" style={{ background: s.bg, color: s.color }}>
                      {s.label}
                    </span>
                    <span className="recent-total">{o.total.toFixed(2)} лв.</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Status breakdown */}
        <div className="section-card">
          <div className="card-hd"><h2>Статуси</h2></div>
          <div className="status-breakdown">
            {Object.entries(STATUS_LABELS).map(([key, s]) => {
              const count = orders.filter(o => o.status === key).length
              const pct = orders.length ? Math.round(count / orders.length * 100) : 0
              return (
                <div key={key} className="status-row">
                  <div className="status-row-left">
                    <span className="status-dot" style={{ background: s.color }} />
                    <span className="status-name">{s.label}</span>
                  </div>
                  <div className="status-row-right">
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${pct}%`, background: s.color }} />
                    </div>
                    <span className="status-count">{count}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <style>{`
        .dash-root { padding: 28px 32px; }
        .dash-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
        .dash-title { font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: -.02em; }
        .dash-sub { font-size: 13px; color: var(--muted); margin-top: 2px; }
        .btn-refresh {
          background: #fff; border: 1px solid var(--border); border-radius: 8px;
          padding: 7px 14px; cursor: pointer; font-size: 13px; color: var(--muted);
          font-family: inherit; transition: all .2s;
        }
        .btn-refresh:hover { border-color: var(--green); color: var(--green); }

        .stats-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 14px; margin-bottom: 22px;
        }
        .stat-card {
          background: #fff; border: 1px solid var(--border); border-radius: 12px;
          padding: 18px 16px; display: flex; align-items: center; gap: 12px;
          position: relative; overflow: hidden; transition: box-shadow .2s;
        }
        .stat-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,.07); }
        .stat-card::after {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: var(--accent);
        }
        .stat-icon {
          width: 40px; height: 40px; border-radius: 10px;
          background: color-mix(in srgb, var(--accent) 12%, transparent);
          color: var(--accent); display: flex; align-items: center; justify-content: center;
          font-size: 18px; flex-shrink: 0;
        }
        .stat-body { display: flex; flex-direction: column; min-width: 0; }
        .stat-label { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .stat-value { font-size: 22px; font-weight: 700; color: var(--text); line-height: 1.2; }
        .stat-sub { font-size: 11px; color: var(--muted); }
        .stat-glow { display: none; }

        .section-card {
          background: #fff; border: 1px solid var(--border); border-radius: 12px;
          padding: 20px; margin-bottom: 18px;
        }
        .card-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .card-hd h2 { font-size: 15px; font-weight: 600; color: var(--text); }
        .card-badge { background: #f3f4f6; color: var(--muted); padding: 3px 9px; border-radius: 99px; font-size: 12px; }
        .empty-chart { text-align: center; color: var(--muted); padding: 48px 0; font-size: 14px; }

        .dash-bottom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        @media (max-width: 900px) { .dash-bottom-grid { grid-template-columns: 1fr; } }

        .recent-orders { display: flex; flex-direction: column; gap: 2px; }
        .recent-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 9px 10px; border-radius: 8px; cursor: pointer; transition: background .15s;
        }
        .recent-row:hover { background: #f8fafc; }
        .recent-num { font-family: monospace; font-size: 12px; color: var(--muted); margin-right: 8px; }
        .recent-name { font-size: 13px; color: var(--text); }
        .recent-right { display: flex; align-items: center; gap: 10px; }
        .recent-total { font-size: 13px; font-weight: 600; color: var(--text); }
        .status-pill { padding: 3px 9px; border-radius: 99px; font-size: 11px; font-weight: 600; white-space: nowrap; }
        .empty-msg { text-align: center; color: var(--muted); padding: 24px; font-size: 14px; }

        .status-breakdown { display: flex; flex-direction: column; gap: 10px; }
        .status-row { display: flex; align-items: center; gap: 12px; }
        .status-row-left { display: flex; align-items: center; gap: 8px; width: 110px; flex-shrink: 0; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .status-name { font-size: 13px; color: var(--text); }
        .status-row-right { display: flex; align-items: center; gap: 10px; flex: 1; }
        .bar-track { flex: 1; height: 5px; background: #f3f4f6; border-radius: 99px; overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 99px; transition: width .5s; }
        .status-count { font-size: 13px; font-weight: 600; color: var(--text); min-width: 24px; text-align: right; }
      `}</style>
    </div>
  )
}
