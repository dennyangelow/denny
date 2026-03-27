'use client'
// app/admin/components/AnalyticsTab.tsx — v4 разширена

import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts'
import type { AffiliateAnalytics } from '@/lib/supabase'
import type { PageViewStats } from '@/hooks/useAdminData'
import type { Order } from '@/lib/supabase'
import { STATUS_LABELS, formatPrice } from '@/lib/constants'

const COLORS = ['#16a34a','#0ea5e9','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#10b981']

interface Props {
  analytics: AffiliateAnalytics | null
  pageViews: PageViewStats | null
  orders:    Order[]
}

export function AnalyticsTab({ analytics, pageViews, orders }: Props) {
  // Revenue by day (last 30)
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

  // Status pie
  const statusPie = useMemo(() => {
    const map: Record<string, number> = {}
    orders.forEach(o => { map[o.status] = (map[o.status] || 0) + 1 })
    return Object.entries(map).map(([key, value]) => ({
      name: STATUS_LABELS[key]?.label || key, value,
      color: STATUS_LABELS[key]?.color || '#9ca3af',
    }))
  }, [orders])

  // Payment pie
  const paymentPie = useMemo(() => {
    const map: Record<string, number> = {}
    orders.filter(o => o.status !== 'cancelled').forEach(o => {
      map[o.payment_method] = (map[o.payment_method] || 0) + 1
    })
    const labels: Record<string, string> = { cod: 'Наложен платеж', bank: 'Банков превод', card: 'Карта' }
    return Object.entries(map).map(([key, value]) => ({ name: labels[key] || key, value }))
  }, [orders])

  // Courier breakdown
  const courierData = useMemo(() => {
    const econt  = orders.filter(o => !o.courier || o.courier === 'econt').length
    const speedy = orders.filter(o => o.courier === 'speedy').length
    return [{ name: 'Еконт', value: econt }, { name: 'Спиди', value: speedy }]
  }, [orders])

  // Affiliate clicks bar
  const affBar = useMemo(() => {
    if (!analytics?.byProduct) return []
    return Object.entries(analytics.byProduct)
      .sort(([,a],[,b]) => b - a).slice(0, 8)
      .map(([name, value]) => ({ name, value }))
  }, [analytics])

  // Funnel: visits → leads → orders
  const funnelData = useMemo(() => {
    const visits = pageViews?.last30 || 0
    const leadsCount = orders.length // leads last 30 — approximate
    const ordersCount = orders.filter(o => o.created_at >= new Date(Date.now() - 30*86400000).toISOString()).length
    return [
      { stage: 'Посещения (30д)', value: visits,      pct: 100 },
      { stage: 'Affiliate кликове', value: analytics?.last30days || 0, pct: visits ? Math.round((analytics?.last30days||0)/visits*100) : 0 },
      { stage: 'Поръчки (30д)',   value: ordersCount, pct: visits ? Math.round(ordersCount/visits*100) : 0 },
    ]
  }, [pageViews, analytics, orders])

  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: 'var(--text)' }}>{title}</h3>
      {children}
    </div>
  )

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Аналитика</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>Статистики, графики и конверсии</p>
      </div>

      {/* Funnel */}
      <Card title="🎯 Conversion Funnel — последните 30 дни">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {funnelData.map((f, i) => (
            <div key={f.stage} style={{ flex: 1, minWidth: 140, background: '#f9fafb', borderRadius: 12, padding: '16px', border: '1px solid #e5e7eb', position: 'relative' }}>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{i+1}. {f.stage}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: COLORS[i] }}>{f.value.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{f.pct}% от посещенията</div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, height: 3, width: `${f.pct}%`, maxWidth: '100%', background: COLORS[i], borderRadius: '0 0 0 12px' }} />
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
        {/* Revenue chart */}
        <Card title="💶 Приход — последните 30 дни">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={revenueChart}>
              <defs>
                <linearGradient id="rg2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5"/>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={6}/>
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={v=>`${v}€`} width={44}/>
              <Tooltip formatter={(v:number)=>[formatPrice(v),'Приход']} contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }}/>
              <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} fill="url(#rg2)"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Page views chart */}
        {pageViews?.dailyChart && (
          <Card title="👁️ Посещения — последните 30 дни">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={pageViews.dailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5"/>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={6}/>
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={32}/>
                <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }}/>
                <Bar dataKey="count"  fill="#0ea5e9" name="Общо"    radius={[3,3,0,0]}/>
                <Bar dataKey="unique" fill="#86efac" name="Уникални" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Status pie */}
        <Card title="📊 Поръчки по статус">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={statusPie} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                {statusPie.map((entry, i) => (
                  <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]}/>
                ))}
              </Pie>
              <Tooltip formatter={(v:number, name:string) => [v, name]} contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }}/>
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:12 }}/>
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Payment + courier pie */}
        <Card title="💳 Начин на плащане & куриер">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textAlign: 'center', marginBottom: 6 }}>ПЛАЩАНЕ</div>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={paymentPie} cx="50%" cy="50%" outerRadius={52} paddingAngle={3} dataKey="value">
                    {paymentPie.map((_, i) => <Cell key={i} fill={COLORS[i]}/>)}
                  </Pie>
                  <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:11 }}/>
                  <Legend iconSize={8} wrapperStyle={{ fontSize:11 }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textAlign: 'center', marginBottom: 6 }}>КУРИЕР</div>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={courierData} cx="50%" cy="50%" outerRadius={52} paddingAngle={3} dataKey="value">
                    {courierData.map((_, i) => <Cell key={i} fill={COLORS[i+2]}/>)}
                  </Pie>
                  <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:11 }}/>
                  <Legend iconSize={8} wrapperStyle={{ fontSize:11 }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      {/* Affiliate clicks */}
      {affBar.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <Card title="🔗 Affiliate кликове по продукт">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={affBar} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" horizontal={false}/>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false}/>
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} tickLine={false} axisLine={false} width={80}/>
                <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }}/>
                <Bar dataKey="value" fill="#16a34a" radius={[0,4,4,0]} name="Кликове"/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Top pages + referrers */}
      {pageViews && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
          <Card title="📄 Топ страници">
            {(pageViews.topPages || []).map((p, i) => (
              <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 20, height: 20, background: '#f3f4f6', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#6b7280' }}>{i+1}</span>
                  <span style={{ color: '#374151', fontFamily: 'monospace', fontSize: 12 }}>{p.name}</span>
                </div>
                <span style={{ fontWeight: 700, color: '#111' }}>{p.count}</span>
              </div>
            ))}
          </Card>
          <Card title="🌐 Топ източници">
            {(pageViews.topReferrers || []).map((r, i) => (
              <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 20, height: 20, background: '#f3f4f6', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#6b7280' }}>{i+1}</span>
                  <span style={{ color: '#374151' }}>{r.name}</span>
                </div>
                <span style={{ fontWeight: 700 }}>{r.count}</span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  )
}
