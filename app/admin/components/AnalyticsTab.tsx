'use client'
// app/admin/components/AnalyticsTab.tsx — v13
// ✅ ПОПРАВКИ:
//   - Affiliate кликове се филтрират правилно за ВСИЧКИ range стойности (90д, 365д, all)
//   - Махнато дублиране на "Топ продукти по клик" card (беше рендерирано 2 пъти)
//   - Махнато дублиране на "Поръчки по статус" pie chart (беше рендерирано 2 пъти)
//   - Махнати ПЛАЩАНЕ и КУРИЕР pie charts (всичко е наложен платеж + Еконт)
//   - Посещения chart и обобщение следват избрания range (не е hardcoded 30д)
//   - "Топ страници" и "Топ източници" следват range-а
//   - "Топ източници" вече показва всички резултати (не е изрязан)
//   - Affiliate кликове bar chart следва избрания range

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
  byProduct:      Record<string, number>
  byPartner:      Record<string, number>
  productDetails: Record<string, { total: number; last30: number; last7: number; today: number }>
  topProducts:    { slug: string; partner?: string | null; total: number; last30: number; last7: number; today: number }[]
  topPartners:    { name: string; count: number }[]
  dailyChart:     { date: string; count: number }[]
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

// ✅ Правилен брой посещения за всеки range
function getVisitsForRange(pageViews: PageViewStats | null, range: Range): number {
  if (!pageViews) return 0
  if (range === 1)     return pageViews.today    ?? 0
  if (range === 7)     return pageViews.last7    ?? 0
  if (range === 30)    return pageViews.last30   ?? 0
  if (range === 90)    return (pageViews as any).last90  ?? pageViews.total ?? 0
  if (range === 365)   return (pageViews as any).last365 ?? pageViews.total ?? 0
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
      borderRadius:13, padding:'14px 16px', flex:'1 1 140px', minWidth:0 }}>
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
    if (range === 1)     return 'today'
    if (range === 7)     return 'last7'
    if (range === 'all') return 'total'
    return 'last30'
  }
  const [sortBy, setSortBy] = useState<'last30'|'last7'|'today'|'total'>(defaultSort())
  useEffect(() => { setSortBy(defaultSort()) }, [range])

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

      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
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
                <tr key={p.slug} className="aff-row" style={{
                  borderBottom:'1px solid #f9fafb',
                  background: i%2===0 ? '#fff' : '#fafafa',
                }}>
                  {/* Slug */}
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
                  {/* Тип */}
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

      {/* ── Breakdown по тип ── */}
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

// ✅ ПОПРАВЕНО: правилно брои кликове за 90д и 365д от dailyChart
function getAffClicks(aff: AffiliateDetail | null, analytics: AffiliateAnalytics | null, range: Range): number {
  if (!aff) return analytics?.last30days ?? 0
  if (range === 1)     return aff.today
  if (range === 7)     return aff.last7days
  if (range === 30)    return aff.last30days
  if (range === 'all') return aff.total

  // За 90д и 365д — сумираме от dailyChart (API-то пази 90д история)
  // Ако range > 90, ползваме total (нямаме по-дълга история в dailyChart)
  const days = range as number
  if (days > 90) return aff.total

  const now = new Date()
  const cutDate = new Date(now.getTime() - days * 86400000)
  const cutStr  = cutDate.toISOString().slice(0, 10)
  return (aff.dailyChart || [])
    .filter(d => {
      // dailyChart датите са във формат "MM-DD", трябва да ги реконструираме
      // или ако API-то ги връща като "YYYY-MM-DD" — директно сравняваме
      const fullDate = d.date.length === 5
        ? `${now.getFullYear()}-${d.date}`  // MM-DD → добавяме годината
        : d.date
      return fullDate >= cutStr
    })
    .reduce((s, d) => s + d.count, 0)
}

