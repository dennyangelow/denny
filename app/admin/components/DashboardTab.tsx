'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  ResponsiveContainer, CartesianGrid, BarChart, Bar, XAxis, YAxis, Tooltip,
  ComposedChart, Area, Line, Cell
} from 'recharts'
import type { Order, Lead, AffiliateAnalytics } from '@/lib/supabase'
import type { AdminStats, PageViewStats } from '@/hooks/useAdminData'
import { STATUS_LABELS } from '@/lib/constants'

interface Props {
  stats: AdminStats
  orders: Order[]
  leads: Lead[]
  analytics: AffiliateAnalytics | null
  pageViews: PageViewStats | null
  onRefresh: () => void
  onViewOrder: (o: Order) => void
}

// --- Помощни функции извън компонента за по-добра производителност ---

const formatPrice = (v: number) => new Intl.NumberFormat('bg-BG', { style: 'currency', currency: 'BGN' }).format(v)

function processChartData(orders: Order[], pvData: PageViewStats | null) {
  const currentYear = new Date().getFullYear()
  const statsMap: Record<string, { revenue: number, orders: number, views: number }> = {}

  // Подготвяме последните 30 дни
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    statsMap[d.toISOString().slice(0, 10)] = { revenue: 0, orders: 0, views: 0 }
  }

  // Пълним поръчки
  orders.filter(o => o.status !== 'cancelled').forEach(o => {
    const d = o.created_at.slice(0, 10)
    if (statsMap[d]) {
      statsMap[d].revenue += Number(o.total)
      statsMap[d].orders += 1
    }
  })

  // Пълним посещения
  pvData?.dailyChart?.forEach(item => {
    const fullKey = `${currentYear}-${item.date}`
    if (statsMap[fullKey]) statsMap[fullKey].views = item.count
  })

  return Object.entries(statsMap).map(([date, val]) => ({
    fullDate: date,
    label: date.split('-').reverse().slice(0, 2).join('/'),
    ...val
  }))
}

