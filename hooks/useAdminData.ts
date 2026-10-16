'use client'
// hooks/useAdminData.ts — v19
// ✅ v19 спрямо v17 (+ включва v18):
//   1. СТАТИСТИКИТЕ СЕ СМЯТАТ ОТ ПОРЪЧКИТЕ В ПАМЕТТА (useMemo), а не веднъж при зареждане.
//      Преди: след изтриване/смяна на статус на поръчка (OrdersTab → setOrders) приход, брой
//      поръчки и значката "нови" в менюто оставаха стари до следващия рефреш (до 2 мин).
//   2. НЕ СЕ ЗАНУЛЯВАТ ДАННИ ПРИ ГРЕШКА. Преди един неуспешен рефреш (интернет, 500) слагаше
//      поръчките на [] → таблото внезапно показваше 0. Сега при неуспех остава последното
//      добро състояние и се показва предупреждение.
//   3. Без застъпващи се заявки (интервал + "Обнови" едновременно) и без setState след unmount.
//   4. Авто-рефрешът спира, когато табът е скрит, и се догонва при връщане в него.
//   5. Leads (над 2 500 реда, 6 заявки) се теглят при зареждане и после на 10 мин, не на 2 мин.
//   6. Периодите са точно 7/30 дни ВКЛЮЧИТЕЛНО днес (бяха 8/31) — както rangeUtils v5.
//   7. Конверсията брои само неотказани поръчки (както Dashboard/Analytics).
//   8. Нови полета (добавени, нищо не е махнато): warnings, lastUpdated.
//   9. Бързо форматиране на дати (един Intl.DateTimeFormat вместо toLocaleDateString на всеки ред).
//   fetchAll остава без аргументи — page.tsx го подава директно на onClick (получава event).
//
// ✅ v17: PageViewStats.last365Unique · v16: пагинирани поръчки · v15: topPages90/365

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { Order, Lead, AffiliateAnalytics } from '@/lib/supabase'

// ── БГ timezone helpers ──────────────────────────────────────────────────────
const bgFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sofia' })   // → yyyy-mm-dd
function toBgDateStr(d?: Date): string {
  return bgFmt.format(d ?? new Date())
}
function bgDateNDaysAgo(now: Date, days: number): string {
  const todayBg     = toBgDateStr(now)
  const utcMidnight = new Date(todayBg + 'T00:00:00Z')
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() - days)
  return toBgDateStr(utcMidnight)
}

export interface AdminStats {
  totalOrders:     number
  revenue:         number
  leads:           number
  newOrders:       number
  todayRevenue:    number
  weekRevenue:     number
  pendingPayments: number
  avgOrderValue:   number
  conversionRate:  number
}

// ── Пълен PageViewStats тип — съвпада с отговора на page_view_stats() ────────
export interface PageViewStats {
  // Броячи
  total:          number
  last30:         number
  last7:          number
  today:          number
  last90:         number

  // Уникални посетители
  unique:         number
  todayUnique:    number
  last7Unique:    number
  last30Unique:   number
  last90Unique:   number

  // Мобилни
  mobilePercent:  number

  // Chart данни
  dailyChart:  { date: string; count: number; unique?: number }[]
  hourlyChart?: { hour: number; count: number; unique: number }[]

  // Топ статистики — default (all данни)
  topPages:     { name: string; count: number }[]
  topReferrers: { name: string; count: number }[]

  // Топ статистики по период
  topPages90?:         { name: string; count: number }[]
  topReferrers90?:     { name: string; count: number }[]
  topPages365?:        { name: string; count: number }[]
  topReferrers365?:    { name: string; count: number }[]
  topPages30?:         { name: string; count: number }[]
  topReferrers30?:     { name: string; count: number }[]
  topPages7?:          { name: string; count: number }[]
  topReferrers7?:      { name: string; count: number }[]
  topPagesToday?:      { name: string; count: number }[]
  topReferrersToday?:  { name: string; count: number }[]

  // 365д
  last365?: number
  last365Unique?: number

  // UTM данни
  topUtm?:       { name: string; count: number }[]
  topCampaigns?: { name: string; count: number }[]
}

