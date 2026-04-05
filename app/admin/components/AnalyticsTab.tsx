'use client'
// app/admin/components/AnalyticsTab.tsx — v7
// Добавена: детайлна таблица по афилиейт продукт + daily chart за affiliate кликове

import { useMemo, useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts'
import type { AffiliateAnalytics } from '@/lib/supabase'
import type { PageViewStats } from '@/hooks/useAdminData'
import type { Order } from '@/lib/supabase'
import { STATUS_LABELS } from '@/lib/constants'
import { useCurrency } from './CurrencyContext'

const COLORS = ['#16a34a','#0ea5e9','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#10b981']

type Range = 7 | 30 | 90

interface Props {
  analytics: AffiliateAnalytics | null
  pageViews: PageViewStats | null
  orders:    Order[]
}

// Детайлни affiliate статистики (от новия GET endpoint)
interface AffiliateDetail {
  total:     number
  last30days: number
  last7days:  number
  today:      number
  byProduct:  Record<string, number>
  byPartner:  Record<string, number>
  productDetails: Record<string, { total: number; last30: number; last7: number; today: number }>
  topProducts: { slug: string; total: number; last30: number; last7: number; today: number }[]
  topPartners: { name: string; count: number }[]
  dailyChart:  { date: string; count: number }[]
}

type OfferType = 'post_purchase' | 'cart_upsell' | 'cross_sell' | null

function getOfferType(o: Order): OfferType {
  const notes = o.customer_notes || ''
  if (notes.includes('[POST-PURCHASE UPSELL]')) return 'post_purchase'
  if (notes.includes('[CART-UPSELL]'))          return 'cart_upsell'
  if (notes.includes('[CROSS-SELL]'))           return 'cross_sell'
  if (notes.includes('[HAS-OFFER]'))            return 'cart_upsell'
  const items = o.order_items || []
  if (items.some((i: any) => (i.product_name || '').toLowerCase().includes('upsell'))) return 'cart_upsell'
  if (items.some((i: any) => (i.product_name || '').toLowerCase().includes('cross')))  return 'cross_sell'
  if (items.some((i: any) => /\(-\d+%\)/.test(i.product_name || '')))                 return 'cross_sell'
  return null
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function MetricCard({ label, value, prev, color, icon }: {
  label: string; value: number | string; prev?: number; color: string; icon: string
}) {
  const numValue = typeof value === 'number' ? value : null
  const trend    = numValue !== null && prev !== undefined && prev > 0
    ? ((numValue - prev) / prev) * 100 : null
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 20px', flex: 1, minWidth: 140 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        {trend !== null && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
            background: trend >= 0 ? '#dcfce7' : '#fee2e2',
            color:      trend >= 0 ? '#15803d' : '#dc2626' }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color, letterSpacing: '-.02em' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

function RangePicker({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  return (
    <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 9, padding: 3, gap: 2 }}>
      {([7, 30, 90] as Range[]).map(r => (
        <button key={r} onClick={() => onChange(r)}
          style={{ padding: '5px 12px', borderRadius: 7, border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all .15s',
            background: range === r ? '#fff' : 'transparent',
            color:      range === r ? '#111' : '#9ca3af',
            boxShadow:  range === r ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>
          {r}д
        </button>
      ))}
    </div>
  )
}

const Card = ({ id, title, children, onExport }: {
  id?: string; title: string; children: React.ReactNode; onExport?: () => void
}) => (
  <div id={id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text)' }}>{title}</h3>
      {onExport && (
        <button onClick={onExport}
          style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: '1px solid #e5e7eb',
            borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit',
            fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          ↓ PNG
        </button>
      )}
    </div>
    {children}
  </div>
)

function OfferStatCard({ icon, label, value, sub, gradient, light }: {
  icon: string; label: string; value: string | number; sub?: string; gradient?: string; light?: boolean
}) {
  if (light) {
    return (
      <div style={{ flex: 1, minWidth: 140, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 13, padding: '14px 16px' }}>
        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, marginBottom: 4 }}>{icon} {label}</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#7c3aed', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>{sub}</div>}
      </div>
    )
  }
  return (
    <div style={{ flex: 1, minWidth: 140, background: gradient, borderRadius: 13, padding: '14px 16px', color: '#fff' }}>
      <div style={{ fontSize: 11, opacity: .75, fontWeight: 700, marginBottom: 4 }}>{icon} {label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, opacity: .7, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ─── Affiliate Details Table ───────────────────────────────────────────────────
function AffiliateDetailsTable({ details }: { details: AffiliateDetail }) {
  const [sortBy, setSortBy] = useState<'last30' | 'last7' | 'today' | 'total'>('last30')

  const sorted = useMemo(() =>
    details.topProducts
      .slice()
      .sort((a, b) => b[sortBy] - a[sortBy])
  , [details.topProducts, sortBy])

  const maxVal = sorted[0]?.[sortBy] || 1

  if (sorted.length === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🔗</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Няма записани affiliate кликове</div>
        <div style={{ fontSize: 12, marginTop: 6, color: '#cbd5e1' }}>
          Кликовете ще се появят тук след интеграцията на AffiliateSection компонента
        </div>
      </div>
    )
  }

  const SortBtn = ({ k, label }: { k: typeof sortBy; label: string }) => (
    <button
      onClick={() => setSortBy(k)}
      style={{
        padding: '4px 10px', borderRadius: 6, border: 'none', fontFamily: 'inherit',
        fontSize: 11, fontWeight: 700, cursor: 'pointer',
        background: sortBy === k ? '#16a34a' : '#f3f4f6',
        color: sortBy === k ? '#fff' : '#6b7280',
        transition: 'all .15s',
      }}
    >
      {label}
    </button>
  )

  return (
    <div>
      {/* Sort controls */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, alignSelf: 'center' }}>Сортирай по:</span>
        <SortBtn k="last30" label="30 дни" />
        <SortBtn k="last7"  label="7 дни" />
        <SortBtn k="today"  label="Днес" />
        <SortBtn k="total"  label="Общо" />
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 800, color: '#9ca3af', letterSpacing: '.06em', textTransform: 'uppercase' }}>Продукт</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 10, fontWeight: 800, color: '#9ca3af', letterSpacing: '.06em', textTransform: 'uppercase' }}>Днес</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 10, fontWeight: 800, color: '#9ca3af', letterSpacing: '.06em', textTransform: 'uppercase' }}>7 дни</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 10, fontWeight: 800, color: '#9ca3af', letterSpacing: '.06em', textTransform: 'uppercase' }}>30 дни</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 10, fontWeight: 800, color: '#9ca3af', letterSpacing: '.06em', textTransform: 'uppercase' }}>Общо</th>
              <th style={{ padding: '8px 10px', minWidth: 100 }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.slug} style={{
                borderBottom: '1px solid #f9fafb',
                background: i % 2 === 0 ? '#fff' : '#fafafa',
              }}>
                <td style={{ padding: '10px 10px', fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: i < 3 ? ['#fef9c3','#f0fdf4','#eff6ff'][i] : '#f9fafb',
                    color: i < 3 ? ['#b45309','#15803d','#1d4ed8'][i] : '#9ca3af',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 900, flexShrink: 0,
                  }}>
                    {i + 1}
                  </span>
                  <code style={{ fontSize: 12, color: '#374151', background: '#f3f4f6', padding: '2px 7px', borderRadius: 5 }}>
                    {p.slug}
                  </code>
                </td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: p.today > 0 ? 800 : 400, color: p.today > 0 ? '#16a34a' : '#9ca3af' }}>
                  {p.today > 0 ? p.today : '—'}
                </td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>{p.last7}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800, color: '#111' }}>{p.last30}</td>
                <td style={{ padding: '10px', textAlign: 'right', color: '#6b7280' }}>{p.total}</td>
                <td style={{ padding: '10px' }}>
                  <div style={{ height: 6, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden', minWidth: 80 }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.round((p[sortBy] / maxVal) * 100)}%`,
                      background: 'linear-gradient(90deg,#16a34a,#4ade80)',
                      borderRadius: 99,
                      transition: 'width .4s ease',
                    }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Partners summary */}
      {details.topPartners.length > 0 && (
        <div style={{ marginTop: 16, padding: '12px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>По партньор</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {details.topPartners.map(p => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '5px 11px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{p.name}</span>
                <span style={{ fontSize: 12, fontWeight: 900, color: '#16a34a' }}>{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export function AnalyticsTab({ analytics, pageViews, orders }: Props) {
  const { fmt: formatPrice } = useCurrency()
  const [range, setRange] = useState<Range>(30)
  // Детайлни affiliate данни — зарежда се отделно
  const [affDetails, setAffDetails] = useState<AffiliateDetail | null>(null)
  const [affLoading, setAffLoading] = useState(true)

  // Зареждаме детайлните affiliate данни
  useEffect(() => {
    setAffLoading(true)
    fetch('/api/analytics/affiliate-click')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setAffDetails(data)
      })
      .catch(() => {})
      .finally(() => setAffLoading(false))
  }, [])

  const cutoff = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - range)
    return d.toISOString().slice(0, 10)
  }, [range])

  const prevCutoff = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - range * 2)
    return d.toISOString().slice(0, 10)
  }, [range])

  const filteredOrders = useMemo(() =>
    orders.filter(o => o.created_at.slice(0, 10) >= cutoff), [orders, cutoff])

  const prevOrders = useMemo(() =>
    orders.filter(o => o.created_at.slice(0, 10) >= prevCutoff && o.created_at.slice(0, 10) < cutoff),
    [orders, cutoff, prevCutoff])

  const metrics = useMemo(() => {
    const rev     = filteredOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total), 0)
    const prevRev = prevOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total), 0)
    const cnt     = filteredOrders.length
    const prevCnt = prevOrders.length
    const avg     = cnt ? rev / cnt : 0
    const prevAvg = prevCnt ? prevRev / prevCnt : 0
    return { rev, prevRev, cnt, prevCnt, avg, prevAvg }
  }, [filteredOrders, prevOrders])

  const revenueChart = useMemo(() => {
    const map: Record<string, number> = {}
    filteredOrders.filter(o => o.status !== 'cancelled').forEach(o => {
      const d = o.created_at.slice(0, 10)
      map[d] = (map[d] || 0) + Number(o.total)
    })
    const now = new Date()
    return Array.from({ length: range }, (_, i) => {
      const d = new Date(now.getTime() - (range - 1 - i) * 86400000).toISOString().slice(0, 10)
      return { date: d.slice(5), revenue: map[d] || 0 }
    })
  }, [filteredOrders, range])

  const statusPie = useMemo(() => {
    const map: Record<string, number> = {}
    filteredOrders.forEach(o => { map[o.status] = (map[o.status] || 0) + 1 })
    return Object.entries(map).map(([key, value]) => ({
      name: STATUS_LABELS[key]?.label || key, value, color: STATUS_LABELS[key]?.color || '#9ca3af',
    }))
  }, [filteredOrders])

  const paymentPie = useMemo(() => {
    const map: Record<string, number> = {}
    filteredOrders.filter(o => o.status !== 'cancelled').forEach(o => {
      map[o.payment_method] = (map[o.payment_method] || 0) + 1
    })
    const labels: Record<string, string> = { cod: 'Наложен платеж', bank: 'Банков превод', card: 'Карта' }
    return Object.entries(map).map(([key, value]) => ({ name: labels[key] || key, value }))
  }, [filteredOrders])

  const courierData = useMemo(() => {
    const econt  = filteredOrders.filter(o => !o.courier || o.courier === 'econt').length
    const speedy = filteredOrders.filter(o => o.courier === 'speedy').length
    return [{ name: 'Еконт', value: econt }, { name: 'Спиди', value: speedy }]
  }, [filteredOrders])

  // affBar — взима от детайлните данни (последните 30 дни)
  const affBar = useMemo(() => {
    if (!affDetails?.productDetails) {
      // Fallback към стария analytics prop
      if (!analytics?.byProduct) return []
      return Object.entries(analytics.byProduct)
        .sort(([, a], [, b]) => b - a).slice(0, 10)
        .map(([name, value]) => ({ name, value }))
    }
    return Object.entries(affDetails.productDetails)
      .sort(([, a], [, b]) => b.last30 - a.last30).slice(0, 10)
      .map(([name, v]) => ({ name, value: v.last30 }))
  }, [affDetails, analytics])

  const funnelData = useMemo(() => {
    const visits = pageViews?.last30 || 0
    const affClicks = affDetails?.last30days ?? analytics?.last30days ?? 0
    const ordersCount = filteredOrders.length
    return [
      { stage: 'Посещения',    value: visits,      pct: 100 },
      { stage: 'Aff. кликове', value: affClicks,   pct: visits ? Math.round(affClicks / visits * 100) : 0 },
      { stage: 'Поръчки',      value: ordersCount, pct: visits ? Math.round(ordersCount / visits * 100) : 0 },
    ]
  }, [pageViews, affDetails, analytics, filteredOrders])

  const offerStats = useMemo(() => {
    const active     = orders.filter(o => o.status !== 'cancelled')
    const postPurch  = active.filter(o => getOfferType(o) === 'post_purchase')
    const upsell     = active.filter(o => getOfferType(o) === 'cart_upsell')
    const crossSell  = active.filter(o => getOfferType(o) === 'cross_sell')
    const withOffer  = active.filter(o => getOfferType(o) !== null)
    const offerRev   = withOffer.reduce((s, o) => s + Number(o.total), 0)
    const totalRev   = active.reduce((s, o) => s + Number(o.total), 0)
    const offerRate  = active.length ? Math.round(withOffer.length / active.length * 100) : 0
    const revShare   = totalRev ? Math.round(offerRev / totalRev * 100) : 0
    const now = new Date()
    const dailyMap: Record<string, { offer: number; normal: number }> = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10)
      dailyMap[d] = { offer: 0, normal: 0 }
    }
    active.forEach(o => {
      const d = o.created_at.slice(0, 10)
      if (!dailyMap[d]) return
      if (getOfferType(o) !== null) dailyMap[d].offer++
      else dailyMap[d].normal++
    })
    const dailyChart = Object.entries(dailyMap).map(([date, v]) => ({ date: date.slice(5), ...v }))
    const typePie = [
      { name: '⚡ Post-purchase', value: postPurch.length, color: '#dc2626' },
      { name: '⬆️ Ъпсел',        value: upsell.length,    color: '#7c3aed' },
      { name: '🔀 Крос-сел',      value: crossSell.length, color: '#1d4ed8' },
    ].filter(x => x.value > 0)
    return {
      withOffer, postPurch, upsell, crossSell, offerRev, totalRev, offerRate, revShare,
      dailyChart, typePie, noOfferCount: active.length - withOffer.length, noOfferRev: totalRev - offerRev,
    }
  }, [orders])

  // Affiliate числа за metric cards
  const affTotal30 = affDetails?.last30days ?? analytics?.last30days ?? 0
  const affToday   = affDetails?.today ?? 0
  const affTotal   = affDetails?.total ?? analytics?.total ?? 0

  return (
    <div style={{ padding: '24px 28px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Аналитика</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>Статистики, графики и конверсии</p>
        </div>
        <RangePicker range={range} onChange={r => setRange(r)} />
      </div>

      {/* Summary metrics */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <MetricCard label={`Приход (${range}д)`}  value={formatPrice(metrics.rev)} prev={metrics.prevRev} color="#16a34a" icon="💶" />
        <MetricCard label={`Поръчки (${range}д)`} value={metrics.cnt}              prev={metrics.prevCnt} color="#f59e0b" icon="📦" />
        <MetricCard label="Ср. стойност"           value={formatPrice(metrics.avg)} prev={metrics.prevAvg} color="#8b5cf6" icon="📊" />
        <MetricCard label="Aff. кликове (30д)"    value={affTotal30} color="#06b6d4" icon="🔗" />
        <MetricCard label="Aff. кликове (днес)"   value={affToday}   color="#10b981" icon="🔗" />
        <MetricCard label="Aff. общо (90д)"       value={affTotal}   color="#6366f1" icon="📊" />
      </div>

      {/* ── AFFILIATE SECTION ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          <span style={{
            fontSize: 11, fontWeight: 800, color: '#06b6d4',
            letterSpacing: '.08em', textTransform: 'uppercase',
            background: '#ecfeff', border: '1px solid #a5f3fc',
            padding: '4px 14px', borderRadius: 99,
          }}>
            🔗 Affiliate Аналитика
          </span>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: affDetails?.dailyChart?.length ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 16 }}>

          {/* Детайлна таблица по продукт */}
          <Card title="🔗 Affiliate кликове по продукт — детайлно">
            {affLoading ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                ⏳ Зарежда...
              </div>
            ) : affDetails ? (
              <AffiliateDetailsTable details={affDetails} />
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                Няма данни
              </div>
            )}
          </Card>

          {/* Daily chart */}
          {affDetails?.dailyChart && affDetails.dailyChart.some(d => d.count > 0) && (
            <Card title="📈 Affiliate кликове — последните 30 дни">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={affDetails.dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={6} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [v, 'Кликове']}
                  />
                  <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Кликове" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>

        {/* Bar chart по продукт (хоризонтален) */}
        {affBar.length > 0 && (
          <Card title="📊 Топ продукти по клик (30 дни)">
            <ResponsiveContainer width="100%" height={Math.max(180, affBar.length * 36)}>
              <BarChart data={affBar} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} tickLine={false} axisLine={false} width={120} />
                <Tooltip contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [v, 'Кликове']} />
                <Bar dataKey="value" radius={[0, 5, 5, 0]} name="Кликове">
                  {affBar.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* ── OFFER ANALYTICS ──────────────────────────────────────────── */}
      {offerStats.withOffer.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#7c3aed', letterSpacing: '.08em', textTransform: 'uppercase', background: '#f5f3ff', border: '1px solid #ede9fe', padding: '4px 14px', borderRadius: 99 }}>
              📣 Offer Аналитика
            </span>
            <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <OfferStatCard icon="📣" label="ОФЕРТИ — ОБЩО" gradient="linear-gradient(135deg,#7c3aed,#6d28d9)" value={offerStats.withOffer.length} sub="поръчки с оферта" />
            <OfferStatCard icon="⚡" label="POST-PURCHASE"  gradient="linear-gradient(135deg,#dc2626,#b91c1c)" value={offerStats.postPurch.length}  sub="след поръчка" />
            <OfferStatCard icon="⬆️" label="ЪПСЕЛ"          gradient="linear-gradient(135deg,#7c3aed,#5b21b6)" value={offerStats.upsell.length}     sub="upgrade в количката" />
            <OfferStatCard icon="🔀" label="КРОС-СЕЛ"       gradient="linear-gradient(135deg,#0369a1,#1d4ed8)" value={offerStats.crossSell.length}  sub="допълващ продукт" />
            <OfferStatCard icon="💶" label="ПРИХОД ОТ ОФЕРТИ" gradient="linear-gradient(135deg,#059669,#047857)" value={formatPrice(offerStats.offerRev)} sub={`${offerStats.revShare}% от общия приход`} />
            <OfferStatCard icon="📊" label="КОНВЕРСИЯ НА ОФЕРТИ" light value={`${offerStats.offerRate}%`} sub="от поръчките" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <Card id="chart-offer-daily" title="📣 С оферта vs нормални (30д)">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={offerStats.dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={6} />
                  <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
                  <Tooltip contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="normal" name="Нормални" stackId="a" fill="#86efac" />
                  <Bar dataKey="offer"  name="С оферта" stackId="a" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            {offerStats.typePie.length > 0 && (
              <Card id="chart-offer-type" title="🔀 Разпределение по тип оферта">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={offerStats.typePie} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                      {offerStats.typePie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>
          <Card title="💶 Приход: с оферта vs без оферта">
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ height: 30, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${offerStats.revShare}%`, background: 'linear-gradient(90deg,#7c3aed,#6d28d9)', borderRadius: offerStats.revShare < 98 ? '99px 0 0 99px' : 99, transition: 'width .6s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {offerStats.revShare > 10 && <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{offerStats.revShare}%</span>}
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280' }}>{100 - offerStats.revShare}%</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
                  <span style={{ color: '#7c3aed', fontWeight: 700 }}>● С оферта: {formatPrice(offerStats.offerRev)}</span>
                  <span style={{ color: '#6b7280' }}>● Без оферта: {formatPrice(offerStats.noOfferRev)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 24, flexShrink: 0 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#7c3aed' }}>
                    {formatPrice(offerStats.withOffer.length ? offerStats.offerRev / offerStats.withOffer.length : 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Ср. AOV с оферта</div>
                </div>
                <div style={{ width: 1, background: '#e5e7eb' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a' }}>
                    {formatPrice(offerStats.noOfferCount > 0 ? offerStats.noOfferRev / offerStats.noOfferCount : 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Ср. AOV без оферта</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Funnel */}
      <div style={{ marginBottom: 20 }}>
        <Card title="🎯 Conversion Funnel">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {funnelData.map((f, i) => (
              <div key={f.stage} style={{ flex: 1, minWidth: 130, background: '#f9fafb', borderRadius: 12, padding: '16px', border: '1px solid #e5e7eb', position: 'relative', overflow: 'hidden' }}>
                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{i + 1}. {f.stage}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: COLORS[i] }}>{f.value.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{f.pct}% от посещенията</div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, height: 3, width: `${f.pct}%`, maxWidth: '100%', background: COLORS[i], borderRadius: '0 0 0 12px', transition: 'width .6s ease' }} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Revenue + Page views */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card id="chart-revenue" title={`💶 Приход — последните ${range} дни`}>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={revenueChart}>
              <defs>
                <linearGradient id="rg2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={Math.floor(range / 6)} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} width={44} />
              <Tooltip formatter={(v: number) => [formatPrice(v), 'Приход']} contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} fill="url(#rg2)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {pageViews?.dailyChart && (
          <Card id="chart-views" title="👁️ Посещения — последните 30 дни">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={pageViews.dailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={6} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count"  fill="#0ea5e9" name="Общо"     radius={[3, 3, 0, 0]} />
                <Bar dataKey="unique" fill="#86efac" name="Уникални" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        <Card id="chart-status" title="📊 Поръчки по статус">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={statusPie} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                {statusPie.map((entry, i) => <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="💳 Плащане & куриер">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textAlign: 'center', marginBottom: 6 }}>ПЛАЩАНЕ</div>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={paymentPie} cx="50%" cy="50%" outerRadius={52} paddingAngle={3} dataKey="value">
                    {paymentPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 11 }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textAlign: 'center', marginBottom: 6 }}>КУРИЕР</div>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={courierData} cx="50%" cy="50%" outerRadius={52} paddingAngle={3} dataKey="value">
                    {courierData.map((_, i) => <Cell key={i} fill={COLORS[i + 2]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 11 }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      {/* Top pages + referrers */}
      {pageViews && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card title="📄 Топ страници">
            {(pageViews.topPages || [])
              // Филтрираме /tr/ redirect URL-и от CDN трекери
              .filter(p => !p.name.startsWith('/tr/') && !p.name.includes('/tr/2/'))
              .slice(0, 8)
              .map((p, i) => {
                // Съкращаваме дълги пътища
                const displayName = p.name.length > 45
                  ? p.name.slice(0, 42) + '…'
                  : p.name
                const maxCount = (pageViews.topPages || [])
                  .filter(x => !x.name.startsWith('/tr/'))[0]?.count || 1
                return (
                  <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                      <span style={{ width: 20, height: 20, background: '#f3f4f6', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#6b7280', flexShrink: 0 }}>{i + 1}</span>
                      <span title={p.name} style={{ color: '#374151', fontFamily: 'monospace', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
                      <div style={{ width: 60, height: 4, background: '#f3f4f6', borderRadius: 99 }}>
                        <div style={{ height: '100%', width: `${(p.count / maxCount) * 100}%`, background: '#16a34a', borderRadius: 99 }} />
                      </div>
                      <span style={{ fontWeight: 700, color: '#111', minWidth: 30, textAlign: 'right' }}>{p.count}</span>
                    </div>
                  </div>
                )
              })}
          </Card>
          <Card title="🌐 Топ източници">
            {(pageViews.topReferrers || []).map((r, i) => (
              <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 20, height: 20, background: '#f3f4f6', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#6b7280', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ color: '#374151' }}>{r.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 60, height: 4, background: '#f3f4f6', borderRadius: 99 }}>
                    <div style={{ height: '100%', width: `${(r.count / (pageViews.topReferrers![0]?.count || 1)) * 100}%`, background: '#0ea5e9', borderRadius: 99 }} />
                  </div>
                  <span style={{ fontWeight: 700, minWidth: 30, textAlign: 'right' }}>{r.count}</span>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  )
}
  