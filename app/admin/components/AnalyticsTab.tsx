'use client'
// app/admin/components/AnalyticsTab.tsx — v18
// ✅ ПОПРАВКИ v18 (спрямо v17):
//   - AffiliateAnalytics тип вече е пълен (импорт от @/lib/supabase) — без (as any) навсякъде
//   - PageViewStats тип вече включва last90, topPages30/7/Today, topReferrers30/7/Today
//   - Мобилен CSS: g2/g4/g5 се адаптират правилно, offer-row не се разтяга
//   - Affiliate карти: last90days директно от типа (не (as any))
//   - pageViews.last90 и pageViews.last90Unique — директно от типа
//   - affDetails.last90days — директно от типа (не (as any))

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
import {
  type Range, RANGE_OPTIONS, getRangeLabel, calcTrend,
  filterByRange, filterPrevPeriod, buildRevenueChart, getXAxisInterval,
  toBulgarianDateStr, toBulgarianHour, getCurrentBulgarianHour,
} from './rangeUtils'

export type { Range }
export { RANGE_OPTIONS, getRangeLabel }

const COLORS = ['#16a34a','#0ea5e9','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#10b981']

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
  last90days:     number
  byProduct:      Record<string, number>
  byPartner:      Record<string, number>
  productDetails: Record<string, { total: number; last30: number; last7: number; today: number }>
  topProducts:    { slug: string; partner?: string | null; total: number; last30: number; last7: number; today: number }[]
  topPartners:    { name: string; count: number }[]
  dailyChart:     { date: string; count: number }[]
  hourlyChart?:   { hour: number; count: number }[]
  slugsByPartner: Record<string, string[]>
}