// ── Помощни заявки ───────────────────────────────────────────────────────────
// Хвърля грешка със СЪРВЪРНОТО съобщение (напр. "функцията page_view_stats липсва"),
// за да се вижда истинската причина, а не само "null".
async function getJson<T>(url: string, label: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) {
    let detail = ''
    try { const e = await r.json(); detail = e?.detail || e?.error || '' } catch {}
    throw new Error(`${label}: ${r.status}${detail ? ' — ' + detail : ''}`)
  }
  return r.json() as Promise<T>
}

// Зарежда ВСИЧКИ leads (Supabase връща най-много 1000 реда на заявка → пагинация).
async function fetchAllLeads(): Promise<Lead[]> {
  const PAGE_SIZE = 500
  let all: Lead[] = []
  for (let page = 1; page <= 20; page++) {           // safety: до 10 000 leads
    const data = await getJson<{ leads?: Lead[]; total?: number }>(`/api/leads?limit=${PAGE_SIZE}&page=${page}`, 'leads')
    const batch = data.leads || []
    all = all.concat(batch)
    if (batch.length < PAGE_SIZE) break
    if (data.total != null && all.length >= data.total) break
  }
  return all
}

// Зарежда ВСИЧКИ поръчки (route-ът кепва limit на 1000 → пагинация).
async function fetchAllOrders(): Promise<Order[]> {
  const PAGE_SIZE = 1000
  let all: Order[] = []
  for (let page = 1; page <= 50; page++) {           // safety: до 50 000 поръчки
    const data = await getJson<{ orders?: Order[]; total?: number }>(`/api/orders?limit=${PAGE_SIZE}&page=${page}`, 'orders')
    const batch = data.orders || []
    all = all.concat(batch)
    if (batch.length < PAGE_SIZE) break
    if (data.total != null && all.length >= data.total) break
  }
  return all
}

// ── Статистики, изчислени от текущите данни ──────────────────────────────────
export function computeAdminStats(orders: Order[], leads: Lead[], pv: PageViewStats | null): AdminStats {
  const now       = new Date()
  const todayBg   = toBgDateStr(now)
  const weekAgoBg = bgDateNDaysAgo(now, 6)    // 7 дни включително днес
  const day30Bg   = bgDateNDaysAgo(now, 29)   // 30 дни включително днес

  let revenue = 0, todayRevenue = 0, weekRevenue = 0
  let active = 0, activeLast30 = 0, newOrders = 0, pendingPayments = 0

  for (const o of orders) {
    if (o.status === 'new') newOrders++
    if (o.status === 'cancelled') continue
    const total = Number(o.total) || 0
    const day   = toBgDateStr(new Date(o.created_at))
    active++
    revenue += total
    if (day === todayBg)  todayRevenue += total
    if (day >= weekAgoBg) weekRevenue  += total
    if (day >= day30Bg)   activeLast30++
    if (o.payment_status === 'pending') pendingPayments++
  }

  return {
    totalOrders:     orders.length,
    revenue,
    leads:           leads.length,
    newOrders,
    todayRevenue,
    weekRevenue,
    pendingPayments,
    avgOrderValue:   active ? revenue / active : 0,
    // Уникални посетители (не прегледи) в знаменателя — иначе човек, разгледал 5 страници, се брои 5 пъти.
    conversionRate:  pv?.last30Unique && activeLast30
      ? Math.min(99, (activeLast30 / pv.last30Unique) * 100)
      : 0,
  }
}

const REFRESH_MS       = 2 * 60 * 1000    // поръчки / посещения / кликове
const LEADS_REFRESH_MS = 10 * 60 * 1000   // leads са тежки (6+ заявки) → по-рядко

