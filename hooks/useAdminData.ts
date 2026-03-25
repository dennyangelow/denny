'use client'
// hooks/useAdminData.ts

import { useState, useCallback, useEffect } from 'react'
import type { Order, Lead, AffiliateAnalytics } from '@/lib/supabase'

export interface AdminStats {
  totalOrders: number
  revenue: number
  leads: number
  newOrders: number
  todayRevenue: number
  pendingPayments: number
}

export function useAdminData() {
  const [orders, setOrders]     = useState<Order[]>([])
  const [leads, setLeads]       = useState<Lead[]>([])
  const [analytics, setAnalytics] = useState<AffiliateAnalytics | null>(null)
  const [stats, setStats]       = useState<AdminStats>({
    totalOrders: 0, revenue: 0, leads: 0,
    newOrders: 0, todayRevenue: 0, pendingPayments: 0,
  })
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ordRes, leadRes, affRes] = await Promise.all([
        fetch('/api/orders?limit=500').then(r => r.json()),
        fetch('/api/leads').then(r => r.json()),
        fetch('/api/analytics/affiliate-click').then(r => r.json()),
      ])

      const orderList: Order[] = ordRes.orders || []
      const leadList: Lead[]   = leadRes.leads  || []

      setOrders(orderList)
      setLeads(leadList)
      setAnalytics(affRes)

      const today = new Date().toISOString().slice(0, 10)
      const active = orderList.filter(o => o.status !== 'cancelled')

      setStats({
        totalOrders:     orderList.length,
        revenue:         active.reduce((s, o) => s + o.total, 0),
        leads:           leadList.length,
        newOrders:       orderList.filter(o => o.status === 'new').length,
        todayRevenue:    active
          .filter(o => o.created_at.slice(0, 10) === today)
          .reduce((s, o) => s + o.total, 0),
        pendingPayments: orderList.filter(o => o.payment_status === 'pending' && o.status !== 'cancelled').length,
      })
    } catch {
      setError('Грешка при зареждане. Провери връзката.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const updateOrderStatus = useCallback(async (orderId: string, status: string) => {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) throw new Error('Update failed')
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: status as Order['status'] } : o))
  }, [])

  const updatePaymentStatus = useCallback(async (orderId: string, payment_status: string) => {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_status }),
    })
    if (!res.ok) throw new Error('Update failed')
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status: payment_status as Order['payment_status'] } : o))
  }, [])

  return {
    orders, leads, analytics, stats,
    loading, error,
    fetchAll, setOrders,
    updateOrderStatus, updatePaymentStatus,
  }
}
