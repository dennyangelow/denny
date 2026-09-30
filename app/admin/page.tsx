'use client'
// app/admin/page.tsx — v9
// ✅ ПОПРАВКИ v9 (спрямо v8):
//   ✅ Премахнат собствения 30-минутен setInterval(fetchAll) — useAdminData
//      вече си има ВЪТРЕШЕН 2-минутен auto-refresh (виж hooks/useAdminData.ts
//      v16, последния useEffect там). Двата тайм-съра работеха успоредно —
//      всеки fetchAll() извикваше orders+leads+analytics+page-views наведнъж,
//      значи админ панелът правеше двойно повече заявки, отколкото трябва,
//      без никаква полза (2-минутният вече покрива нуждата от свежи данни).
//   ✅ Махнат `(tab as string) === 'email'` — lib/constants.ts NAV_ITEMS вече
//      съдържа { id: 'email', ... }, значи TabId вече включва 'email' по
//      конструкция; кастът беше от по-стара версия на constants.ts и вече
//      не върши нищо, само крие евентуална бъдеща типова грешка.
//
// ✅ v8: 'leads' и 'email-stats' табовете обединени в един 📧 EmailTab
//    (виж app/admin/components/EmailTab.tsx) — Automations вече също
//    живее там (подтаб), не в Маркетинг.
// ✅ v7: onOpenCustomer от DashboardTab → превключва на Поръчки и отваря CustomerProfileModal

import { useState, useEffect, useCallback } from 'react'
import { Sidebar }            from './components/Sidebar'
import { DashboardTab }       from './components/DashboardTab'
import { OrdersTab }          from './components/OrdersTab'
import { EmailTab }           from './components/EmailTab'
import { ContentTab }         from './components/ContentTab'
import { BlogTab }            from './components/BlogTab'
import { AnalyticsTab }       from './components/AnalyticsTab'
import { SettingsTab }        from './components/SettingsTab'
import { FaqTab }             from './components/FaqTab'
import { ReviewsTab }         from './components/ReviewsTab'
import { MarketingTab }       from './components/MarketingTab'
import { ToastContainer }     from '@/components/ui/Toast'
import { useAdminData }       from '@/hooks/useAdminData'
import type { TabId }         from '@/lib/constants'
import type { Order }         from '@/lib/supabase'

// ─── Loading screen ──────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: 16,
      fontFamily: "var(--font-dm-sans),sans-serif", color: '#6b7280', background: '#f4f6f8',
    }}>
      <div style={{
        width: 40, height: 40, border: '3px solid #e5e7eb',
        borderTopColor: '#2d6a4f', borderRadius: '50%',
        animation: 'spin .7s linear infinite',
      }} />
      <p style={{ fontSize: 15 }}>Зарежда Admin панела...</p>
      <style suppressHydrationWarning>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ─── Error banner ─────────────────────────────────────────────────────────────
function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
      background: '#fef3c7', borderBottom: '2px solid #fde68a',
      padding: '10px 24px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 16,
      fontFamily: "var(--font-dm-sans),sans-serif", fontSize: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#92400e' }}>
        <span>⚠️</span>
        <span><strong>Внимание:</strong> {message}</span>
      </div>
      <button
        onClick={onRetry}
        style={{
          background: '#92400e', color: '#fff', border: 'none',
          borderRadius: 8, padding: '6px 16px', cursor: 'pointer',
          fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
        }}
      >
        Опитай пак
      </button>
    </div>
  )
}

// ─── Global styles ────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0 }
  :root {
    --green: #2d6a4f;
    --text:  #111827;
    --muted: #6b7280;
    --border:#e5e7eb;
    --bg:    #f4f6f8;
    --font:  var(--font-dm-sans), system-ui, sans-serif;
  }
  html, body { height: 100%; background: var(--bg) }
  body { font-family: var(--font); color: var(--text); -webkit-font-smoothing: antialiased }
  input, select, textarea, button { font-family: inherit }
  .admin-layout { display: flex; min-height: 100vh }
  .admin-main   { flex: 1; margin-left: 220px; min-height: 100vh; background: var(--bg); overflow-x: hidden }
  @media (max-width: 768px) { .admin-main { margin-left: 0; padding-top: 56px } }
  @keyframes spin { to { transform: rotate(360deg) } }
  ::-webkit-scrollbar       { width: 6px; height: 6px }
  ::-webkit-scrollbar-track { background: transparent }
  ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px }
  ::-webkit-scrollbar-thumb:hover { background: #9ca3af }
`

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab]               = useState<TabId>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [viewOrder, setViewOrder]   = useState<Order | null>(null)
  const [viewCustomerPhone, setViewCustomerPhone] = useState<string | null>(null)

  const {
    orders, setOrders, leads, analytics, pageViews, stats,
    loading, error, fetchAll,
    updateOrderStatus, updatePaymentStatus,
  } = useAdminData()

  // ✅ ФИКС: премахнат отделен 30-мин setInterval(fetchAll) — useAdminData
  // вече си прави собствен 2-минутен auto-refresh вътрешно (без setLoading,
  // без unmount на екрана). Двата тайм-съра дублираха едни и същи 4 заявки
  // (orders/leads/analytics/page-views), без причина.

  // Close mobile sidebar on tab change
  useEffect(() => { setMobileOpen(false) }, [tab])

  const handleViewOrder = useCallback((o: Order) => {
    setViewOrder(o)
    setTab('orders')
  }, [])

  // ✅ От Dashboard (или откъдето и да е) → отваря клиентския профил в таб Поръчки
  const handleOpenCustomer = useCallback((phone: string) => {
    setViewCustomerPhone(phone)
    setTab('orders')
  }, [])

  if (loading) return <LoadingScreen />

  return (
    <>
      <style suppressHydrationWarning>{GLOBAL_CSS}</style>

      {error && <ErrorBanner message={error} onRetry={fetchAll} />}

      <div className="admin-layout" style={{ paddingTop: error ? 48 : 0 }}>
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
              pageViews={pageViews}
              onRefresh={fetchAll}
              onViewOrder={handleViewOrder}
              onOpenCustomer={handleOpenCustomer}
              onTabChange={(t) => setTab(t as TabId)}
            />
          )}

          {tab === 'orders' && (
            <OrdersTab
              orders={orders}
              onStatusChange={updateOrderStatus}
              onPaymentChange={updatePaymentStatus}
              setOrders={setOrders}
              initialOrder={viewOrder}
              initialCustomerPhone={viewCustomerPhone}
            />
          )}

          {/* ✅ ФИКС: без `as string` кастa — 'email' вече е част от TabId
              директно от lib/constants.ts NAV_ITEMS. */}
          {tab === 'email'        && <EmailTab leads={leads} />}
          {tab === 'content'      && <ContentTab />}
          {tab === 'blog'         && <BlogTab />}
          {tab === 'marketing'    && <MarketingTab />}
          {tab === 'faq'          && <FaqTab />}
          {tab === 'reviews'      && <ReviewsTab />}
          {tab === 'analytics'    && <AnalyticsTab analytics={analytics} pageViews={pageViews} orders={orders} />}

          {tab === 'settings'     && <SettingsTab ordersCount={orders.length} leadsCount={leads.length} />}
        </main>
      </div>

      <ToastContainer />
    </>
  )
}