export function useAdminData() {
  const [orders, setOrders]       = useState<Order[]>([])
  const [leads, setLeads]         = useState<Lead[]>([])
  const [analytics, setAnalytics] = useState<AffiliateAnalytics | null>(null)
  const [pageViews, setPageViews] = useState<PageViewStats | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [warnings, setWarnings]   = useState<string[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const mounted          = useRef(true)
  const inFlight         = useRef(false)
  const initialFetchDone = useRef(false)
  const lastFetchAt      = useRef(0)
  const lastLeadsAt      = useRef(0)

  // ✅ Статистиките следват състоянието веднага (изтриване/смяна на статус → без чакане на рефреш)
  const stats = useMemo(() => computeAdminStats(orders, leads, pageViews), [orders, leads, pageViews])

  const load = useCallback(async (withLeads: boolean) => {
    if (inFlight.current) return                      // не застъпваме заявки
    inFlight.current = true
    if (!initialFetchDone.current) setLoading(true)
    try {
      const [ordRes, leadRes, affRes, pvRes] = await Promise.allSettled([
        fetchAllOrders(),
        withLeads ? fetchAllLeads() : Promise.resolve(null),
        getJson<AffiliateAnalytics>('/api/analytics/affiliate-click', 'афилиейт кликове'),
        getJson<PageViewStats>('/api/analytics/page-view', 'посещения'),
      ])
      if (!mounted.current) return

      const warn: string[] = []

      // Само успешните резултати заменят състоянието; при грешка пазим последното добро.
      if (ordRes.status === 'fulfilled') {
        setOrders(ordRes.value)
        setError(null)
      } else {
        console.error('[useAdminData] orders error:', ordRes.reason)
        setError(`Поръчките не се заредиха (${ordRes.reason instanceof Error ? ordRes.reason.message : 'грешка'}).` +
                 (initialFetchDone.current ? ' Показани са последните заредени данни.' : ' Провери Supabase env vars в Vercel.'))
      }

      if (withLeads) {
        if (leadRes.status === 'fulfilled' && leadRes.value) { setLeads(leadRes.value); lastLeadsAt.current = Date.now() }
        else if (leadRes.status === 'rejected') { console.error('[useAdminData] leads error:', leadRes.reason); warn.push(String(leadRes.reason?.message || 'leads')) }
      }

      if (affRes.status === 'fulfilled') setAnalytics(affRes.value)
      else { console.warn('[useAdminData] affiliate:', affRes.reason); warn.push(String(affRes.reason?.message || 'афилиейт кликове')) }

      if (pvRes.status === 'fulfilled') setPageViews(pvRes.value)
      else { console.warn('[useAdminData] page-view:', pvRes.reason); warn.push(String(pvRes.reason?.message || 'посещения')) }

      setWarnings(warn)
      setLastUpdated(new Date())
      lastFetchAt.current = Date.now()
    } catch (err: unknown) {
      console.error('[useAdminData] fetchAll error:', err)
      if (mounted.current) setError(`Грешка: ${err instanceof Error ? err.message : 'Неизвестна'}`)
    } finally {
      inFlight.current = false
      if (mounted.current) setLoading(false)
      initialFetchDone.current = true
    }
  }, [])

  // Без аргументи — page.tsx го подава директно на onClick/onRefresh (идва event, който игнорираме)
  const fetchAll = useCallback(() => load(true), [load])

  useEffect(() => {
    mounted.current = true
    load(true)

    // Авто-рефреш: само при видим таб; leads — по-рядко.
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      if (!initialFetchDone.current) return
      load(Date.now() - lastLeadsAt.current >= LEADS_REFRESH_MS)
    }
    const id = setInterval(tick, REFRESH_MS)
    // Връщане в таба след дълго отсъствие → веднага свежи данни
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetchAt.current >= REFRESH_MS) tick()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      mounted.current = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const patchOrder = useCallback(async (orderId: string, body: Record<string, string>) => {
    const res = await fetch(`/api/orders/${orderId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    if (!res.ok) {
      let detail = ''
      try { detail = (await res.json())?.error || '' } catch {}
      throw new Error(detail || 'Update failed')
    }
  }, [])

  const updateOrderStatus = useCallback(async (orderId: string, status: string) => {
    await patchOrder(orderId, { status })
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status: status as Order['status'] } : o
    ))
  }, [patchOrder])

  const updatePaymentStatus = useCallback(async (orderId: string, payment_status: string) => {
    await patchOrder(orderId, { payment_status })
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, payment_status: payment_status as Order['payment_status'] } : o
    ))
  }, [patchOrder])

  return {
    orders, leads, analytics, pageViews, stats,
    loading, error, warnings, lastUpdated,
    fetchAll, setOrders,
    updateOrderStatus, updatePaymentStatus,
  }
}