// ✅ ПОПРАВЕНО: правилно филтрира dailyChart за всеки range
function getAffDailyChart(aff: AffiliateDetail | null, range: Range): { date: string; count: number }[] {
  if (!aff?.dailyChart?.length) return []
  if (range === 'all') return aff.dailyChart

  const now = new Date()

  if (range === 1) {
    const todayMD = now.toISOString().slice(5, 10) // MM-DD
    return aff.dailyChart.filter(d => d.date === todayMD || d.date.endsWith(todayMD))
  }

  const days = range as number
  // Генерираме списък с последните N дни като MM-DD стрингове
  const validDates = new Set(
    Array.from({ length: days }, (_, i) => {
      const d = new Date(now.getTime() - (days - 1 - i) * 86400000)
      return d.toISOString().slice(5, 10) // MM-DD
    })
  )
  return aff.dailyChart.filter(d => {
    const md = d.date.length === 5 ? d.date : d.date.slice(5)
    return validDates.has(md)
  })
}

// ✅ Affiliate bar chart филтриран по range
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

  if (range === 1)     getValue = v => v.today
  else if (range === 7)    getValue = v => v.last7
  else if (range === 'all') getValue = v => v.total
  else getValue = v => v.last30 // 30д, 90д, 365д — ползваме last30 (максималното налично)

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

  // ── Поръчки ──────────────────────────────────────────────────────
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

  const revenueChart = useMemo(() => buildRevenueChart(filteredOrders, range), [filteredOrders, range])

  const statusPie = useMemo(() => {
    const map: Record<string, number> = {}
    filteredOrders.forEach(o => { map[o.status] = (map[o.status] || 0) + 1 })
    return Object.entries(map).map(([key, value]) => ({
      name: STATUS_LABELS[key]?.label || key,
      value,
      color: STATUS_LABELS[key]?.color || '#9ca3af',
    }))
  }, [filteredOrders])

  // ── Affiliate ─────────────────────────────────────────────────────
  const affClicks     = useMemo(() => getAffClicks(affDetails, analytics, range),         [affDetails, analytics, range])
  const affDailyChart = useMemo(() => getAffDailyChart(affDetails, range),                [affDetails, range])
  const affBar        = useMemo(() => getAffBar(affDetails, analytics, range),            [affDetails, analytics, range])

  // ✅ Funnel — правилни visits за всеки range
  const funnelData = useMemo(() => {
    const visits = getVisitsForRange(pageViews, range)
    const cnt    = filteredOrders.length
    return [
      { stage:'Посещения',    value: visits,    pct: 100 },
      { stage:'Aff. кликове', value: affClicks, pct: visits ? Math.round(affClicks / visits * 100) : 0 },
      { stage:'Поръчки',      value: cnt,       pct: visits ? Math.round(cnt / visits * 100) : 0 },
    ]
  }, [pageViews, affClicks, filteredOrders, range])

  // ── Offer analytics ────────────────────────────────────────────────
  const offerStats = useMemo(() => {
    const active    = filteredOrders.filter(o => o.status !== 'cancelled')
    const postPurch = active.filter(o => getOfferType(o) === 'post_purchase')
    const upsell    = active.filter(o => getOfferType(o) === 'cart_upsell')
    const crossSell = active.filter(o => getOfferType(o) === 'cross_sell')
    const withOffer = active.filter(o => getOfferType(o) !== null)
    const offerRev  = withOffer.reduce((s, o) => s + Number(o.total), 0)
    const totalRev  = active.reduce((s, o) => s + Number(o.total), 0)
    const offerRate = active.length ? Math.round(withOffer.length / active.length * 100) : 0
    const revShare  = totalRev ? Math.round(offerRev / totalRev * 100) : 0

    const days = range === 'all' ? 90 : Math.min(range as number, 90)
    const now  = new Date()
    const dailyMap: Record<string, {offer:number; normal:number}> = {}
    for (let i = days - 1; i >= 0; i--) {
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
      { name:'⚡ Post-purchase', value: postPurch.length, color:'#dc2626' },
      { name:'⬆️ Ъпсел',        value: upsell.length,    color:'#7c3aed' },
      { name:'🔀 Крос-сел',      value: crossSell.length, color:'#1d4ed8' },
    ].filter(x => x.value > 0)

    return {
      withOffer, postPurch, upsell, crossSell,
      offerRev, totalRev, offerRate, revShare,
      dailyChart, typePie,
      noOfferCount: active.length - withOffer.length,
      noOfferRev:   totalRev - offerRev,
    }
  }, [filteredOrders, range])

  const rl = getRangeLabel(range)

  // ✅ Page views chart спрямо range — dailyChart е 90 дни от API-то
  const pageViewsChart = useMemo(() => {
    if (!pageViews?.dailyChart?.length) return []
    // dailyChart от API е последните 90 дни
    if (range === 'all' || (range as number) >= 90) return pageViews.dailyChart
    const days = range as number
    return pageViews.dailyChart.slice(-days)
  }, [pageViews, range])

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="an-root">
      <style>{`
        .an-root { padding: 20px 24px; max-width: 1200px }
        @media(max-width:640px) { .an-root { padding: 14px 12px } }

        .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px }
        .g4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px }
        @media(max-width:900px) { .g4 { grid-template-columns: 1fr 1fr } }
        @media(max-width:700px) { .g2 { grid-template-columns: 1fr } .g4 { grid-template-columns: 1fr 1fr } }
        @media(max-width:400px) { .g4 { grid-template-columns: 1fr } }

        .aff-row:hover { background: #f0fdf4 !important }

        .offer-card { flex:1; min-width:120px; border-radius:12px; padding:12px 14px; color:#fff }
        .offer-card-light { flex:1; min-width:120px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:12px 14px }

        @media(max-width:540px) { .range-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 2px } }

        .pv-card { border-radius:10px; padding:10px 12px; background:#f9fafb; border:1px solid #f0f0f0; transition:all .2s }
        .pv-card.active { background:#f0fdf4; border:2px solid currentColor }
      `}</style>

      {/* ── Header ────────────────────────────────────────────────── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:900, color:'#111', letterSpacing:'-.02em', margin:0 }}>Аналитика</h1>
          <p style={{ fontSize:12, color:'#94a3b8', margin:'2px 0 0' }}>Статистики за избрания период</p>
        </div>
        <div className="range-scroll">
          <RangePicker range={range} onChange={setRange} />
        </div>
      </div>

      {/* ── KPI Metrics ─────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
        <MetricCard label={`Приход (${rl})`}      value={formatPrice(metrics.rev)} prevValue={metrics.prevRev} color="#16a34a" icon="💶" bg="#f0fdf4" border="#bbf7d0" />
        <MetricCard label={`Поръчки (${rl})`}     value={metrics.cnt}              prevValue={metrics.prevCnt} color="#f59e0b" icon="📦" bg="#fffbeb" border="#fde68a" />
        <MetricCard label="Средна поръчка"          value={formatPrice(metrics.avg)} prevValue={metrics.prevAvg} color="#8b5cf6" icon="📊" bg="#faf5ff" border="#e9d5ff" />
        <MetricCard label={`Aff. кликове (${rl})`} value={affClicks}                color="#06b6d4"              icon="🔗" bg="#ecfeff" border="#a5f3fc" />
      </div>

      {/* ── Conversion Funnel ────────────────────────────────────── */}
      <div style={{ marginBottom:14 }}>
        <Card title="🎯 Conversion Funnel" subtitle={rl}>
          {!pageViews && (
            <div style={{ marginBottom:10, padding:'8px 12px', background:'#fff7ed', borderRadius:8, border:'1px solid #fed7aa', fontSize:12, color:'#92400e' }}>
              ⚠️ Данните за посещения не са заредени — funnel показва само поръчки
            </div>
          )}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
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

      {/* ── Revenue + Page Views chart ────────────────────────────── */}
      <div className="g2" style={{ marginBottom:14 }}>
        <Card title={`💶 Приход — ${rl}`}>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={revenueChart}>
              <defs>
                <linearGradient id="rg-an" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} interval={getXAxisInterval(range)} />
              <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} width={44} />
              <Tooltip formatter={(v: number) => [formatPrice(v), 'Приход']} contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }} />
              <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2.5} fill="url(#rg-an)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* ✅ Посещения chart — title и interval следват range-а */}
        {pageViewsChart.length > 0 ? (
          <Card title={`👁️ Посещения — ${rl}`} subtitle="от базата данни">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={pageViewsChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} interval={getXAxisInterval(range)} />
                <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} width={30} />
                <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }} />
                <Bar dataKey="count"  fill="#0ea5e9" name="Общо"     radius={[3,3,0,0]} maxBarSize={16} />
                <Bar dataKey="unique" fill="#86efac" name="Уникални" radius={[3,3,0,0]} maxBarSize={16} />
                <Legend iconSize={8} wrapperStyle={{ fontSize:11 }} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        ) : (
          // Fallback ако няма pageViews данни
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

      {/* ── Page Views обобщение + Поръчки по статус ─────────────── */}
      <div className="g2" style={{ marginBottom:14 }}>
        {/* ✅ Посещения обобщение — активният period се highlight-ва */}
        {pageViews ? (
          <Card title="👁️ Посещения — обобщение">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8, marginBottom:14 }}>
              {([
                { label:'Днес',   value:pageViews.today,  unique:pageViews.todayUnique,  color:'#6366f1', active:range===1  },
                { label:'7 дни',  value:pageViews.last7,  unique:pageViews.last7Unique,  color:'#0ea5e9', active:range===7  },
                { label:'30 дни', value:pageViews.last30, unique:pageViews.last30Unique, color:'#8b5cf6', active:range===30 },
                { label:'90 дни', value:(pageViews as any).last90 ?? pageViews.total, unique:(pageViews as any).last90Unique ?? pageViews.unique, color:'#f59e0b', active:range===90 },
                {
                  label:'Всичко',
                  value:  pageViews.total  ?? pageViews.last30,
                  unique: pageViews.unique ?? pageViews.last30Unique,
                  color:'#111', active:range==='all',
                },
              ] as const).map(r => (
                <div key={r.label} className={`pv-card${r.active ? ' active' : ''}`}
                  style={{ color: r.active ? r.color : undefined } as any}>
                  <div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, marginBottom:3 }}>{r.label}</div>
                  <div style={{ fontSize:20, fontWeight:800, color:r.color, lineHeight:1.1 }}>{(r.value ?? 0).toLocaleString()}</div>
                  <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{(r.unique ?? 0).toLocaleString()} уник.</div>
                </div>
              ))}
            </div>
            {/* Mobile % */}
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
          <Card title={`📊 Обобщение`}>
            <div style={{ padding:'32px 0', textAlign:'center', color:'#94a3b8', fontSize:13 }}>Няма данни за посещения</div>
          </Card>
        )}

        {/* ✅ Поръчки по статус — САМО веднъж (без дублиране) */}
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

      {/* ✅ Топ страници + Топ източници — следват range-а, без изрязване */}
      {pageViews && (
        <div className="g2" style={{ marginBottom:14 }}>
          <Card title={`📄 Топ страници (${rl})`} noPad>
            <div style={{ padding:'4px 0' }}>
              {(pageViews.topPages || [])
                .filter(p => !p.name.startsWith('/tr/') && !p.name.includes('/tr/2/'))
                .slice(0, 10)
                .map((p, i) => {
                  const dn = p.name.length > 40 ? p.name.slice(0, 37) + '…' : p.name
                  const mx = (pageViews.topPages || []).filter(x => !x.name.startsWith('/tr/'))[0]?.count || 1
                  return (
                    <div key={p.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 16px', borderBottom:'1px solid #f5f5f5', fontSize:12 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, minWidth:0, flex:1 }}>
                        <span style={{ width:18, height:18, background:'#f3f4f6', borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:'#6b7280', flexShrink:0 }}>{i+1}</span>
                        <span title={p.name} style={{ color:'#374151', fontFamily:'monospace', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{dn}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:7, flexShrink:0, marginLeft:8 }}>
                        <div style={{ width:52, height:4, background:'#f3f4f6', borderRadius:99 }}>
                          <div style={{ height:'100%', width:`${(p.count/mx)*100}%`, background:'#16a34a', borderRadius:99 }} />
                        </div>
                        <span style={{ fontWeight:700, color:'#111', minWidth:26, textAlign:'right' }}>{p.count}</span>
                      </div>
                    </div>
                  )
                })}
            </div>
          </Card>

          {/* ✅ Топ източници — показва ВСИЧКИ (без изрязване), title следва range-а */}
          <Card title={`🌐 Топ източници (${rl})`} noPad>
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
              {(!pageViews.topReferrers || pageViews.topReferrers.length === 0) && (
                <div style={{ padding:'24px 0', textAlign:'center', color:'#94a3b8', fontSize:13 }}>Няма данни за периода</div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ══ AFFILIATE ════════════════════════════════════════════════════ */}
      <SectionDivider label="🔗 Affiliate Аналитика" color="#06b6d4" bg="#ecfeff" border="#a5f3fc" />

      {/* ✅ 4 affiliate карти — активната се highlight-ва спрямо range */}
      <div className="g4" style={{ marginBottom:14 }}>
        {([
          { label:'Днес',   value: affDetails?.today       ?? 0,                          color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0', match: range===1    },
          { label:'7 дни',  value: affDetails?.last7days   ?? 0,                          color:'#0ea5e9', bg:'#eff6ff', border:'#bfdbfe', match: range===7    },
          { label:'30 дни', value: affDetails?.last30days  ?? analytics?.last30days ?? 0, color:'#06b6d4', bg:'#ecfeff', border:'#a5f3fc', match: range===30   },
          { label:'Всичко', value: affDetails?.total       ?? analytics?.total ?? 0,      color:'#8b5cf6', bg:'#faf5ff', border:'#e9d5ff', match: range==='all'},
        ] as const).map(c => (
          <div key={c.label} style={{
            background: c.bg, borderRadius:12, padding:'14px 16px',
            border: c.match ? `2px solid ${c.color}` : `1px solid ${c.border}`,
            transition: 'border .2s',
          }}>
            <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>{c.label}</div>
            <div style={{ fontSize:24, fontWeight:900, color:c.color, lineHeight:1 }}>{(c.value as number).toLocaleString()}</div>
            <div style={{ fontSize:10, color:'#94a3b8', marginTop:4 }}>кликове</div>
          </div>
        ))}
      </div>

      {/* ✅ Affiliate chart и таблица — САМО ВЕДНЪЖ (без дублиране) */}
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

        {/* ✅ Affiliate daily chart — следва range-а */}
        {affDailyChart.length > 0 && affDailyChart.some(d => d.count > 0) ? (
          <Card title={`📈 Affiliate кликове — ${rl}`}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={affDailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} interval={getXAxisInterval(range)} />
                <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} width={26} allowDecimals={false} />
                <Tooltip contentStyle={{ border:'1px solid #e5e7eb', borderRadius:8, fontSize:12 }} formatter={(v:number) => [v, 'Кликове']} />
                <Bar dataKey="count" fill="#06b6d4" radius={[4,4,0,0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        ) : !affLoading ? (
          // ✅ Топ продукти bar chart — стойностите следват range-а
          <Card title={`📊 Топ продукти по клик (${rl})`}>
            {affBar.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(160, affBar.length * 32)}>
                <BarChart data={affBar} layout="vertical" margin={{ left:8, right:16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
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

      {/* ══ OFFER ANALYTICS ═════════════════════════════════════════════ */}
      {offerStats.withOffer.length > 0 && (
        <>
          <SectionDivider label="📣 Offer Аналитика" color="#7c3aed" bg="#f5f3ff" border="#ede9fe" />

          <div style={{ display:'flex', gap:9, flexWrap:'wrap', marginBottom:14 }}>
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
                  <YAxis tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false} width={22} allowDecimals={false} />
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