export function DashboardTab({ stats, orders, leads, analytics, pageViews, onRefresh, onViewOrder }: Props) {
  const [now, setNow] = useState(new Date())
  
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const chartData = useMemo(() => processChartData(orders, pageViews), [orders, pageViews])
  
  const topCities = useMemo(() => {
    const m: Record<string, { count: number, revenue: number }> = {}
    orders.forEach(o => {
      const c = o.customer_city?.trim() || 'Други'
      if (!m[c]) m[c] = { count: 0, revenue: 0 }
      m[c].count++
      m[c].revenue += Number(o.total)
    })
    return Object.entries(m).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 6)
  }, [orders])

  const topProducts = useMemo(() => {
    const m: Record<string, { qty: number, revenue: number }> = {}
    orders.forEach(o => {
      (o.order_items || []).forEach((item: any) => {
        if (!m[item.product_name]) m[item.product_name] = { qty: 0, revenue: 0 }
        m[item.product_name].qty += item.quantity
        m[item.product_name].revenue += Number(item.total_price)
      })
    })
    return Object.entries(m).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5)
  }, [orders])

  const recentOrders = useMemo(() => 
    [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10)
  , [orders])

  const greeting = now.getHours() < 12 ? 'Добро утро' : now.getHours() < 18 ? 'Добър ден' : 'Добър вечер'

  return (
    <div className="db-container">
      {/* 1. Header Section */}
      <header className="db-header">
        <div className="user-welcome">
          <span className="greeting-tag">{greeting}, Дени 👋</span>
          <h1 className="main-title">Обзор на бизнеса</h1>
          <p className="live-clock">{now.toLocaleDateString('bg-BG', { weekday: 'long', day: 'numeric', month: 'long' })} • {now.toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="header-controls">
          <div className="status-badge live">
            <span className="pulse-dot"></span>
            Данни в реално време
          </div>
          <button className="refresh-btn" onClick={onRefresh}>
            <span className="icon">↻</span> Обнови
          </button>
        </div>
      </header>

      {/* 2. KPI Grid */}
      <section className="kpi-grid">
        <div className="kpi-card highlight">
          <div className="kpi-icon">💰</div>
          <div className="kpi-content">
            <label>Общ Приход</label>
            <div className="value">{formatPrice(stats.revenue)}</div>
            <div className="trend positive">↑ {formatPrice(stats.weekRevenue)} тази седмица</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">🎯</div>
          <div className="kpi-content">
            <label>Конверсия</label>
            <div className="value">{stats.conversionRate.toFixed(2)}%</div>
            <p className="sub-text">посетители към клиенти</p>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">📦</div>
          <div className="kpi-content">
            <label>Нови Поръчки</label>
            <div className="value">{stats.newOrders}</div>
            <p className="sub-text">чакат обработка</p>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">👥</div>
          <div className="kpi-content">
            <label>Абонати</label>
            <div className="value">{stats.leads}</div>
            <p className="sub-text">Email маркетинг листа</p>
          </div>
        </div>
      </section>

      {/* 3. Main Chart */}
      <section className="chart-section full-width">
        <div className="section-header">
          <h2>Приходи и Трафик</h2>
          <div className="chart-legend">
            <span className="legend-item"><i className="dot revenue"></i> Приход (лв.)</span>
            <span className="legend-item"><i className="dot views"></i> Посещения</span>
          </div>
        </div>
        <div className="main-chart-wrapper">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(v) => `${v}лв`} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
              <Tooltip 
                cursor={{stroke: '#f1f5f9', strokeWidth: 2}}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '14px' }}
              />
              <Area yAxisId="left" type="monotone" dataKey="revenue" fill="url(#colorRev)" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
              <Line yAxisId="right" type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 4. Distribution Grid */}
      <div className="distribution-grid">
        <section className="dist-card">
          <h3>Топ локации (Приход)</h3>
          <div className="rank-list">
            {topCities.map(([city, data], i) => (
              <div key={city} className="rank-item">
                <span className="rank-index">{i + 1}</span>
                <div className="rank-info">
                  <span className="rank-name">{city}</span>
                  <div className="progress-bar"><div className="fill" style={{ width: `${(data.revenue / Number(topCities[0][1].revenue)) * 100}%` }}></div></div>
                </div>
                <span className="rank-value">{formatPrice(data.revenue)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="dist-card">
          <h3>Бестселъри</h3>
          <div className="rank-list">
            {topProducts.map(([name, data], i) => (
              <div key={name} className="rank-item">
                <div className="prod-badge">{data.qty}</div>
                <div className="rank-info">
                  <span className="rank-name truncated">{name}</span>
                  <span className="rank-subtext">{formatPrice(data.revenue)} приход</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 5. Status Overview */}
      <section className="status-grid full-width">
        {Object.entries(STATUS_LABELS).map(([key, s]) => {
          const count = orders.filter(o => o.status === key).length
          return (
            <div key={key} className="status-stat-card" style={{ '--accent': s.color } as any}>
              <label>{s.label}</label>
              <div className="count">{count}</div>
            </div>
          )
        })}
      </section>

      {/* 6. Recent Orders Table */}
      <section className="table-section full-width">
        <div className="section-header">
          <h2>Последни транзакции</h2>
          <button className="view-all-link">Виж всички</button>
        </div>
        <div className="table-overflow">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Клиент</th>
                <th>Метод</th>
                <th>Статус</th>
                <th className="text-right">Сума</th>
                <th className="text-right">Дата</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map(o => {
                const s = STATUS_LABELS[o.status]
                return (
                  <tr key={o.id} onClick={() => onViewOrder(o)} className="clickable-row">
                    <td className="order-num">#{o.order_number}</td>
                    <td className="cust-name">
                      {o.customer_name}
                      <span className="cust-city">{o.customer_city}</span>
                    </td>
                    <td>{o.payment_method === 'cod' ? 'Наложен' : 'Карта'}</td>
                    <td>
                      <span className="status-tag" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td className="text-right bold">{formatPrice(Number(o.total))}</td>
                    <td className="text-right date">{new Date(o.created_at).toLocaleDateString('bg-BG')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <style>{`
        .db-container { padding: 32px; max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; font-family: 'Inter', system-ui, sans-serif; }
        
        /* Header */
        .db-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px; }
        .greeting-tag { font-size: 14px; font-weight: 600; color: #10b981; background: #ecfdf5; padding: 4px 12px; border-radius: 99px; }
        .main-title { font-size: 32px; font-weight: 850; color: #0f172a; margin: 8px 0 4px; letter-spacing: -0.03em; }
        .live-clock { color: #64748b; font-size: 14px; }
        
        .header-controls { display: flex; gap: 12px; align-items: center; }
        .status-badge.live { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #10b981; background: white; padding: 8px 16px; border-radius: 12px; border: 1px solid #e2e8f0; }
        .pulse-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
        
        .refresh-btn { background: #0f172a; color: white; border: none; padding: 10px 20px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .refresh-btn:hover { background: #334155; transform: translateY(-1px); }

        /* KPI Cards */
        .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }
        .kpi-card { background: white; padding: 24px; border-radius: 20px; border: 1px solid #f1f5f9; display: flex; gap: 16px; transition: 0.3s; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
        .kpi-card:hover { border-color: #10b981; transform: translateY(-4px); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05); }
        .kpi-card.highlight { background: #0f172a; color: white; border: none; }
        .kpi-card.highlight label { color: #94a3b8; }
        .kpi-card.highlight .sub-text { color: #94a3b8; }
        .kpi-icon { font-size: 24px; background: #f8fafc; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 14px; }
        .kpi-card.highlight .kpi-icon { background: rgba(255,255,255,0.1); }
        .kpi-content label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
        .kpi-content .value { font-size: 24px; font-weight: 800; margin: 4px 0; }
        .trend.positive { color: #10b981; font-size: 12px; font-weight: 600; }
        .sub-text { font-size: 12px; color: #94a3b8; }

        /* Charts & Distribution */
        .full-width { grid-column: 1 / -1; }
        .chart-section { background: white; padding: 28px; border-radius: 24px; border: 1px solid #f1f5f9; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .section-header h2 { font-size: 18px; font-weight: 800; color: #1e293b; }
        .chart-legend { display: flex; gap: 16px; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #64748b; }
        .dot { width: 8px; height: 8px; border-radius: 50%; }
        .dot.revenue { background: #10b981; }
        .dot.views { background: #3b82f6; }

        .distribution-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 1024px) { .distribution-grid { grid-template-columns: 1fr; } }
        .dist-card { background: white; padding: 24px; border-radius: 24px; border: 1px solid #f1f5f9; }
        .rank-list { display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }
        .rank-item { display: flex; align-items: center; gap: 12px; }
        .rank-index { width: 24px; font-size: 12px; font-weight: 800; color: #cbd5e1; }
        .rank-info { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .rank-name { font-size: 14px; font-weight: 600; color: #1e293b; }
        .rank-name.truncated { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .progress-bar { height: 6px; background: #f1f5f9; border-radius: 99px; overflow: hidden; }
        .progress-bar .fill { height: 100%; background: #10b981; border-radius: 99px; }
        .rank-value { font-size: 14px; font-weight: 700; color: #1e293b; }
        .prod-badge { width: 32px; height: 32px; background: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: #475569; }

        /* Status & Table */
        .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
        .status-stat-card { background: white; padding: 16px; border-radius: 16px; border: 1px solid #f1f5f9; border-top: 4px solid var(--accent); }
        .status-stat-card label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
        .status-stat-card .count { font-size: 24px; font-weight: 800; color: #1e293b; margin-top: 4px; }

        .table-section { background: white; padding: 24px; border-radius: 24px; border: 1px solid #f1f5f9; }
        .modern-table { width: 100%; border-collapse: collapse; }
        .modern-table th { text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9; }
        .modern-table td { padding: 16px; border-bottom: 1px solid #f8fafc; font-size: 14px; }
        .clickable-row { cursor: pointer; transition: 0.2s; }
        .clickable-row:hover { background: #f8fafc; }
        .order-num { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #64748b; }
        .cust-name { font-weight: 600; color: #1e293b; display: flex; flex-direction: column; }
        .cust-city { font-size: 12px; font-weight: 400; color: #94a3b8; }
        .status-tag { padding: 4px 12px; border-radius: 99px; font-size: 11px; font-weight: 700; }
        .text-right { text-align: right; }
        .bold { font-weight: 700; color: #10b981; }
        .date { color: #94a3b8; font-size: 13px; }
      `}</style>
    </div>
  )
}