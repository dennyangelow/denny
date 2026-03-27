'use client'

import { useState, useMemo } from 'react'
import { Sidebar }      from './components/Sidebar'
import { DashboardTab } from './components/DashboardTab'
import { OrdersTab }    from './components/OrdersTab'
import { LeadsTab }     from './components/LeadsTab'
import { ContentTab }   from './components/ContentTab'
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
    orders, leads, analytics, pageViews, stats,
    loading, error, fetchAll,
    updateOrderStatus, updatePaymentStatus,
  } = useAdminData()

  // Функция за автоматично затваряне на менюто при избор на таб (за мобилни)
  const handleTabChange = (newTab: TabId) => {
    setTab(newTab)
    setMobileOpen(false)
  }

  if (loading) return <AdminLoader />

  return (
    <div className="admin-wrapper">
      <style>{cssVariables}</style>

      {/* По-красиво известие за грешка */}
      {error && (
        <div className="error-banner">
          <p>⚠️ <strong>Грешка при връзката:</strong> {error}</p>
          <button onClick={fetchAll}>Обнови</button>
        </div>
      )}

      <div className="admin-layout">
        {/* Sidebar с подобрена логика */}
        <Sidebar
          tab={tab}
          setTab={handleTabChange}
          newOrders={stats.newOrders}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />

        {/* Затъмняване при отворено мобилно меню */}
        {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}

        <main className="admin-main">
          <div className="tab-content">
            {tab === 'dashboard'  && <DashboardTab stats={stats} orders={orders} leads={leads} analytics={analytics} pageViews={pageViews} onRefresh={fetchAll} onViewOrder={o => { setViewOrder(o); setTab('orders') }} />}
            {tab === 'orders'     && <OrdersTab orders={orders} onStatusChange={updateOrderStatus} onPaymentChange={updatePaymentStatus} initialOrder={viewOrder} />}
            {tab === 'leads'      && <LeadsTab leads={leads} />}
            {tab === 'content'    && <ContentTab />}
            {tab === 'analytics'  && <AnalyticsTab analytics={analytics} pageViews={pageViews} orders={orders} />}
            {tab === 'settings'   && <SettingsTab ordersCount={orders.length} leadsCount={leads.length} />}
          </div>
        </main>
      </div>

      <ToastContainer />
    </div>
  )
}

// Отделен компонент за Loader-а за по-чист код
function AdminLoader() {
  return (
    <div className="loader-container">
      <div className="spinner" />
      <p>Синхронизиране на данните...</p>
      <style>{`
        .loader-container { display:flex; flex-direction:column; alignItems:center; justifyContent:center; height:100vh; gap:16px; font-family: sans-serif; background:#f4f6f8; color:#6b7280; }
        .spinner { width:40px; height:40px; border:3px solid #e5e7eb; border-top-color:#2d6a4f; border-radius:50%; animation:spin .7s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  )
}

const cssVariables = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
  
  :root {
    --sidebar-width: 240px;
    --green: #2d6a4f;
    --bg: #f4f6f8;
  }

  .admin-layout { 
    display: flex; 
    min-height: 100vh; 
  }

  .admin-main { 
    flex: 1; 
    margin-left: var(--sidebar-width); 
    background: var(--bg);
    transition: margin 0.3s;
  }

  .tab-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px;
  }

  .error-banner {
    position: fixed; top: 20px; right: 20px; z-index: 10000;
    background: #fff; border-left: 4px solid #ef4444;
    padding: 16px 24px; border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
    display: flex; align-items: center; gap: 20px;
  }

  .mobile-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 40;
    backdrop-filter: blur(4px);
  }

  @media (max-width: 768px) {
    .admin-main { margin-left: 0; padding-top: 60px; }
  }
`