'use client'
// app/admin/page.tsx v3

import { useState } from 'react'
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
    orders, leads, analytics, stats,
    loading, error, fetchAll,
    updateOrderStatus, updatePaymentStatus,
  } = useAdminData()

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:16, fontFamily:"'DM Sans',sans-serif", color:'#6b7280', background:'#f4f6f8' }}>
      <div style={{ width:40, height:40, border:'3px solid #e5e7eb', borderTopColor:'#2d6a4f', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
      <p style={{ fontSize:15 }}>Зарежда данните...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--green:#2d6a4f;--text:#111827;--muted:#6b7280;--border:#e5e7eb;--bg:#f4f6f8;--font:'DM Sans',system-ui,sans-serif}
        html,body{height:100%;background:var(--bg)}
        body{font-family:var(--font);color:var(--text);-webkit-font-smoothing:antialiased}
        .admin-layout{display:flex;min-height:100vh}
        .admin-main{flex:1;margin-left:220px;min-height:100vh;background:var(--bg);overflow-x:hidden}
        @media(max-width:768px){.admin-main{margin-left:0;padding-top:60px}}
      `}</style>

      {error && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:999, background:'#fef3c7', borderBottom:'2px solid #fde68a', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, fontFamily:"'DM Sans',sans-serif", fontSize:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, color:'#92400e' }}>
            <span>⚠️</span>
            <span><strong>Внимание:</strong> {error}</span>
          </div>
          <button onClick={fetchAll} style={{ background:'#92400e', color:'#fff', border:'none', borderRadius:8, padding:'6px 16px', cursor:'pointer', fontWeight:700, fontSize:13, fontFamily:'inherit' }}>Опитай пак</button>
        </div>
      )}

      <div className="admin-layout" style={{ paddingTop: error ? 52 : 0 }}>
        <Sidebar
          tab={tab}
          setTab={setTab}
          newOrders={stats.newOrders}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />
        <main className="admin-main">
          {tab === 'dashboard'  && <DashboardTab stats={stats} orders={orders} leads={leads} analytics={analytics} onRefresh={fetchAll} onViewOrder={o => { setViewOrder(o); setTab('orders') }} />}
          {tab === 'orders'     && <OrdersTab orders={orders} onStatusChange={updateOrderStatus} onPaymentChange={updatePaymentStatus} initialOrder={viewOrder} />}
          {tab === 'leads'      && <LeadsTab leads={leads} />}
          {tab === 'content'    && <ContentTab />}
          {tab === 'analytics'  && <AnalyticsTab analytics={analytics} orders={orders} />}
          {tab === 'settings'   && <SettingsTab ordersCount={orders.length} leadsCount={leads.length} />}
        </main>
      </div>
      <ToastContainer />
    </>
  )
}