// ─── Тип на клик по partner ───────────────────────────────────────────────────
const PARTNER_TYPE_MAP: Record<string, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  agroapteki: { label: 'Афилиет продукт',  emoji: '🔗', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  category:   { label: 'Категориен линк',  emoji: '🏷️', color: '#0ea5e9', bg: '#eff6ff', border: '#bfdbfe' },
  ginegar:    { label: 'Спец. секция',     emoji: '🏕️', color: '#7c3aed', bg: '#f5f3ff', border: '#e9d5ff' },
}
function getPartnerMeta(partner: string | null | undefined) {
  if (!partner) return null
  return PARTNER_TYPE_MAP[partner] ?? { label: partner, emoji: '🔘', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' }
}

type OfferType = 'post_purchase' | 'cart_upsell' | 'cross_sell'

function getOfferTypes(o: Order): OfferType[] {
  const notes = o.customer_notes || ''
  const oo    = o as any
  const items = o.order_items || []
  const found = new Set<OfferType>()

  if (oo.has_post_purchase_upsell || oo.offer_type === 'post_purchase' || notes.includes('[POST-PURCHASE')) found.add('post_purchase')
  if (oo.offer_type === 'cart_upsell' || notes.includes('[CART-UPSELL]') || notes.includes('[HAS-OFFER]') || items.some((i: any) => (i.product_name || '').toLowerCase().includes('upsell'))) found.add('cart_upsell')
  if (oo.offer_type === 'cross_sell' || notes.includes('[CROSS-SELL]') || items.some((i: any) => /\(-\d+%\)/.test(i.product_name || '')) || items.some((i: any) => (i.product_name || '').toLowerCase().includes('cross'))) found.add('cross_sell')

  return Array.from(found)
}

// ─── Hourly helpers ───────────────────────────────────────────────────────────

function buildRevenueChartHourly(orders: Order[]): { date: string; revenue: number; count: number }[] {
  const now      = new Date()
  const todayStr = toBulgarianDateStr(now)
  const maxHour  = getCurrentBulgarianHour()
  const map: Record<number, { revenue: number; count: number }> = {}
  for (let h = 0; h <= maxHour; h++) map[h] = { revenue: 0, count: 0 }

  orders.forEach(o => {
    const orderBgDate = toBulgarianDateStr(new Date(o.created_at))
    if (orderBgDate !== todayStr) return
    if (o.status === 'cancelled') return
    const hour = toBulgarianHour(new Date(o.created_at))
    if (map[hour] !== undefined) {
      map[hour].revenue += Number(o.total)
      map[hour].count   += 1
    }
  })

  return Object.entries(map).map(([h, v]) => ({
    date: `${String(h).padStart(2,'0')}ч`,
    ...v,
  }))
}

function getAffHourlyChart(aff: AffiliateDetail | null): { date: string; count: number }[] {
  if (!aff) return []
  if (aff.hourlyChart?.length) {
    return aff.hourlyChart.map(({ hour, count }) => ({
      date: `${String(hour).padStart(2, '0')}ч`,
      count,
    }))
  }
  return aff.today > 0 ? [{ date: 'Днес', count: aff.today }] : []
}

function getVisitsForRange(pageViews: PageViewStats | null, range: Range): number {
  if (!pageViews) return 0
  if (range === 1)     return pageViews.today    ?? 0
  if (range === 7)     return pageViews.last7    ?? 0
  if (range === 30)    return pageViews.last30   ?? 0
  if (range === 90)    return pageViews.last90   ?? pageViews.total ?? 0
  if (range === 365)   return pageViews.total    ?? 0
  return pageViews.total ?? 0
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

export function RangePicker({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  return (
    <div style={{ display:'flex', background:'#f1f5f9', borderRadius:10, padding:3, gap:2 }}>
      {RANGE_OPTIONS.map(opt => (
        <button key={String(opt.value)} onClick={() => onChange(opt.value)} style={{
          padding:'5px 13px', borderRadius:7, border:'none', fontFamily:'inherit',
          fontSize:12, fontWeight:700, cursor:'pointer', transition:'all .15s',
          background: range === opt.value ? '#fff' : 'transparent',
          color:      range === opt.value ? '#111' : '#94a3b8',
          boxShadow:  range === opt.value ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
          whiteSpace: 'nowrap',
        }}>{opt.label}</button>
      ))}
    </div>
  )
}

function TrendBadge({ current, prev }: { current: number; prev: number }) {
  const trend = calcTrend(current, prev)
  if (trend === null) return null
  const up = trend >= 0
  return (
    <span style={{
      fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:99,
      background: up ? '#dcfce7' : '#fee2e2',
      color:      up ? '#15803d' : '#dc2626',
    }}>{up ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%</span>
  )
}

function MetricCard({ label, value, prevValue, color, icon, bg, border }: {
  label: string; value: number | string; prevValue?: number
  color: string; icon: string; bg?: string; border?: string
}) {
  const numVal = typeof value === 'number' ? value : null
  return (
    <div style={{ background:bg||'#fff', border:`1px solid ${border||'#e5e7eb'}`,
      borderRadius:13, padding:'14px 16px', flex:'1 1 130px', minWidth:0 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <span style={{ fontSize:16 }}>{icon}</span>
        {numVal !== null && prevValue !== undefined && (
          <TrendBadge current={numVal} prev={prevValue} />
        )}
      </div>
      <div style={{ fontSize:22, fontWeight:900, color, letterSpacing:'-.02em', lineHeight:1.15 }}>{value}</div>
      <div style={{ fontSize:11, color:'#94a3b8', marginTop:3, fontWeight:500 }}>{label}</div>
    </div>
  )
}

export const Card = ({ id, title, subtitle, children, noPad }: {
  id?: string; title: string; subtitle?: string; children: React.ReactNode; noPad?: boolean
}) => (
  <div id={id} style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:14, overflow:'hidden' }}>
    <div style={{ padding:'13px 18px', borderBottom:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <h3 style={{ fontSize:13, fontWeight:700, margin:0, color:'#111' }}>{title}</h3>
      {subtitle && <span style={{ fontSize:11, color:'#94a3b8' }}>{subtitle}</span>}
    </div>
    <div style={noPad ? {} : { padding:'14px 18px' }}>{children}</div>
  </div>
)

function SectionDivider({ label, color, bg, border }: { label:string; color:string; bg:string; border:string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, margin:'24px 0 14px' }}>
      <div style={{ flex:1, height:1, background:'#e5e7eb' }} />
      <span style={{ fontSize:10, fontWeight:800, color, letterSpacing:'.08em', textTransform:'uppercase',
        background:bg, border:`1px solid ${border}`, padding:'4px 14px', borderRadius:99, whiteSpace:'nowrap' }}>
        {label}
      </span>
      <div style={{ flex:1, height:1, background:'#e5e7eb' }} />
    </div>
  )
}

// ─── Affiliate table ──────────────────────────────────────────────────────────

function AffiliateDetailsTable({ details, range }: { details: AffiliateDetail; range: Range }) {
  const defaultSort = (): 'last30'|'last7'|'today'|'total' => {
    if (range === 1)                             return 'today'
    if (range === 7)                             return 'last7'
    if (range === 'all')                         return 'total'
    if (typeof range === 'number' && range >= 90) return 'total'
    return 'last30'
  }
  const [sortBy, setSortBy] = useState<'last30'|'last7'|'today'|'total'>(defaultSort)
  useEffect(() => { setSortBy(defaultSort()) }, [range]) // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(() =>
    details.topProducts.slice().sort((a, b) => b[sortBy] - a[sortBy]),
    [details.topProducts, sortBy]
  )
  const maxVal = sorted[0]?.[sortBy] || 1

  if (sorted.length === 0) return (
    <div style={{ padding:'32px 0', textAlign:'center', color:'#94a3b8' }}>
      <div style={{ fontSize:32, marginBottom:8 }}>🔗</div>
      <div style={{ fontSize:13, fontWeight:600 }}>Няма записани affiliate кликове</div>
    </div>
  )

  const SortBtn = ({ k, label }: { k: typeof sortBy; label: string }) => (
    <button onClick={() => setSortBy(k)} style={{
      padding:'3px 10px', borderRadius:6, border:'none', fontFamily:'inherit',
      fontSize:11, fontWeight:700, cursor:'pointer', transition:'all .15s',
      background: sortBy===k ? '#16a34a' : '#f3f4f6',
      color:      sortBy===k ? '#fff'    : '#6b7280',
    }}>{label}</button>
  )

  return (
    <div>
      <div style={{ display:'flex', gap:5, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:10, color:'#94a3b8', fontWeight:700 }}>СОРТИРАЙ:</span>
        <SortBtn k="today" label="Днес" /><SortBtn k="last7" label="7д" />
        <SortBtn k="last30" label="30д" /><SortBtn k="total" label="Общо" />
      </div>

      <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:460 }}>
          <thead>
            <tr style={{ borderBottom:'2px solid #f3f4f6' }}>
              {['Продукт','Тип','Днес','7д','30д','Общо',''].map((h, i) => (
                <th key={i} style={{
                  textAlign: i<=1 ? 'left' : (i===6 ? 'left' : 'right'),
                  padding:'6px 8px', fontSize:9, fontWeight:800, color:'#94a3b8',
                  letterSpacing:'.06em', textTransform:'uppercase',
                  minWidth: i===6 ? 70 : i===1 ? 90 : undefined,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const meta = getPartnerMeta(p.partner)
              return (
                <tr key={p.slug} style={{
                  borderBottom:'1px solid #f9fafb',
                  background: i%2===0 ? '#fff' : '#fafafa',
                }}>
                  <td style={{ padding:'8px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{
                        width:20, height:20, borderRadius:5, flexShrink:0,
                        background: i<3 ? ['#fef9c3','#f0fdf4','#eff6ff'][i] : '#f9fafb',
                        color:      i<3 ? ['#b45309','#15803d','#1d4ed8'][i] : '#94a3b8',
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:900,
                      }}>{i+1}</span>
                      <code style={{ fontSize:11, color:'#374151', background:'#f3f4f6', padding:'2px 6px', borderRadius:4 }}>{p.slug}</code>
                    </div>
                  </td>
                  <td style={{ padding:'8px' }}>
                    {meta ? (
                      <span style={{
                        fontSize:9, fontWeight:800, color: meta.color,
                        background: meta.bg, border:`1px solid ${meta.border}`,
                        padding:'2px 7px', borderRadius:99, whiteSpace:'nowrap',
                        display:'inline-flex', alignItems:'center', gap:3,
                      }}>
                        {meta.emoji} {meta.label}
                      </span>
                    ) : (
                      <span style={{ fontSize:10, color:'#9ca3af' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding:'8px', textAlign:'right', fontWeight:p.today>0?800:400, color:p.today>0?'#16a34a':'#94a3b8' }}>{p.today>0?p.today:'—'}</td>
                  <td style={{ padding:'8px', textAlign:'right', fontWeight:600, color:'#374151' }}>{p.last7}</td>
                  <td style={{ padding:'8px', textAlign:'right', fontWeight:800, color:'#111' }}>{p.last30}</td>
                  <td style={{ padding:'8px', textAlign:'right', color:'#6b7280' }}>{p.total}</td>
                  <td style={{ padding:'8px' }}>
                    <div style={{ height:5, background:'#f3f4f6', borderRadius:99, overflow:'hidden', minWidth:60 }}>
                      <div style={{
                        height:'100%', width:`${Math.round((p[sortBy]/maxVal)*100)}%`,
                        background: meta ? `linear-gradient(90deg,${meta.color},${meta.color}99)` : 'linear-gradient(90deg,#16a34a,#4ade80)',
                        borderRadius:99, transition:'width .4s ease',
                      }} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {details.topPartners.length > 0 && (
        <div style={{ marginTop:14, padding:'12px 14px', background:'#f8fafc', borderRadius:9, border:'1px solid #e5e7eb' }}>
          <div style={{ fontSize:9, fontWeight:800, color:'#94a3b8', letterSpacing:'.06em', textTransform:'uppercase', marginBottom:9 }}>
            Разпределение по тип
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {details.topPartners.map(p => {
              const meta = getPartnerMeta(p.name) ?? { label: p.name, emoji:'🔘', color:'#6b7280', bg:'#f9fafb', border:'#e5e7eb' }
              const pct  = details.total ? Math.round((p.count / details.total) * 100) : 0
              return (
                <div key={p.name} style={{
                  flex:'1 1 160px', minWidth:0,
                  background: meta.bg, border:`1px solid ${meta.border}`,
                  borderRadius:10, padding:'10px 13px',
                  display:'flex', alignItems:'center', gap:10,
                }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>{meta.emoji}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, fontWeight:800, color: meta.color }}>{meta.label}</div>
                    <div style={{ fontSize:10, color:'#9ca3af', marginBottom:5 }}>{p.name}</div>
                    <div style={{ height:4, background:'#e5e7eb', borderRadius:99, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background: meta.color, borderRadius:99, transition:'width .5s' }} />
                    </div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:20, fontWeight:900, color: meta.color, lineHeight:1 }}>{p.count}</div>
                    <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>{pct}%</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Affiliate helpers ────────────────────────────────────────────────────────

function getAffClicks(aff: AffiliateDetail | null, analytics: AffiliateAnalytics | null, range: Range): number {
  if (!aff) return analytics?.last30days ?? 0
  if (range === 1)     return aff.today
  if (range === 7)     return aff.last7days
  if (range === 30)    return aff.last30days
  if (range === 'all') return aff.total
  if (range === 90)    return aff.last90days ?? aff.last30days
  return aff.total
}

function getAffDailyChart(aff: AffiliateDetail | null, range: Range): { date: string; count: number }[] {
  if (!aff?.dailyChart?.length) return []
  if (range === 'all' || range === 90) return aff.dailyChart

  const now  = new Date()
  const days = range as number

  const validDates = new Set(
    Array.from({ length: days }, (_, i) => {
      const d = new Date(now.getTime() - (days - 1 - i) * 86400000)
      return d.toISOString().slice(5, 10)
    })
  )
  return aff.dailyChart.filter(d => {
    const md = d.date.length === 5 ? d.date : d.date.slice(5)
    return validDates.has(md)
  })
}

function getAffBar(
  affDetails: AffiliateDetail | null,
  analytics: AffiliateAnalytics | null,
  range: Range
): { name: string; value: number }[] {
  if (!affDetails?.productDetails) {
    if (!analytics?.byProduct) return []
    return Object.entries(analytics.byProduct)
      .sort(([,a],[,b]) => b - a).slice(0, 10)
      .map(([name, value]) => ({ name, value }))
  }

  const pd = affDetails.productDetails
  let getValue: (v: { total: number; last30: number; last7: number; today: number }) => number

  if (range === 1)      getValue = v => v.today
  else if (range === 7) getValue = v => v.last7
  else if (range === 30) getValue = v => v.last30
  else if (range === 'all') getValue = v => v.total
  else getValue = v => v.total

  return Object.entries(pd)
    .map(([name, v]) => ({ name, value: getValue(v) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
}

// ─── Главен компонент ─────────────────────────────────────────────────────────

export function AnalyticsTab({ analytics, pageViews, orders }: Props) {
  const { fmt: formatPrice } = useCurrency()
  const [range, setRange]           = useState<Range>(30)
  const [affDetails, setAffDetails] = useState<AffiliateDetail | null>(null)
  const [affLoading, setAffLoading] = useState(true)

  useEffect(() => {
    setAffLoading(true)
    fetch('/api/analytics/affiliate-click')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAffDetails(data) })
      .catch(() => {})
      .finally(() => setAffLoading(false))
  }, [])

  const filteredOrders = useMemo(() => filterByRange(orders, range),    [orders, range])
  const prevOrders     = useMemo(() => filterPrevPeriod(orders, range), [orders, range])

  const metrics = useMemo(() => {
    const active     = filteredOrders.filter(o => o.status !== 'cancelled')
    const prevActive = prevOrders.filter(o => o.status !== 'cancelled')
    const rev     = active.reduce((s, o) => s + Number(o.total), 0)
    const prevRev = prevActive.reduce((s, o) => s + Number(o.total), 0)
    const cnt     = filteredOrders.length
    const prevCnt = prevOrders.length
    const avg     = cnt ? rev / cnt : 0
    const prevAvg = prevCnt ? prevRev / prevCnt : 0
    return { rev, prevRev, cnt, prevCnt, avg, prevAvg }
  }, [filteredOrders, prevOrders])

  const revenueChart = useMemo(
    () => range === 1
      ? buildRevenueChartHourly(filteredOrders)
      : buildRevenueChart(filteredOrders, range),
    [filteredOrders, range]
  )

  const pageViewsChart = useMemo(() => {
    if (range === 1) {
      const hc = pageViews?.hourlyChart
      if (hc?.length) {
        return hc.map(({ hour, count, unique }) => ({
          date:   `${String(hour).padStart(2, '0')}ч`,
          count,
          unique: unique ?? 0,
        }))
      }
      const todayEntry = pageViews?.dailyChart?.slice(-1) ?? []
      return todayEntry.map(e => ({ ...e, date: 'Днес' }))
    }
    if (!pageViews?.dailyChart?.length) return []
    if (range === 'all' || (range as number) >= 90) return pageViews.dailyChart
    return pageViews.dailyChart.slice(-(range as number))
  }, [pageViews, range])

  const statusPie = useMemo(() => {
    const map: Record<string, number> = {}
    filteredOrders.forEach(o => { map[o.status] = (map[o.status] || 0) + 1 })
    return Object.entries(map).map(([key, value]) => ({
      name: STATUS_LABELS[key]?.label || key,
      value,
      color: STATUS_LABELS[key]?.color || '#9ca3af',
    }))
  }, [filteredOrders])

  const affClicks     = useMemo(() => getAffClicks(affDetails, analytics, range),      [affDetails, analytics, range])
  const aff90Clicks   = useMemo(() => getAffClicks(affDetails, analytics, 90),         [affDetails, analytics])
  const affDailyChart = useMemo(() => {
    if (range === 1) return getAffHourlyChart(affDetails)
    return getAffDailyChart(affDetails, range)
  }, [affDetails, range])
  const affBar        = useMemo(() => getAffBar(affDetails, analytics, range),         [affDetails, analytics, range])

  const funnelData = useMemo(() => {
    const visits = getVisitsForRange(pageViews, range)
    const cnt    = filteredOrders.length
    return [
      { stage:'Посещения',    value: visits,    pct: 100 },
      { stage:'Aff. кликове', value: affClicks, pct: visits ? Math.round(affClicks / visits * 100) : 0 },
      { stage:'Поръчки',      value: cnt,       pct: visits ? Math.round(cnt / visits * 100) : 0 },
    ]
  }, [pageViews, affClicks, filteredOrders, range])

  const offerStats = useMemo(() => {
    const active    = filteredOrders.filter(o => o.status !== 'cancelled')
    const withTypes = active.map(o => ({ o, types: getOfferTypes(o) }))
    const postPurch  = withTypes.filter(x => x.types.includes('post_purchase')).map(x => x.o)
    const upsell     = withTypes.filter(x => x.types.includes('cart_upsell')).map(x => x.o)
    const crossSell  = withTypes.filter(x => x.types.includes('cross_sell')).map(x => x.o)
    const withOffer  = withTypes.filter(x => x.types.length > 0).map(x => x.o)
    const offerRev   = withOffer.reduce((s, o) => s + Number(o.total), 0)
    const totalRev   = active.reduce((s, o) => s + Number(o.total), 0)
    const offerRate  = active.length ? Math.round(withOffer.length / active.length * 100) : 0
    const revShare   = totalRev ? Math.round(offerRev / totalRev * 100) : 0

    const ppExtraRev = postPurch.reduce((sum, o) => {
      const ppItems = (o.order_items || []).filter((i: any) =>
        (i.product_name || '').toLowerCase().includes('post-purchase') ||
        (i.product_name || '').toLowerCase().includes('post purchase')
      )
      return sum + ppItems.reduce((s: number, i: any) => s + Number(i.total_price), 0)
    }, 0)

    const days = range === 'all' ? 90 : Math.min(range as number, 90)
    const now  = new Date()
    const dailyMap: Record<string, {offer:number; normal:number}> = {}
    for (let i = days - 1; i >= 0; i--) {
      const d2 = new Date(now); d2.setDate(d2.getDate() - i)
      const d = toBulgarianDateStr(d2)
      dailyMap[d] = { offer: 0, normal: 0 }
    }
    active.forEach(o => {
      const d = toBulgarianDateStr(new Date(o.created_at))
      if (!dailyMap[d]) return
      if (getOfferTypes(o).length > 0) dailyMap[d].offer++
      else dailyMap[d].normal++
    })

    const dailyChart = Object.entries(dailyMap).map(([date, v]) => ({ date: date.slice(5), ...v }))
    const typePie = [
      { name:'⚡ Post-purchase', value: postPurch.length,  color:'#dc2626' },
      { name:'⬆️ Ъпсел',        value: upsell.length,     color:'#7c3aed' },
      { name:'🔀 Крос-сел',      value: crossSell.length,  color:'#1d4ed8' },
    ].filter(x => x.value > 0)

    return {
      withOffer, postPurch, upsell, crossSell,
      offerRev, totalRev, offerRate, revShare,
      ppExtraRev,
      dailyChart, typePie,
      noOfferCount: active.length - withOffer.length,
      noOfferRev:   totalRev - offerRev,
    }
  }, [filteredOrders, range])

  const rl = getRangeLabel(range)

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="an-root">
      <style>{`
        .an-root { padding: 20px 24px; max-width: 1200px; box-sizing: border-box; overflow-x: hidden }
        @media(max-width:640px) { .an-root { padding: 12px 10px } }

        /* ── Grids ── */
        .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; min-width: 0 }
        .g4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px }
        .g5 { display: grid; grid-template-columns: repeat(5,1fr); gap: 10px }

        @media(max-width:1000px) { .g5 { grid-template-columns: repeat(3,1fr) } }
        @media(max-width:900px)  { .g4 { grid-template-columns: 1fr 1fr } .g5 { grid-template-columns: repeat(3,1fr) } }
        @media(max-width:700px)  { .g2 { grid-template-columns: 1fr } .g5 { grid-template-columns: 1fr 1fr } }
        @media(max-width:460px)  { .g4 { grid-template-columns: 1fr 1fr } .g5 { grid-template-columns: 1fr 1fr } }

        /* ── Metric cards ── */
        .metric-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px }
        .metric-row > * { flex: 1 1 130px; min-width: 0 }
        @media(max-width:480px) { .metric-row > * { flex: 1 1 calc(50% - 5px) } }

        /* ── Affiliate table ── */
        .aff-row:hover { background: #f0fdf4 !important }

        /* ── Offer cards ── */
        .offer-row { display: flex; gap: 9px; flex-wrap: wrap; margin-bottom: 14px }
        .offer-card { flex: 1 1 110px; min-width: 0; border-radius: 12px; padding: 12px 14px; color: #fff; box-sizing: border-box }
        .offer-card-light { flex: 1 1 110px; min-width: 0; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 14px; box-sizing: border-box }
        @media(max-width:520px) {
          .offer-card, .offer-card-light { flex: 1 1 calc(50% - 5px) }
        }
        @media(max-width:320px) {
          .offer-card, .offer-card-light { flex: 1 1 100% }
        }

        /* ── Range picker ── */
        .range-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 2px }
        .range-scroll::-webkit-scrollbar { display: none }

        /* ── Page view summary grid ── */
        .pv-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px }
        @media(max-width:480px) { .pv-summary-grid { grid-template-columns: repeat(2,1fr) } }

        /* ── Funnel ── */
        .funnel-row { display: flex; gap: 10px; flex-wrap: wrap }
        .funnel-row > * { flex: 1 1 120px; min-width: 0 }

        /* ── Header ── */
        .an-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; flex-wrap: wrap; gap: 10px }
        @media(max-width:480px) { .an-header { flex-direction: column } .an-header > div:last-child { width: 100% } }

        /* ── Recharts mobile ── */
        @media(max-width:640px) {
          .recharts-wrapper { font-size: 10px }
          .recharts-legend-wrapper { font-size: 10px !important }
        }

        /* ── pv card active border fix ── */
        .pv-card-active { background: #f0fdf4 !important }
      `}</style>

      {/* ── Header ── */}
      <div className="an-header">
        <div>
          <h1 style={{ fontSize:20, fontWeight:900, color:'#111', letterSpacing:'-.02em', margin:0 }}>Аналитика</h1>
          <p style={{ fontSize:12, color:'#94a3b8', margin:'2px 0 0' }}>Статистики за избрания период</p>
        </div>
        <div className="range-scroll">
          <RangePicker range={range} onChange={setRange} />
        </div>
      </div>

      {/* ── KPI Metrics ── */}
      <div className="metric-row">
        <MetricCard label={`Приход (${rl})`}      value={formatPrice(metrics.rev)} prevValue={metrics.prevRev} color="#16a34a" icon="💶" bg="#f0fdf4" border="#bbf7d0" />
        <MetricCard label={`Поръчки (${rl})`}     value={metrics.cnt}              prevValue={metrics.prevCnt} color="#f59e0b" icon="📦" bg="#fffbeb" border="#fde68a" />
        <MetricCard label="Средна поръчка"          value={formatPrice(metrics.avg)} prevValue={metrics.prevAvg} color="#8b5cf6" icon="📊" bg="#faf5ff" border="#e9d5ff" />
        <MetricCard label={`Aff. кликове (${rl})`} value={affClicks}                color="#06b6d4"              icon="🔗" bg="#ecfeff" border="#a5f3fc" />
      </div>

      {/* ── Conversion Funnel ── */}
      <div style={{ marginBottom:14 }}>
        <Card title="🎯 Conversion Funnel" subtitle={rl}>
          {!pageViews && (
            <div style={{ marginBottom:10, padding:'8px 12px', background:'#fff7ed', borderRadius:8, border:'1px solid #fed7aa', fontSize:12, color:'#92400e' }}>
              ⚠️ Данните за посещения не са заредени — funnel показва само поръчки
            </div>
          )}
          <div className="funnel-row">
            {funnelData.map((f, i) => (
              <div key={f.stage} style={{
                flex:'1 1 120px', minWidth:0, background:'#f9fafb', borderRadius:11,
                padding:'13px 14px', border:'1px solid #e5e7eb', position:'relative', overflow:'hidden',
              }}>
                <div style={{ fontSize:10, color:'#94a3b8', fontWeight:800, textTransform:'uppercase', marginBottom:5 }}>{i+1}. {f.stage}</div>
                <div style={{ fontSize:26, fontWeight:900, color:COLORS[i], lineHeight:1 }}>{f.value.toLocaleString()}</div>
                <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>{f.pct}% от посещенията</div>
                <div style={{ position:'absolute', bottom:0, left:0, height:3, width:`${f.pct}%`, maxWidth:'100%', background:COLORS[i], borderRadius:'0 0 0 11px', transition:'width .6s ease' }} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Revenue + PageViews charts ── */}
      <div className="g2" style={{ marginBottom:14 }}>
        {(() => {
          const revMax  = Math.max(...revenueChart.map(d => (d as any).revenue ?? 0), 1)
          const revYMax = Math.ceil(revMax * 1.2)
          return (
            <Card title={`💶 Приход — ${rl}`} subtitle={range === 1 ? 'по часове' : undefined}>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={revenueChart}>
                  <defs>
                    <linearGradient id="rg-an" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} interval={range === 1 ? 1 : getXAxisInterval(range)} />
                  <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} width={48} domain={[0, revYMax]} />
                  <Tooltip formatter={(v: number) => [formatPrice(v), 'Приход']} contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2.5} fill="url(#rg-an)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )
        })()}

        {pageViewsChart.length > 0 ? (() => {
          const pvMax  = Math.max(...pageViewsChart.map(d => (d as any).count ?? 0), 1)
          const pvYMax = Math.ceil(pvMax * 1.2)
          return (
            <Card title={`👁️ Посещения — ${rl}`} subtitle={range === 1 ? 'по часове' : 'от базата данни'}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={pageViewsChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} interval={range === 1 ? 1 : getXAxisInterval(range)} />
                  <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} width={Math.max(30, String(pvYMax).length * 8)} allowDecimals={false} domain={[0, pvYMax]} />
                  <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }} />
                  <Bar dataKey="count"  fill="#0ea5e9" name="Общо"     radius={[3,3,0,0]} maxBarSize={16} />
                  <Bar dataKey="unique" fill="#86efac" name="Уникални" radius={[3,3,0,0]} maxBarSize={16} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize:11 }} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )
        })() : (
          <Card title={`📊 Поръчки по статус — ${rl}`}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={statusPie} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                  {statusPie.map((e, i) => <Cell key={i} fill={e.color || COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* ── PageViews обобщение + Поръчки по статус ── */}
      <div className="g2" style={{ marginBottom:14 }}>
        {pageViews ? (
          <Card title="👁️ Посещения — обобщение">
            <div className="pv-summary-grid">
              {([
                { label:'Днес',   value:pageViews.today,  unique:pageViews.todayUnique,  color:'#6366f1', active:range===1  },
                { label:'7 дни',  value:pageViews.last7,  unique:pageViews.last7Unique,  color:'#0ea5e9', active:range===7  },
                { label:'30 дни', value:pageViews.last30, unique:pageViews.last30Unique, color:'#8b5cf6', active:range===30 },
                { label:'90 дни', value:pageViews.last90  ?? pageViews.total, unique:pageViews.last90Unique ?? pageViews.unique, color:'#f59e0b', active:range===90 },
                { label:'Всичко', value:pageViews.total   ?? pageViews.last30, unique:pageViews.unique ?? pageViews.last30Unique, color:'#111', active:range==='all' },
              ]).map(r => (
                <div key={r.label} style={{
                  borderRadius:10, padding:'9px 10px', transition:'all .2s',
                  background: r.active ? '#f0fdf4' : '#f9fafb',
                  border: r.active ? `2px solid ${r.color}` : '1px solid #f0f0f0',
                  minWidth:0,
                }}>
                  <div style={{ fontSize:9, color:'#94a3b8', fontWeight:700, marginBottom:3, textTransform:'uppercase' }}>{r.label}</div>
                  <div style={{ fontSize:17, fontWeight:800, color:r.color, lineHeight:1.1 }}>{(r.value ?? 0).toLocaleString()}</div>
                  <div style={{ fontSize:9, color:'#94a3b8', marginTop:2 }}>{(r.unique ?? 0).toLocaleString()} уник.</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
                <span style={{ color:'#374151', fontWeight:600 }}>📱 Мобилни посещения</span>
                <span style={{ fontWeight:700 }}>{pageViews.mobilePercent}%</span>
              </div>
              <div style={{ height:6, background:'#f3f4f6', borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pageViews.mobilePercent}%`, background:'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius:99, transition:'width .6s ease' }} />
              </div>
            </div>
          </Card>
        ) : (
          <Card title="📊 Обобщение">
            <div style={{ padding:'32px 0', textAlign:'center', color:'#94a3b8', fontSize:13 }}>Няма данни за посещения</div>
          </Card>
        )}

        <Card title={`📊 Поръчки по статус — ${rl}`}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusPie} cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3} dataKey="value">
                {statusPie.map((e, i) => <Cell key={i} fill={e.color || COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:12 }} />
            </PieChart>
          </ResponsiveContainer>
          {statusPie.length === 0 && (
            <div style={{ textAlign:'center', color:'#94a3b8', fontSize:13, padding:'20px 0' }}>Няма поръчки за периода</div>
          )}
        </Card>
      </div>

      {/* ── Топ страници + Топ източници (по range) ── */}
      {pageViews && (() => {
        const pv = pageViews
        const activePages: { name: string; count: number }[] = range === 1
          ? (pv.topPagesToday    ?? pv.topPages ?? [])
          : range === 7
          ? (pv.topPages7        ?? pv.topPages ?? [])
          : range === 30
          ? (pv.topPages30       ?? pv.topPages ?? [])
          : (pv.topPages ?? [])

        const activeRefs: { name: string; count: number }[] = range === 1
          ? (pv.topReferrersToday ?? pv.topReferrers ?? [])
          : range === 7
          ? (pv.topReferrers7     ?? pv.topReferrers ?? [])
          : range === 30
          ? (pv.topReferrers30    ?? pv.topReferrers ?? [])
          : (pv.topReferrers ?? [])

        const filteredPages = activePages
          .filter(p => !p.name.startsWith('/tr/') && !p.name.includes('/tr/2/'))
          .slice(0, 10)
        const maxPageCount = filteredPages[0]?.count || 1
        const maxRefCount  = activeRefs[0]?.count || 1

        return (
          <div className="g2" style={{ marginBottom:14 }}>
            <Card title={`📄 Топ страници (${rl})`} noPad>
              <div style={{ padding:'4px 0' }}>
                {filteredPages.map((p, i) => {
                  const dn = p.name.length > 40 ? p.name.slice(0, 37) + '…' : p.name
                  return (
                    <div key={p.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 16px', borderBottom:'1px solid #f5f5f5', fontSize:12 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, minWidth:0, flex:1 }}>
                        <span style={{ width:18, height:18, background:'#f3f4f6', borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:'#6b7280', flexShrink:0 }}>{i+1}</span>
                        <span title={p.name} style={{ color:'#374151', fontFamily:'monospace', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{dn}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:7, flexShrink:0, marginLeft:8 }}>
                        <div style={{ width:52, height:4, background:'#f3f4f6', borderRadius:99 }}>
                          <div style={{ height:'100%', width:`${(p.count/maxPageCount)*100}%`, background:'#16a34a', borderRadius:99 }} />
                        </div>
                        <span style={{ fontWeight:700, color:'#111', minWidth:26, textAlign:'right' }}>{p.count}</span>
                      </div>
                    </div>
                  )
                })}
                {filteredPages.length === 0 && (
                  <div style={{ padding:'24px 0', textAlign:'center', color:'#94a3b8', fontSize:13 }}>Няма данни за периода</div>
                )}
              </div>
            </Card>

            <Card title={`🌐 Топ източници (${rl})`} noPad>
              <div style={{ padding:'4px 0' }}>
                {activeRefs.map((r, i) => (
                  <div key={r.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 16px', borderBottom:'1px solid #f5f5f5', fontSize:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                      <span style={{ width:18, height:18, background:'#f3f4f6', borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:'#6b7280', flexShrink:0 }}>{i+1}</span>
                      <span style={{ color:'#374151' }}>{r.name}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                      <div style={{ width:52, height:4, background:'#f3f4f6', borderRadius:99 }}>
                        <div style={{ height:'100%', width:`${(r.count/maxRefCount)*100}%`, background:'#0ea5e9', borderRadius:99 }} />
                      </div>
                      <span style={{ fontWeight:700, minWidth:26, textAlign:'right' }}>{r.count}</span>
                    </div>
                  </div>
                ))}
                {activeRefs.length === 0 && (
                  <div style={{ padding:'24px 0', textAlign:'center', color:'#94a3b8', fontSize:13 }}>Няма данни за периода</div>
                )}
              </div>
            </Card>
          </div>
        )
      })()}

      <SectionDivider label="🔗 Affiliate Аналитика" color="#06b6d4" bg="#ecfeff" border="#a5f3fc" />

      {/* ── 5 Affiliate карти ── */}
      <div className="g5" style={{ marginBottom:14 }}>
        {([
          { label:'Днес',   value: affDetails?.today      ?? 0,                         color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0', match: range===1    },
          { label:'7 дни',  value: affDetails?.last7days  ?? 0,                         color:'#0ea5e9', bg:'#eff6ff', border:'#bfdbfe', match: range===7    },
          { label:'30 дни', value: affDetails?.last30days ?? analytics?.last30days ?? 0, color:'#06b6d4', bg:'#ecfeff', border:'#a5f3fc', match: range===30   },
          { label:'90 дни', value: aff90Clicks,                                         color:'#f59e0b', bg:'#fffbeb', border:'#fde68a', match: range===90   },
          { label:'Всичко', value: affDetails?.total      ?? analytics?.total ?? 0,     color:'#8b5cf6', bg:'#faf5ff', border:'#e9d5ff', match: range==='all' || (typeof range==='number' && range>=365) },
        ] as const).map(c => (
          <div key={c.label} style={{
            background: c.bg, borderRadius:12, padding:'14px 16px',
            border: c.match ? `2px solid ${c.color}` : `1px solid ${c.border}`,
            transition: 'border .2s', minWidth:0,
          }}>
            <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>{c.label}</div>
            <div style={{ fontSize:24, fontWeight:900, color:c.color, lineHeight:1 }}>{(c.value as number).toLocaleString()}</div>
            <div style={{ fontSize:10, color:'#94a3b8', marginTop:4 }}>кликове</div>
          </div>
        ))}
      </div>

      {/* ── Affiliate таблица + chart ── */}
      <div className="g2" style={{ marginBottom:14 }}>
        <Card title="🔗 Кликове по продукт">
          {affLoading ? (
            <div style={{ padding:'24px 0', textAlign:'center', color:'#94a3b8', fontSize:13 }}>⏳ Зарежда...</div>
          ) : affDetails ? (
            <AffiliateDetailsTable details={affDetails} range={range} />
          ) : (
            <div style={{ padding:'24px 0', textAlign:'center', color:'#94a3b8', fontSize:13 }}>Няма данни</div>
          )}
        </Card>

        {affDailyChart.length > 0 && affDailyChart.some(d => d.count > 0) ? (() => {
          const affMaxCount = Math.max(...affDailyChart.map(d => d.count), 1)
          const affYMax     = Math.ceil(affMaxCount * 1.2)
          return (
            <Card title={`📈 Affiliate кликове — ${rl}`} subtitle={range === 1 ? 'по часове' : undefined}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={affDailyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} interval={range === 1 ? 1 : getXAxisInterval(range)} />
                  <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} width={Math.max(30, String(affYMax).length * 8)} allowDecimals={false} domain={[0, affYMax]} />
                  <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }} formatter={(v:number) => [v.toLocaleString(), 'Кликове']} />
                  <Bar dataKey="count" fill="#06b6d4" radius={[4,4,0,0]} maxBarSize={range === 1 ? 28 : 20} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )
        })() : !affLoading ? (
          <Card title={`📊 Топ продукти по клик (${rl})`}>
            {affBar.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(160, affBar.length * 32)}>
                <BarChart data={affBar} layout="vertical" margin={{ left:8, right:16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15) || 10]} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize:10, fill:'#374151' }} tickLine={false} axisLine={false} width={110} />
                  <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }} formatter={(v:number) => [v, 'Кликове']} />
                  <Bar dataKey="value" radius={[0,5,5,0]}>
                    {affBar.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding:'24px 0', textAlign:'center', color:'#94a3b8', fontSize:13 }}>Няма данни за кликове</div>
            )}
          </Card>
        ) : null}
      </div>

      {/* ── Offer Аналитика ── */}
      {offerStats.withOffer.length > 0 && (
        <>
          <SectionDivider label="📣 Offer Аналитика" color="#7c3aed" bg="#f5f3ff" border="#ede9fe" />

          <div className="offer-row">
            {[
              { g:'linear-gradient(135deg,#7c3aed,#6d28d9)', e:'📣', t:'Оферти',      v:offerStats.withOffer.length, s:'поръчки с оферта' },
              { g:'linear-gradient(135deg,#dc2626,#b91c1c)', e:'⚡', t:'Post-purchase',v:offerStats.postPurch.length, s:'след поръчка' },
              { g:'linear-gradient(135deg,#7c3aed,#5b21b6)', e:'⬆️',t:'Ъпсел',        v:offerStats.upsell.length,    s:'в количката' },
              { g:'linear-gradient(135deg,#0369a1,#1d4ed8)', e:'🔀',t:'Крос-сел',     v:offerStats.crossSell.length, s:'допълващ продукт' },
            ].map(c => (
              <div key={c.t} className="offer-card" style={{ background:c.g }}>
                <div style={{ fontSize:10, opacity:.75, fontWeight:800, marginBottom:3, textTransform:'uppercase' }}>{c.e} {c.t}</div>
                <div style={{ fontSize:24, fontWeight:900 }}>{c.v}</div>
                <div style={{ fontSize:11, opacity:.7 }}>{c.s}</div>
              </div>
            ))}
            <div className="offer-card" style={{ background:'linear-gradient(135deg,#059669,#047857)' }}>
              <div style={{ fontSize:10, opacity:.75, fontWeight:800, marginBottom:3, textTransform:'uppercase' }}>💶 Приход оферти</div>
              <div style={{ fontSize:20, fontWeight:900 }}>{formatPrice(offerStats.offerRev)}</div>
              <div style={{ fontSize:11, opacity:.7 }}>{offerStats.revShare}% от общия</div>
            </div>
            {offerStats.ppExtraRev > 0 && (
              <div className="offer-card" style={{ background:'linear-gradient(135deg,#b91c1c,#991b1b)' }}>
                <div style={{ fontSize:10, opacity:.75, fontWeight:800, marginBottom:3, textTransform:'uppercase' }}>⚡ PP Extra приход</div>
                <div style={{ fontSize:20, fontWeight:900 }}>{formatPrice(offerStats.ppExtraRev)}</div>
                <div style={{ fontSize:11, opacity:.7 }}>само от PP добавки</div>
              </div>
            )}
            <div className="offer-card-light">
              <div style={{ fontSize:10, color:'#94a3b8', fontWeight:800, marginBottom:3, textTransform:'uppercase' }}>📊 Конверсия</div>
              <div style={{ fontSize:24, fontWeight:900, color:'#7c3aed' }}>{offerStats.offerRate}%</div>
              <div style={{ fontSize:11, color:'#6b7280' }}>от поръчките</div>
            </div>
          </div>

          <div className="g2" style={{ marginBottom:14 }}>
            <Card title={`📣 С оферта vs нормални (${rl})`}>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={offerStats.dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false} interval={getXAxisInterval(range)} />
                  <YAxis tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false} width={22} allowDecimals={false} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15) || 10]} />
                  <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }} />
                  <Bar dataKey="normal" name="Нормални" stackId="a" fill="#86efac" />
                  <Bar dataKey="offer"  name="С оферта" stackId="a" fill="#7c3aed" radius={[3,3,0,0]} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize:11 }} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {offerStats.typePie.length > 0 && (
              <Card title="🔀 По тип оферта">
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

          <Card title="💶 Приход с оферта vs без оферта">
            <div style={{ display:'flex', gap:20, alignItems:'center', flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:180 }}>
                <div style={{ height:28, background:'#f3f4f6', borderRadius:99, overflow:'hidden', display:'flex' }}>
                  <div style={{
                    width:`${offerStats.revShare}%`,
                    background:'linear-gradient(90deg,#7c3aed,#6d28d9)',
                    borderRadius: offerStats.revShare < 98 ? '99px 0 0 99px' : 99,
                    transition:'width .6s ease',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    {offerStats.revShare > 10 && <span style={{ fontSize:11, fontWeight:800, color:'#fff' }}>{offerStats.revShare}%</span>}
                  </div>
                  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#6b7280' }}>{100 - offerStats.revShare}%</span>
                  </div>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:7, fontSize:12 }}>
                  <span style={{ color:'#7c3aed', fontWeight:700 }}>● С оферта: {formatPrice(offerStats.offerRev)}</span>
                  <span style={{ color:'#6b7280' }}>● Без: {formatPrice(offerStats.noOfferRev)}</span>
                </div>
              </div>
              <div style={{ display:'flex', gap:24, flexShrink:0 }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:20, fontWeight:900, color:'#7c3aed' }}>
                    {formatPrice(offerStats.withOffer.length ? offerStats.offerRev / offerStats.withOffer.length : 0)}
                  </div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>Ср. AOV с оферта</div>
                </div>
                <div style={{ width:1, background:'#e5e7eb' }} />
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:20, fontWeight:900, color:'#16a34a' }}>
                    {formatPrice(offerStats.noOfferCount > 0 ? offerStats.noOfferRev / offerStats.noOfferCount : 0)}
                  </div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>Ср. AOV без оферта</div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      <div style={{ height:32 }} />
    </div>
  )
}
