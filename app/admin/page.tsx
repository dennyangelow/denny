'use client'
// app/admin/page.tsx — главна точка на admin панела

import { useState } from 'react'
import { Sidebar }      from './components/Sidebar'
import { DashboardTab } from './components/DashboardTab'
import { OrdersTab }    from './components/OrdersTab'
import { LeadsTab }     from './components/LeadsTab'
import { AnalyticsTab } from './components/AnalyticsTab'
import { SettingsTab }  from './components/SettingsTab'
import { ToastContainer } from '@/components/ui/Toast'
import { useAdminData }  from '@/hooks/useAdminData'
import type { TabId }   from '@/lib/constants'
import type { Order }   from '@/lib/supabase'

export default function AdminPage() {
  const [tab, setTab]               = useState<TabId>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [viewOrder, setViewOrder]   = useState<Order | null>(null)

  const {
    orders, leads, analytics, stats,
    loading, error,
    fetchAll,
    updateOrderStatus, updatePaymentStatus,
  } = useAdminData()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Зарежда данните...</p>
        <style>{`
          .loading-screen {
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; height: 100vh; gap: 16px;
            font-family: 'DM Sans', sans-serif; color: #6b7280;
            background: #f8fafc;
          }
          .spinner {
            width: 36px; height: 36px; border: 3px solid #e5e7eb;
            border-top-color: #2d6a4f; border-radius: 50%;
            animation: spin .7s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-screen">
        <p>⚠ {error}</p>
        <button onClick={fetchAll}>Опитай отново</button>
        <style>{`
          .error-screen {
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; height: 100vh; gap: 16px;
            font-family: 'DM Sans', sans-serif;
          }
          .error-screen p { color: #991b1b; font-size: 16px; }
          .error-screen button {
            background: #2d6a4f; color: #fff; border: none; border-radius: 8px;
            padding: 10px 20px; cursor: pointer; font-size: 14px;
          }
        `}</style>
      </div>
    )
  }

  const handleViewOrder = (o: Order) => {
    setViewOrder(o)
    setTab('orders')
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --green:  #2d6a4f;
          --text:   #111827;
          --muted:  #6b7280;
          --border: #e5e7eb;
          --bg:     #f4f6f8;
          --font:   'DM Sans', system-ui, sans-serif;
        }
        html, body { height: 100%; background: var(--bg); }
        body { font-family: var(--font); color: var(--text); -webkit-font-smoothing: antialiased; }

        .admin-layout { display: flex; min-height: 100vh; }
        .admin-main {
          flex: 1; margin-left: 220px; min-height: 100vh;
          background: var(--bg);
        }
        @media (max-width: 768px) {
          .admin-main { margin-left: 0; padding-top: 60px; }
        }
      `}</style>

      <div className="admin-layout">
        <Sidebar
          tab={tab}
          setTab={setTab}
          newOrders={stats.newOrders}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />

        <main className="admin-main">
          {tab === 'dashboard' && (
            <DashboardTab
              stats={stats}
              orders={orders}
              leads={leads}
              analytics={analytics}
              onRefresh={fetchAll}
              onViewOrder={handleViewOrder}
            />
          )}
          {tab === 'orders' && (
            <OrdersTab
              orders={orders}
              onStatusChange={updateOrderStatus}
              onPaymentChange={updatePaymentStatus}
              initialOrder={viewOrder}
            />
          )}
          {tab === 'leads' && (
            <LeadsTab leads={leads} />
          )}
          {tab === 'analytics' && (
            <AnalyticsTab analytics={analytics} orders={orders} />
          )}
          {tab === 'settings' && (
            <SettingsTab ordersCount={orders.length} leadsCount={leads.length} />
          )}
        </main>
      </div>

      <ToastContainer />
    </>
  )
}
