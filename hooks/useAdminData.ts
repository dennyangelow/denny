'use client'
// hooks/useAdminData.ts — v12
// ✅ ПОПРАВКИ v12 (спрямо v11):
//   - toBgDateStr() добавена — всички дати в hook-а вече са БГ timezone, не UTC
//   - todayRevenue: сравнява БГ дати (не UTC .toISOString().slice(0,10))
//   - weekRevenue: сравнява БГ дати (не UTC timestamp - 7*86400000)
//   - last30Orders: сравнява БГ дати
//   - Автоматичен рефреш на всеки 2 минути (без unmount на табовете)

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Order, Lead, AffiliateAnalytics } from '@/lib/supabase'

// ── БГ timezone helper (дублиран от rangeUtils за независимост на hook-а) ─────
function toBgDateStr(d?: Date): string {
  return (d ?? new Date()).toLocaleDateString('en-CA', { timeZone: 'Europe/Sofia' })
}
function bgDateNDaysAgo(now: Date, days: number): string {
  const todayBg    = toBgDateStr(now)
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

export interface PageViewStats {
  total:         number
  unique:        number
  today:         number
  todayUnique:   number
  last7:         number
  last7Unique:   number
  last30:        number
  last30Unique:  number
  last90?:       number
  last90Unique?: number
  mobilePercent: number
  dailyChart:    { date: string; count: number; unique?: number }[]
  hourlyChart?:  { hour: number; count: number; unique: number }[]
  topReferrers:  { name: string; count: number }[]
  topUtm:        { name: string; count: number }[]
  topCampaigns:  { name: string; count: number }[]
  topPages:      { name: string; count: number }[]
}

export function useAdminData() {
  const [orders, setOrders]       = useState<Order[]>([])
  const [leads, setLeads]         = useState<Lead[]>([])
  const [analytics, setAnalytics] = useState<AffiliateAnalytics | null>(null)
  const [pageViews, setPageViews] = useState<PageViewStats | null>(null)
  const [stats, setStats]         = useState<AdminStats>({
    totalOrders: 0, revenue: 0, leads: 0,
    newOrders: 0, todayRevenue: 0, weekRevenue: 0,
    pendingPayments: 0, avgOrderValue: 0, conversionRate: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const initialFetchDone      = useRef(false)

  const fetchAll = useCallback(async () => {
    if (!initialFetchDone.current) setLoading(true)
    setError(null)
    try {
      const [ordRes, leadRes, affRes, pvRes] = await Promise.allSettled([
        fetch('/api/orders?limit=1000').then(r => {
          if (!r.ok) throw new Error(`orders ${r.status}`)
          return r.json()
        }),
        fetch('/api/leads?limit=1000').then(r => {
          if (!r.ok) throw new Error(`leads ${r.status}`)
          return r.json()
        }),
        fetch('/api/analytics/affiliate-click').then(r => r.ok ? r.json() : null),
        fetch('/api/analytics/page-view').then(r => {
          if (!r.ok) {
            console.warn('[useAdminData] page-view status:', r.status)
            return null
          }
          return r.json()
        }),
      ])

      const orderList: Order[] = ordRes.status  === 'fulfilled' ? (ordRes.value?.orders  || []) : []
      const leadList:  Lead[]  = leadRes.status === 'fulfilled' ? (leadRes.value?.leads   || []) : []
      const affData            = affRes.status  === 'fulfilled' ? affRes.value  : null
      const pvData             = pvRes.status   === 'fulfilled' ? pvRes.value   : null

      if (ordRes.status  === 'rejected') console.error('[useAdminData] orders error:',    ordRes.reason)
      if (leadRes.status === 'rejected') console.error('[useAdminData] leads error:',     leadRes.reason)
      if (pvRes.status   === 'rejected') console.error('[useAdminData] page-view error:', pvRes.reason)

      if (ordRes.status === 'rejected' && leadRes.status === 'rejected') {
        setError('Грешка при зареждане. Провери Supabase env vars в Vercel.')
      }

      setOrders(orderList)
      setLeads(leadList)
      setAnalytics(affData)
      setPageViews(pvData)

      // ✅ v12: ВСИЧКИ дати са в БГ timezone — нулиране в 00:00 БГ, не UTC!
      const now       = new Date()
      const todayBg   = toBgDateStr(now)                      // "2026-04-19"
      const weekAgoBg = bgDateNDaysAgo(now, 7)                // "2026-04-12"
      const day30Bg   = bgDateNDaysAgo(now, 30)               // "2026-03-20"

      const active  = orderList.filter(o => o.status !== 'cancelled')
      const revenue = active.reduce((s, o) => s + Number(o.total), 0)

      // ✅ Конвертираме created_at на всяка поръчка в БГ дата за сравнение
      const activeWithBgDate = active.map(o => ({
        ...o,
        bgDate: toBgDateStr(new Date(o.created_at)),
      }))

      const todayRevenue = activeWithBgDate
        .filter(o => o.bgDate === todayBg)
        .reduce((s, o) => s + Number(o.total), 0)

      const weekRevenue = activeWithBgDate
        .filter(o => o.bgDate >= weekAgoBg)
        .reduce((s, o) => s + Number(o.total), 0)

      // ✅ last30Orders с БГ дата за конверсия
      const last30Orders = orderList.filter(o =>
        toBgDateStr(new Date(o.created_at)) >= day30Bg
      )

      setStats({
        totalOrders:     orderList.length,
        revenue,
        leads:           leadList.length,
        newOrders:       orderList.filter(o => o.status === 'new').length,
        todayRevenue,   // ✅ БГ дата
        weekRevenue,    // ✅ БГ дата
        pendingPayments: orderList.filter(o => o.payment_status === 'pending' && o.status !== 'cancelled').length,
        avgOrderValue:   active.length ? revenue / active.length : 0,
        conversionRate:  pvData?.last30 && last30Orders.length
          ? Math.min(99, (last30Orders.length / pvData.last30) * 100)
          : 0,
      })
    } catch (err: unknown) {
      console.error('[useAdminData] fetchAll error:', err)
      setError(`Грешка: ${err instanceof Error ? err.message : 'Неизвестна'}`)
    } finally {
      setLoading(false)
      initialFetchDone.current = true
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ✅ v12: Автоматичен рефреш на всеки 2 минути — без setLoading(true), без unmount
  useEffect(() => {
    const interval = setInterval(() => {
      if (initialFetchDone.current) fetchAll()
    }, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const updateOrderStatus = useCallback(async (orderId: string, status: string) => {
    const res = await fetch(`/api/orders/${orderId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    })
    if (!res.ok) throw new Error('Update failed')
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status: status as Order['status'] } : o
    ))
  }, [])

  const updatePaymentStatus = useCallback(async (orderId: string, payment_status: string) => {
    const res = await fetch(`/api/orders/${orderId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ payment_status }),
    })
    if (!res.ok) throw new Error('Update failed')
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, payment_status: payment_status as Order['payment_status'] } : o
    ))
  }, [])

  return {
    orders, leads, analytics, pageViews, stats,
    loading, error,
    fetchAll, setOrders,
    updateOrderStatus, updatePaymentStatus,
  }
}
