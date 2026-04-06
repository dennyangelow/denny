'use client'
// app/admin/components/AnalyticsTab.tsx — v8 redesigned

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

interface AffiliateDetail {
  total:          number
  last30days:     number
  last7days:      number
  today:          number
  byProduct:      Record<string, number>
  byPartner:      Record<string, number>
  productDetails: Record<string, { total: number; last30: number; last7: number; today: number }>
  topProducts:    { slug: string; total: number; last30: number; last7: number; today: number }[]
  topPartners:    { name: string; count: number }[]
  dailyChart:     { date: string; count: number }[]
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

// ─── Sub-components ─────────────────────────────────────────────────────────

function RangePicker({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  return (
    <div style={{ display:'flex', background:'#f3f4f6', borderRadius:9, padding:3, gap:2 }}>
      {([7, 30, 90] as Range[]).map(r => (
        <button key={r} onClick={() => onChange(r)} style={{
          padding:'5px 14px', borderRadius:7, border:'none', fontFamily:'inherit',
          fontSize:12, fontWeight:700, cursor:'pointer', transition:'all .15s',
          background: range === r ? '#fff' : 'transparent',
          color:      range === r ? '#111' : '#9ca3af',
          boxShadow:  range === r ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
        }}>{r}д</button>
      ))}
    </div>
  )
}

function MetricCard({ label, value, prev, color, icon, bg, border }: {
  label: string; value: number | string; prev?: number
  color: string; icon: string; bg?: string; border?: string
}) {
  const numVal = typeof value === 'number' ? value : null
  const trend  = numVal !== null && prev !== undefined && prev > 0
    ? ((numVal - prev) / prev) * 100 : null
  return (
    <div style={{
      background: bg || '#fff', border: `1px solid ${border || '#e5e7eb'}`,
      borderRadius:13, padding:'14px 16px', flex:'1 1 130px', minWidth:0,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <span style={{ fontSize:15 }}>{icon}</span>
        {trend !== null && (
          <span style={{
            fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:99,
            background: trend >= 0 ? '#dcfce7' : '#fee2e2',
            color:      trend >= 0 ? '#15803d' : '#dc2626',
          }}>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%</span>
        )}
      </div>
      <div style={{ fontSize:22, fontWeight:900, color, letterSpacing:'-.02em', lineHeight:1.15 }}>{value}</div>
      <div style={{ fontSize:11, color:'#9ca3af', marginTop:3, fontWeight:500 }}>{label}</div>
    </div>
  )
}

const Card = ({ id, title, children, onExport, noPad }: {
  id?: string; title: string; children: React.ReactNode; onExport?: () => void; noPad?: boolean
}) => (
  <div id={id} style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:14, overflow:'hidden' }}>
    <div style={{ padding:'13px 18px', borderBottom:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <h3 style={{ fontSize:13, fontWeight:700, margin:0, color:'#111' }}>{title}</h3>
      {onExport && (
        <button onClick={onExport} style={{
          fontSize:11, color:'#9ca3af', background:'none', border:'1px solid #e5e7eb',
          borderRadius:6, padding:'3px 8px', cursor:'pointer', fontFamily:'inherit', fontWeight:600,
        }}>↓ PNG</button>
      )}
    </div>
    <div style={noPad ? {} : { padding:'14px 18px' }}>{children}</div>
  </div>
)

function SectionLabel({ label, color, bg, border }: { label:string; color:string; bg:string; border:string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, margin:'24px 0 14px' }}>
      <div style={{ flex:1, height:1, background:'#e5e7eb' }} />
      <span style={{ fontSize:10, fontWeight:800, color, letterSpacing:'.08em', textTransform:'uppercase', background:bg, border:`1px solid ${border}`, padding:'4px 14px', borderRadius:99, whiteSpace:'nowrap' }}>
        {label}
      </span>
      <div style={{ flex:1, height:1, background:'#e5e7eb' }} />
    </div>
  )
}

// ─── Affiliate table ─────────────────────────────────────────────────────────

function AffiliateDetailsTable({ details }: { details: AffiliateDetail }) {
  const [sortBy, setSortBy] = useState<'last30' | 'last7' | 'today' | 'total'>('last30')

  const sorted = useMemo(() =>
    details.topProducts.slice().sort((a, b) => b[sortBy] - a[sortBy])
  , [details.topProducts, sortBy])

  const maxVal = sorted[0]?.[sortBy] || 1

  if (sorted.length === 0) {
    return (
      <div style={{ padding:'32px 0', textAlign:'center', color:'#9ca3af' }}>
        <div style={{ fontSize:32, marginBottom:8 }}>🔗</div>
        <div style={{ fontSize:13, fontWeight:600 }}>Няма записани affiliate кликове</div>
        <div style={{ fontSize:12, marginTop:4, color:'#cbd5e1' }}>Кликовете ще се появят след интеграцията</div>
      </div>
    )
  }

  const SortBtn = ({ k, label }: { k: typeof sortBy; label: string }) => (
    <button onClick={() => setSortBy(k)} style={{
      padding:'3px 10px', borderRadius:6, border:'none', fontFamily:'inherit',
      fontSize:11, fontWeight:700, cursor:'pointer', transition:'all .15s',
      background: sortBy === k ? '#16a34a' : '#f3f4f6',
      color: sortBy === k ? '#fff' : '#6b7280',
    }}>{label}</button>
  )

  return (
    <div>
      <div style={{ display:'flex', gap:5, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:10, color:'#9ca3af', fontWeight:700 }}>СОРТИРАЙ:</span>
        <SortBtn k="today"  label="Днес" />
        <SortBtn k="last7"  label="7д" />
        <SortBtn k="last30" label="30д" />
        <SortBtn k="total"  label="Общо" />
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ borderBottom:'2px solid #f3f4f6' }}>
              {['Продукт','Днес','7д','30д','Общо',''].map((h, i) => (
                <th key={i} style={{ textAlign: i === 0 ? 'left' : i === 5 ? 'left' : 'right', padding:'6px 8px', fontSize:9, fontWeight:800, color:'#9ca3af', letterSpacing:'.06em', textTransform:'uppercase', minWidth: i === 5 ? 70 : undefined }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.slug} className="aff-row" style={{ borderBottom:'1px solid #f9fafb', background: i % 2 === 0 ? '#fff' : '#fafafa', transition:'background .1s' }}>
                <td style={{ padding:'8px', fontWeight:700, color:'#111' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ width:20, height:20, borderRadius:5, flexShrink:0,
                      background: i < 3 ? ['#fef9c3','#f0fdf4','#eff6ff'][i] : '#f9fafb',
                      color: i < 3 ? ['#b45309','#15803d','#1d4ed8'][i] : '#9ca3af',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:900,
                    }}>{i + 1}</span>
                    <code style={{ fontSize:11, color:'#374151', background:'#f3f4f6', padding:'2px 6px', borderRadius:4 }}>{p.slug}</code>
                  </div>
                </td>
                <td style={{ padding:'8px', textAlign:'right', fontWeight: p.today > 0 ? 800 : 400, color: p.today > 0 ? '#16a34a' : '#9ca3af' }}>{p.today > 0 ? p.today : '—'}</td>
                <td style={{ padding:'8px', textAlign:'right', fontWeight:600, color:'#374151' }}>{p.last7}</td>
                <td style={{ padding:'8px', textAlign:'right', fontWeight:800, color:'#111' }}>{p.last30}</td>
                <td style={{ padding:'8px', textAlign:'right', color:'#6b7280' }}>{p.total}</td>
                <td style={{ padding:'8px' }}>
                  <div style={{ height:5, background:'#f3f4f6', borderRadius:99, overflow:'hidden', minWidth:60 }}>
                    <div style={{ height:'100%', width:`${Math.round((p[sortBy]/maxVal)*100)}%`, background:'linear-gradient(90deg,#16a34a,#4ade80)', borderRadius:99, transition:'width .4s ease' }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {details.topPartners.length > 0 && (
        <div style={{ marginTop:12, padding:'10px 12px', background:'#f8fafc', borderRadius:9, border:'1px solid #e5e7eb' }}>
          <div style={{ fontSize:9, fontWeight:800, color:'#9ca3af', letterSpacing:'.06em', textTransform:'uppercase', marginBottom:7 }}>По партньор</div>
          <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
            {details.topPartners.map(p => (
              <div key={p.name} style={{ display:'flex', alignItems:'center', gap:5, background:'#fff', border:'1px solid #e5e7eb', borderRadius:7, padding:'4px 10px' }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:'#16a34a', display:'inline-block' }} />
                <span style={{ fontSize:11, fontWeight:700, color:'#374151' }}>{p.name}</span>
                <span style={{ fontSize:11, fontWeight:900, color:'#16a34a' }}>{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AnalyticsTab({ analytics, pageViews, orders }: Props) {
  const { fmt: formatPrice } = useCurrency()
  const [range, setRange] = useState<Range>(30)
  const [affDetails, setAffDetails]   = useState<AffiliateDetail | null>(null)
  const [affLoading, setAffLoading]   = useState(true)

  useEffect(() => {
    setAffLoading(true)
    fetch('/api/analytics/affiliate-click')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAffDetails(data) })
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
    const labels: Record<string,string> = { cod:'Наложен', bank:'Банков превод', card:'Карта' }
    return Object.entries(map).map(([key, value]) => ({ name: labels[key] || key, value }))
  }, [filteredOrders])

  const courierData = useMemo(() => {
    const econt  = filteredOrders.filter(o => !o.courier || o.courier === 'econt').length
    const speedy = filteredOrders.filter(o => o.courier === 'speedy').length
    return [{ name:'Еконт', value:econt }, { name:'Спиди', value:speedy }]
  }, [filteredOrders])

  const affBar = useMemo(() => {
    if (!affDetails?.productDetails) {
      if (!analytics?.byProduct) return []
      return Object.entries(analytics.byProduct)
        .sort(([,a],[,b]) => b - a).slice(0, 10)
        .map(([name, value]) => ({ name, value }))
    }
    return Object.entries(affDetails.productDetails)
      .sort(([,a],[,b]) => b.last30 - a.last30).slice(0, 10)
      .map(([name, v]) => ({ name, value: v.last30 }))
  }, [affDetails, analytics])

  const funnelData = useMemo(() => {
    const visits    = pageViews?.last30 || 0
    const affClicks = affDetails?.last30days ?? analytics?.last30days ?? 0
    const ordersCount = filteredOrders.length
    return [
      { stage:'Посещения',    value:visits,      pct:100 },
      { stage:'Aff. кликове', value:affClicks,   pct: visits ? Math.round(affClicks/visits*100) : 0 },
      { stage:'Поръчки',      value:ordersCount, pct: visits ? Math.round(ordersCount/visits*100) : 0 },
    ]
  }, [pageViews, affDetails, analytics, filteredOrders])

  const offerStats = useMemo(() => {
    const active    = orders.filter(o => o.status !== 'cancelled')
    const postPurch = active.filter(o => getOfferType(o) === 'post_purchase')
    const upsell    = active.filter(o => getOfferType(o) === 'cart_upsell')
    const crossSell = active.filter(o => getOfferType(o) === 'cross_sell')
    const withOffer = active.filter(o => getOfferType(o) !== null)
    const offerRev  = withOffer.reduce((s, o) => s + Number(o.total), 0)
    const totalRev  = active.reduce((s, o) => s + Number(o.total), 0)
    const offerRate = active.length ? Math.round(withOffer.length / active.length * 100) : 0
    const revShare  = totalRev ? Math.round(offerRev / totalRev * 100) : 0
    const now = new Date()
    const dailyMap: Record<string,{offer:number;normal:number}> = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i*86400000).toISOString().slice(0,10)
      dailyMap[d] = { offer:0, normal:0 }
    }
    active.forEach(o => {
      const d = o.created_at.slice(0,10)
      if (!dailyMap[d]) return
      if (getOfferType(o) !== null) dailyMap[d].offer++
      else dailyMap[d].normal++
    })
    const dailyChart = Object.entries(dailyMap).map(([date, v]) => ({ date:date.slice(5), ...v }))
    const typePie = [
      { name:'⚡ Post-purchase', value:postPurch.length, color:'#dc2626' },
      { name:'⬆️ Ъпсел',        value:upsell.length,    color:'#7c3aed' },
      { name:'🔀 Крос-сел',      value:crossSell.length, color:'#1d4ed8' },
    ].filter(x => x.value > 0)
    return {
      withOffer, postPurch, upsell, crossSell, offerRev, totalRev, offerRate, revShare,
      dailyChart, typePie, noOfferCount: active.length - withOffer.length, noOfferRev: totalRev - offerRev,
    }
  }, [orders])

  const affTotal30 = affDetails?.last30days ?? analytics?.last30days ?? 0
  const affToday   = affDetails?.today ?? 0
  const affTotal   = affDetails?.total ?? analytics?.total ?? 0

  return (
    <div className="an-root">
      <style>{`
        .an-root{padding:20px 24px;max-width:1200px}
        @media(max-width:640px){.an-root{padding:14px 12px}}

        .aff-row:hover{background:#f0fdf4!important}

        /* grid helpers */
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        @media(max-width:700px){.g2{grid-template-columns:1fr}.g3{grid-template-columns:1fr 1fr}}
        @media(max-width:400px){.g3{grid-template-columns:1fr}}

        /* offer cards */
        .offer-card{flex:1;min-width:120px;border-radius:12px;padding:12px 14px;color:#fff}
        .offer-card-light{flex:1;min-width:120px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px}
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:900, color:'#111', letterSpacing:'-.02em', margin:0 }}>Аналитика</h1>
          <p style={{ fontSize:12, color:'#9ca3af', margin:'2px 0 0' }}>Статистики, графики и конверсии</p>
        </div>
        <RangePicker range={range} onChange={r => setRange(r)} />
      </div>

      {/* ── KPI Metrics ────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
        <MetricCard label={`Приход (${range}д)`}     value={formatPrice(metrics.rev)} prev={metrics.prevRev} color="#16a34a" icon="💶" bg="#f0fdf4" border="#bbf7d0" />
        <MetricCard label={`Поръчки (${range}д)`}    value={metrics.cnt}              prev={metrics.prevCnt} color="#f59e0b" icon="📦" bg="#fffbeb" border="#fde68a" />
        <MetricCard label="Средна стойност"           value={formatPrice(metrics.avg)} prev={metrics.prevAvg} color="#8b5cf6" icon="📊" bg="#faf5ff" border="#e9d5ff" />
        <MetricCard label="Aff. кликове (30д)"        value={affTotal30}               color="#06b6d4"         icon="🔗" bg="#ecfeff" border="#a5f3fc" />
        <MetricCard label="Aff. кликове (днес)"       value={affToday}                 color="#10b981"         icon="⚡" bg="#ecfdf5" border="#a7f3d0" />
        <MetricCard label="Aff. общо"                  value={affTotal}                 color="#6366f1"         icon="📈" bg="#eef2ff" border="#c7d2fe" />
      </div>

      {/* ── Funnel ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom:14 }}>
        <Card title="🎯 Conversion Funnel">
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {funnelData.map((f, i) => (
              <div key={f.stage} style={{ flex:'1 1 120px', minWidth:0, background:'#f9fafb', borderRadius:11, padding:'13px 14px', border:'1px solid #e5e7eb', position:'relative', overflow:'hidden' }}>
                <div style={{ fontSize:10, color:'#9ca3af', fontWeight:800, textTransform:'uppercase', marginBottom:5 }}>{i+1}. {f.stage}</div>
                <div style={{ fontSize:26, fontWeight:900, color:COLORS[i], lineHeight:1 }}>{f.value.toLocaleString()}</div>
                <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>{f.pct}% от посещенията</div>
                <div style={{ position:'absolute', bottom:0, left:0, height:3, width:`${f.pct}%`, maxWidth:'100%', background:COLORS[i], borderRadius:'0 0 0 11px', transition:'width .6s ease' }} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Charts row 1: Revenue + Page Views ─────────────────────── */}
      <div className="g2" style={{ marginBottom:14 }}>
        <Card id="chart-revenue" title={`💶 Приход — последните ${range} дни`}>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={revenueChart}>
              <defs>
                <linearGradient id="rg2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.13} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize:10, fill:'#9ca3af' }} tickLine={false} axisLine={false} interval={Math.floor(range/6)} />
              <YAxis tick={{ fontSize:10, fill:'#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} width={42} />
              <Tooltip formatter={(v: number) => [formatPrice(v), 'Приход']} contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }} />
              <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2.5} fill="url(#rg2)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {pageViews?.dailyChart ? (
          <Card id="chart-views" title="👁️ Посещения — последните 30 дни">
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={pageViews.dailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize:10, fill:'#9ca3af' }} tickLine={false} axisLine={false} interval={6} />
                <YAxis tick={{ fontSize:10, fill:'#9ca3af' }} tickLine={false} axisLine={false} width={30} />
                <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }} />
                <Bar dataKey="count"  fill="#0ea5e9" name="Общо"     radius={[3,3,0,0]} />
                <Bar dataKey="unique" fill="#86efac" name="Уникални" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        ) : (
          <Card id="chart-status" title="📊 Поръчки по статус">
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={statusPie} cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={3} dataKey="value">
                  {statusPie.map((e, i) => <Cell key={i} fill={e.color || COLORS[i%COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* ── Charts row 2: Status + Payment/Courier ─────────────────── */}
      <div className="g2" style={{ marginBottom:14 }}>
        {pageViews?.dailyChart && (
          <Card id="chart-status" title="📊 Поръчки по статус">
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={statusPie} cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={3} dataKey="value">
                  {statusPie.map((e, i) => <Cell key={i} fill={e.color || COLORS[i%COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        <Card title="💳 Плащане & куриер">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[
              { label:'ПЛАЩАНЕ', data:paymentPie },
              { label:'КУРИЕР',  data:courierData },
            ].map(({ label, data }, gi) => (
              <div key={label}>
                <div style={{ fontSize:10, fontWeight:800, color:'#9ca3af', textAlign:'center', marginBottom:4, textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</div>
                <ResponsiveContainer width="100%" height={130}>
                  <PieChart>
                    <Pie data={data} cx="50%" cy="50%" outerRadius={48} paddingAngle={3} dataKey="value">
                      {data.map((_, i) => <Cell key={i} fill={COLORS[gi*2+i]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:11 }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize:11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Top Pages + Referrers ───────────────────────────────────── */}
      {pageViews && (
        <div className="g2" style={{ marginBottom:0 }}>
          <Card title="📄 Топ страници" noPad>
            <div style={{ padding:'4px 0' }}>
              {(pageViews.topPages || [])
                .filter(p => !p.name.startsWith('/tr/') && !p.name.includes('/tr/2/'))
                .slice(0, 8)
                .map((p, i) => {
                  const displayName = p.name.length > 40 ? p.name.slice(0,37)+'…' : p.name
                  const maxCount = (pageViews.topPages||[]).filter(x => !x.name.startsWith('/tr/'))[0]?.count || 1
                  return (
                    <div key={p.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 16px', borderBottom:'1px solid #f5f5f5', fontSize:12 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, minWidth:0, flex:1 }}>
                        <span style={{ width:18, height:18, background:'#f3f4f6', borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:'#6b7280', flexShrink:0 }}>{i+1}</span>
                        <span title={p.name} style={{ color:'#374151', fontFamily:'monospace', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{displayName}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:7, flexShrink:0, marginLeft:8 }}>
                        <div style={{ width:52, height:4, background:'#f3f4f6', borderRadius:99 }}>
                          <div style={{ height:'100%', width:`${(p.count/maxCount)*100}%`, background:'#16a34a', borderRadius:99 }} />
                        </div>
                        <span style={{ fontWeight:700, color:'#111', minWidth:26, textAlign:'right' }}>{p.count}</span>
                      </div>
                    </div>
                  )
                })}
            </div>
          </Card>

          <Card title="🌐 Топ източници" noPad>
            <div style={{ padding:'4px 0' }}>
              {(pageViews.topReferrers || []).map((r, i) => (
                <div key={r.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 16px', borderBottom:'1px solid #f5f5f5', fontSize:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <span style={{ width:18, height:18, background:'#f3f4f6', borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:'#6b7280', flexShrink:0 }}>{i+1}</span>
                    <span style={{ color:'#374151' }}>{r.name}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <div style={{ width:52, height:4, background:'#f3f4f6', borderRadius:99 }}>
                      <div style={{ height:'100%', width:`${(r.count/(pageViews.topReferrers![0]?.count||1))*100}%`, background:'#0ea5e9', borderRadius:99 }} />
                    </div>
                    <span style={{ fontWeight:700, minWidth:26, textAlign:'right' }}>{r.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ══ AFFILIATE SECTION ══════════════════════════════════════════ */}
      <SectionLabel label="🔗 Affiliate Аналитика" color="#06b6d4" bg="#ecfeff" border="#a5f3fc" />

      {/* Affiliate summary mini cards */}
      <div className="g3" style={{ marginBottom:14 }}>
        {[
          { label:'Днес',   value: affDetails?.today      ?? 0,          color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0' },
          { label:'7 дни',  value: affDetails?.last7days  ?? 0,          color:'#0ea5e9', bg:'#eff6ff', border:'#bfdbfe' },
          { label:'30 дни', value: affTotal30,                           color:'#06b6d4', bg:'#ecfeff', border:'#a5f3fc' },
          { label:'Общо',   value: affTotal,                             color:'#8b5cf6', bg:'#faf5ff', border:'#e9d5ff' },
        ].map(c => (
          <div key={c.label} style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:12, padding:'12px 14px' }}>
            <div style={{ fontSize:10, fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>{c.label}</div>
            <div style={{ fontSize:22, fontWeight:900, color:c.color, lineHeight:1 }}>{c.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="g2" style={{ marginBottom:14 }}>
        <Card title="🔗 Кликове по продукт">
          {affLoading ? (
            <div style={{ padding:'20px 0', textAlign:'center', color:'#9ca3af', fontSize:13 }}>⏳ Зарежда...</div>
          ) : affDetails ? (
            <AffiliateDetailsTable details={affDetails} />
          ) : (
            <div style={{ padding:'20px 0', textAlign:'center', color:'#9ca3af', fontSize:13 }}>Няма данни</div>
          )}
        </Card>

        {affDetails?.dailyChart && affDetails.dailyChart.some(d => d.count > 0) && (
          <Card title="📈 Affiliate кликове — 30 дни">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={affDetails.dailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize:10, fill:'#9ca3af' }} tickLine={false} axisLine={false} interval={6} />
                <YAxis tick={{ fontSize:10, fill:'#9ca3af' }} tickLine={false} axisLine={false} width={26} allowDecimals={false} />
                <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }} formatter={(v: number) => [v, 'Кликове']} />
                <Bar dataKey="count" fill="#06b6d4" radius={[4,4,0,0]} name="Кликове" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {affBar.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <Card title="📊 Топ продукти по клик (30 дни)">
            <ResponsiveContainer width="100%" height={Math.max(160, affBar.length*34)}>
              <BarChart data={affBar} layout="vertical" margin={{ left:8, right:16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize:10, fill:'#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize:10, fill:'#374151' }} tickLine={false} axisLine={false} width={110} />
                <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }} formatter={(v: number) => [v, 'Кликове']} />
                <Bar dataKey="value" radius={[0,5,5,0]} name="Кликове">
                  {affBar.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* ══ OFFER ANALYTICS ══════════════════════════════════════════════ */}
      {offerStats.withOffer.length > 0 && (
        <>
          <SectionLabel label="📣 Offer Аналитика" color="#7c3aed" bg="#f5f3ff" border="#ede9fe" />

          <div style={{ display:'flex', gap:9, flexWrap:'wrap', marginBottom:14 }}>
            <div className="offer-card" style={{ background:'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
              <div style={{ fontSize:10, opacity:.75, fontWeight:800, marginBottom:3, textTransform:'uppercase' }}>📣 Общо оферти</div>
              <div style={{ fontSize:24, fontWeight:900 }}>{offerStats.withOffer.length}</div>
              <div style={{ fontSize:11, opacity:.7 }}>поръчки с оферта</div>
            </div>
            <div className="offer-card" style={{ background:'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
              <div style={{ fontSize:10, opacity:.75, fontWeight:800, marginBottom:3, textTransform:'uppercase' }}>⚡ Post-purchase</div>
              <div style={{ fontSize:24, fontWeight:900 }}>{offerStats.postPurch.length}</div>
              <div style={{ fontSize:11, opacity:.7 }}>след поръчка</div>
            </div>
            <div className="offer-card" style={{ background:'linear-gradient(135deg,#7c3aed,#5b21b6)' }}>
              <div style={{ fontSize:10, opacity:.75, fontWeight:800, marginBottom:3, textTransform:'uppercase' }}>⬆️ Ъпсел</div>
              <div style={{ fontSize:24, fontWeight:900 }}>{offerStats.upsell.length}</div>
              <div style={{ fontSize:11, opacity:.7 }}>upgrade в количката</div>
            </div>
            <div className="offer-card" style={{ background:'linear-gradient(135deg,#0369a1,#1d4ed8)' }}>
              <div style={{ fontSize:10, opacity:.75, fontWeight:800, marginBottom:3, textTransform:'uppercase' }}>🔀 Крос-сел</div>
              <div style={{ fontSize:24, fontWeight:900 }}>{offerStats.crossSell.length}</div>
              <div style={{ fontSize:11, opacity:.7 }}>допълващ продукт</div>
            </div>
            <div className="offer-card" style={{ background:'linear-gradient(135deg,#059669,#047857)' }}>
              <div style={{ fontSize:10, opacity:.75, fontWeight:800, marginBottom:3, textTransform:'uppercase' }}>💶 Приход от оферти</div>
              <div style={{ fontSize:22, fontWeight:900 }}>{formatPrice(offerStats.offerRev)}</div>
              <div style={{ fontSize:11, opacity:.7 }}>{offerStats.revShare}% от общия приход</div>
            </div>
            <div className="offer-card-light">
              <div style={{ fontSize:10, color:'#9ca3af', fontWeight:800, marginBottom:3, textTransform:'uppercase' }}>📊 Конверсия</div>
              <div style={{ fontSize:24, fontWeight:900, color:'#7c3aed' }}>{offerStats.offerRate}%</div>
              <div style={{ fontSize:11, color:'#6b7280' }}>от поръчките</div>
            </div>
          </div>

          <div className="g2" style={{ marginBottom:14 }}>
            <Card id="chart-offer-daily" title="📣 С оферта vs нормални (30д)">
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={offerStats.dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize:9, fill:'#9ca3af' }} tickLine={false} axisLine={false} interval={6} />
                  <YAxis tick={{ fontSize:9, fill:'#9ca3af' }} tickLine={false} axisLine={false} width={22} allowDecimals={false} />
                  <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }} />
                  <Bar dataKey="normal" name="Нормални" stackId="a" fill="#86efac" />
                  <Bar dataKey="offer"  name="С оферта" stackId="a" fill="#7c3aed" radius={[3,3,0,0]} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize:11 }} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {offerStats.typePie.length > 0 && (
              <Card id="chart-offer-type" title="🔀 По тип оферта">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={offerStats.typePie} cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={3} dataKey="value">
                      {offerStats.typePie.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>

          <Card title="💶 Приход: с оферта vs без оферта">
            <div style={{ display:'flex', gap:20, alignItems:'center', flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:180 }}>
                <div style={{ height:28, background:'#f3f4f6', borderRadius:99, overflow:'hidden', display:'flex' }}>
                  <div style={{ width:`${offerStats.revShare}%`, background:'linear-gradient(90deg,#7c3aed,#6d28d9)', borderRadius: offerStats.revShare < 98 ? '99px 0 0 99px' : 99, transition:'width .6s ease', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {offerStats.revShare > 10 && <span style={{ fontSize:11, fontWeight:800, color:'#fff' }}>{offerStats.revShare}%</span>}
                  </div>
                  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#6b7280' }}>{100-offerStats.revShare}%</span>
                  </div>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:7, fontSize:12 }}>
                  <span style={{ color:'#7c3aed', fontWeight:700 }}>● С оферта: {formatPrice(offerStats.offerRev)}</span>
                  <span style={{ color:'#6b7280' }}>● Без: {formatPrice(offerStats.noOfferRev)}</span>
                </div>
              </div>
              <div style={{ display:'flex', gap:20, flexShrink:0 }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:20, fontWeight:900, color:'#7c3aed' }}>
                    {formatPrice(offerStats.withOffer.length ? offerStats.offerRev/offerStats.withOffer.length : 0)}
                  </div>
                  <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>Ср. AOV с оферта</div>
                </div>
                <div style={{ width:1, background:'#e5e7eb' }} />
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:20, fontWeight:900, color:'#16a34a' }}>
                    {formatPrice(offerStats.noOfferCount > 0 ? offerStats.noOfferRev/offerStats.noOfferCount : 0)}
                  </div>
                  <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>Ср. AOV без оферта</div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      <div style={{ height:24 }} />
    </div>
  )
}
