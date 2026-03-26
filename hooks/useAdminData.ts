'use client'
// hooks/useAdminData.ts — v7 extended with page views

import { useState, useCallback, useEffect } from 'react'
import type { Order, Lead, AffiliateAnalytics } from '@/lib/supabase'

export interface AdminStats {
  totalOrders: number
  revenue: number
  leads: number
  newOrders: number
  todayRevenue: number
  weekRevenue: number
  pendingPayments: number
  avgOrderValue: number
  conversionRate: number
}

export interface PageViewStats {
  total: number
  today: number
  last7: number
  last30: number
  mobilePercent: number
  dailyChart: { date: string; count: number }[]
  topReferrers: { name: string; count: number }[]
  topUtm: { name: string; count: number }[]
  topPages: { name: string; count: number }[]
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

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ordRes, leadRes, affRes, pvRes] = await Promise.allSettled([
        fetch('/api/orders?limit=1000').then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() }),
        fetch('/api/leads?limit=1000').then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() }),
        fetch('/api/analytics/affiliate-click').then(r => r.ok ? r.json() : null),
        fetch('/api/analytics/pageview').then(r => r.ok ? r.json() : null),
      ])

      const orderList: Order[] = ordRes.status === 'fulfilled' ? (ordRes.value?.orders || []) : []
      const leadList: Lead[]   = leadRes.status === 'fulfilled' ? (leadRes.value?.leads || []) : []
      const affData            = affRes.status === 'fulfilled' ? affRes.value : null
      const pvData             = pvRes.status === 'fulfilled' ? pvRes.value : null

      if (ordRes.status === 'rejected' && leadRes.status === 'rejected') {
        setError('Грешка при зареждане. Провери Supabase env vars в Vercel.')
      }

      setOrders(orderList)
      setLeads(leadList)
      setAnalytics(affData)
      setPageViews(pvData)

      const today = new Date().toISOString().slice(0, 10)
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
      const active = orderList.filter(o => o.status !== 'cancelled')
      const revenue = active.reduce((s, o) => s + Number(o.total), 0)
      const weekRevenue = active
        .filter(o => o.created_at.slice(0, 10) >= weekAgo)
        .reduce((s, o) => s + Number(o.total), 0)

      setStats({
        totalOrders:     orderList.length,
        revenue,
        leads:           leadList.length,
        newOrders:       orderList.filter(o => o.status === 'new').length,
        todayRevenue:    active.filter(o => o.created_at.slice(0, 10) === today).reduce((s, o) => s + Number(o.total), 0),
        weekRevenue,
        pendingPayments: orderList.filter(o => o.payment_status === 'pending' && o.status !== 'cancelled').length,
        avgOrderValue:   active.length ? revenue / active.length : 0,
        conversionRate:  pvData?.last30 && orderList.length
          ? Math.min(99, (orderList.filter(o => o.created_at >= new Date(Date.now() - 30*86400000).toISOString()).length / pvData.last30) * 100)
          : 0,
      })
    } catch (err: unknown) {
      setError(`Грешка: ${err instanceof Error ? err.message : 'Неизвестна'}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const updateOrderStatus = useCallback(async (orderId: string, status: string) => {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) throw new Error('Update failed')
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: status as Order['status'] } : o))
  }, [])

  const updatePaymentStatus = useCallback(async (orderId: string, payment_status: string) => {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_status }),
    })
    if (!res.ok) throw new Error('Update failed')
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status: payment_status as Order['payment_status'] } : o))
  }, [])

  return {
    orders, leads, analytics, pageViews, stats,
    loading, error,
    fetchAll, setOrders,
    updateOrderStatus, updatePaymentStatus,
  }
}
