'use client'
// app/admin/components/DiagnosticsPanel.tsx
// Показва точно какво се зарежда, какво липсва и защо
// Добави го в AnalyticsTab или SettingsTab за диагностика
// Премахни го след като всичко работи

import { useState, useEffect } from 'react'

interface DiagData {
  pageViews: any
  affiliate: any
  orders: any
  leads: any
  errors: string[]
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: ok ? '#16a34a' : '#ef4444', marginRight: 6, flexShrink: 0,
    }} />
  )
}

function Row({ label, value, ok, warn }: { label: string; value: string | number; ok?: boolean; warn?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12,
    }}>
      <span style={{ color: '#374151', display: 'flex', alignItems: 'center' }}>
        {ok !== undefined && <StatusDot ok={ok} />}
        {label}
      </span>
      <span style={{
        fontWeight: 700,
        color: ok === false ? '#ef4444' : warn ? '#f59e0b' : '#111',
        fontFamily: 'monospace', fontSize: 11,
      }}>{value}</span>
    </div>
  )
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase',
        letterSpacing: '.08em', marginBottom: 8, paddingBottom: 4,
        borderBottom: `2px solid ${color}22`,
      }}>{title}</div>
      {children}
    </div>
  )
}

export function DiagnosticsPanel() {
  const [data,    setData]    = useState<DiagData | null>(null)
  const [loading, setLoading] = useState(true)
  const [open,    setOpen]    = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const errors: string[] = []

    Promise.allSettled([
      fetch('/api/analytics/page-view').then(r => {
        if (!r.ok) { errors.push(`page-view: HTTP ${r.status}`); return null }
        return r.json()
      }),
      fetch('/api/analytics/affiliate-click').then(r => {
        if (!r.ok) { errors.push(`affiliate-click: HTTP ${r.status}`); return null }
        return r.json()
      }),
      fetch('/api/orders?limit=1').then(r => {
        if (!r.ok) { errors.push(`orders: HTTP ${r.status}`); return null }
        return r.json()
      }),
      fetch('/api/leads?limit=1&count=true').then(r => {
        if (!r.ok) { errors.push(`leads: HTTP ${r.status}`); return null }
        return r.json()
      }),
    ]).then(([pvRes, affRes, ordRes, leadRes]) => {
      setData({
        pageViews: pvRes.status === 'fulfilled' ? pvRes.value : null,
        affiliate: affRes.status === 'fulfilled' ? affRes.value : null,
        orders:    ordRes.status === 'fulfilled' ? ordRes.value : null,
        leads:     leadRes.status === 'fulfilled' ? leadRes.value : null,
        errors,
      })
      setLoading(false)
    })
  }, [open])

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: open ? '#1e293b' : '#f1f5f9',
          color: open ? '#fff' : '#374151',
          border: '1px solid #e2e8f0', borderRadius: 10,
          padding: '8px 16px', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
          transition: 'all .15s',
        }}
      >
        🔍 {open ? 'Скрий диагностиката' : 'Покажи диагностика'}
        <span style={{ fontSize: 10, opacity: .7 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div style={{
          marginTop: 10, background: '#fff', border: '1px solid #e2e8f0',
          borderRadius: 12, padding: '16px 20px', fontSize: 12,
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8' }}>
              ⏳ Зарежда диагностика...
            </div>
          ) : !data ? (
            <div style={{ color: '#ef4444' }}>❌ Грешка при зареждане</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>

              {/* Page Views */}
              <Section title="👁️ Page Views API" color="#0ea5e9">
                <Row label="API отговаря"         value={data.pageViews ? '✅ ДА' : '❌ НЕ'}          ok={!!data.pageViews} />
                {data.pageViews && <>
                  <Row label="Общо посещения"      value={(data.pageViews.total ?? 0).toLocaleString()}  ok={(data.pageViews.total ?? 0) > 0} />
                  <Row label="Последните 30 дни"   value={(data.pageViews.last30 ?? 0).toLocaleString()} ok={(data.pageViews.last30 ?? 0) > 0} />
                  <Row label="Последните 7 дни"    value={(data.pageViews.last7  ?? 0).toLocaleString()} />
                  <Row label="Днес"                value={(data.pageViews.today  ?? 0).toLocaleString()} />
                  <Row label="90 дни"              value={(data.pageViews.last90 ?? 0).toLocaleString()} />
                  <Row label="Уникални (total)"    value={(data.pageViews.unique ?? 0).toLocaleString()} ok={(data.pageViews.unique ?? 0) > 0} warn={(data.pageViews.unique ?? 0) < 10} />
                  <Row label="Уникални (30д)"      value={(data.pageViews.last30Unique ?? 0).toLocaleString()} ok={(data.pageViews.last30Unique ?? 0) > 0} />
                  <Row label="RPC налична"          value={data.pageViews._debug?.rpcAvailable ? '✅ ДА' : '⚠️ НЕ (fallback)'} ok={!!data.pageViews._debug?.rpcAvailable} warn={!data.pageViews._debug?.rpcAvailable} />
                  <Row label="Detail rows заредени" value={(data.pageViews._debug?.detailRowsLoaded ?? 0).toLocaleString()} ok={(data.pageViews._debug?.detailRowsLoaded ?? 0) > 0} />
                  <Row label="Топ referrers (90д)"  value={`${data.pageViews.topReferrers?.length ?? 0} запис.`} ok={(data.pageViews.topReferrers?.length ?? 0) > 0} warn={(data.pageViews.topReferrers?.length ?? 0) === 0} />
                  <Row label="Топ referrers (30д)"  value={`${data.pageViews.topReferrers30?.length ?? 0} запис.`} />
                  <Row label="Топ referrers (7д)"   value={`${data.pageViews.topReferrers7?.length ?? 0} запис.`} />
                  <Row label="Топ páginas (90д)"    value={`${data.pageViews.topPages?.length ?? 0} запис.`} ok={(data.pageViews.topPages?.length ?? 0) > 0} />
                  <Row label="Mobile %"             value={`${data.pageViews.mobilePercent ?? 0}%`} />
                  <Row label="Daily chart points"   value={data.pageViews.dailyChart?.length ?? 0} ok={(data.pageViews.dailyChart?.length ?? 0) > 0} />
                  {data.pageViews._debug?.ownDomainsFiltered?.length > 0 && (
                    <Row label="Self-referral филтър" value={data.pageViews._debug.ownDomainsFiltered.join(', ')} />
                  )}
                  {(data.pageViews.topReferrers?.length ?? 0) === 0 && (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa', fontSize: 11, color: '#92400e' }}>
                      ⚠️ Няма топ referrers! Причини:<br/>
                      1. Всички referrers са от собствения домейн (self-referral)<br/>
                      2. Посетителите идват от директен трафик (без referrer)<br/>
                      3. detail30Res.limit е достигнат — провери логовете
                    </div>
                  )}
                  {!data.pageViews._debug?.rpcAvailable && (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: '#fef3c7', borderRadius: 8, border: '1px solid #fde68a', fontSize: 11, color: '#92400e' }}>
                      ⚠️ RPC count_unique_visitors не е създадена в Supabase!<br/>
                      Уникалните посетители се изчисляват от rows (неточно).<br/>
                      Изпълни <strong>supabase_migration.sql</strong> в Supabase SQL Editor.
                    </div>
                  )}
                </>}
              </Section>

              {/* Affiliate */}
              <Section title="🔗 Affiliate API" color="#06b6d4">
                <Row label="API отговаря"       value={data.affiliate ? '✅ ДА' : '❌ НЕ'}             ok={!!data.affiliate} />
                {data.affiliate && <>
                  <Row label="Общо кликове"     value={(data.affiliate.total ?? 0).toLocaleString()}    ok={(data.affiliate.total ?? 0) > 0} />
                  <Row label="Последните 30д"   value={(data.affiliate.last30days ?? 0).toLocaleString()} />
                  <Row label="Последните 7д"    value={(data.affiliate.last7days  ?? 0).toLocaleString()} />
                  <Row label="Днес"             value={(data.affiliate.today      ?? 0).toLocaleString()} />
                  <Row label="90 дни"           value={(data.affiliate.last90days ?? 0).toLocaleString()} />
                  <Row label="Топ продукти"     value={data.affiliate.topProducts?.length ?? 0}          ok={(data.affiliate.topProducts?.length ?? 0) > 0} />
                  <Row label="Daily chart"      value={data.affiliate.dailyChart?.length  ?? 0}          ok={(data.affiliate.dailyChart?.length  ?? 0) > 0} />
                  <Row label="Hourly chart"     value={data.affiliate.hourlyChart?.length ?? 0} />
                </>}
              </Section>

              {/* Orders */}
              <Section title="📦 Orders API" color="#f59e0b">
                <Row label="API отговаря"       value={data.orders  ? '✅ ДА' : '❌ НЕ'}  ok={!!data.orders} />
                {data.orders && <>
                  <Row label="Общо поръчки"     value={(data.orders.total ?? data.orders.orders?.length ?? '?').toString()} ok={true} />
                </>}
              </Section>

              {/* Leads */}
              <Section title="✉️ Leads API" color="#8b5cf6">
                <Row label="API отговаря"       value={data.leads  ? '✅ ДА' : '❌ НЕ'}   ok={!!data.leads} />
                {data.leads && <>
                  <Row
                    label="Общо leads"
                    value={(data.leads.total ?? '?').toString()}
                    ok={(data.leads.total ?? 0) > 0}
                    warn={(data.leads.total ?? 0) >= 1000}
                  />
                  {(data.leads.total ?? 0) >= 1000 && (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: '#fef3c7', borderRadius: 8, border: '1px solid #fde68a', fontSize: 11, color: '#92400e' }}>
                      ⚠️ Leads = {data.leads.total} — ако изглежда точно 1000,<br/>
                      значи стария route е с хардкоднат limit=1000.<br/>
                      Смени с новия <strong>route_leads.ts</strong>.
                    </div>
                  )}
                </>}
              </Section>

              {/* Errors */}
              {data.errors.length > 0 && (
                <Section title="❌ Грешки" color="#ef4444">
                  {data.errors.map((e, i) => (
                    <div key={i} style={{ padding: '5px 0', color: '#ef4444', fontSize: 11, fontFamily: 'monospace' }}>
                      • {e}
                    </div>
                  ))}
                </Section>
              )}

              {/* Instructions */}
              <Section title="📋 Как да поправиш" color="#6b7280">
                <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.7 }}>
                  <div>1. <strong>Уникални посетители са неточни?</strong><br/>
                    → Изпълни <code>supabase_migration.sql</code> в Supabase SQL Editor
                  </div>
                  <div style={{ marginTop: 8 }}>2. <strong>Топ референти са малко?</strong><br/>
                    → Добави <code>NEXT_PUBLIC_SITE_URL=https://твоя-домейн.bg</code> в Vercel env vars
                  </div>
                  <div style={{ marginTop: 8 }}>3. <strong>Leads са запечени на 1000?</strong><br/>
                    → Смени <code>app/api/leads/route.ts</code> с новия файл
                  </div>
                  <div style={{ marginTop: 8 }}>4. <strong>Посещенията не показват chart?</strong><br/>
                    → Провери дали <code>PageViewTracker</code> е в <code>layout.tsx</code>
                  </div>
                </div>
              </Section>

            </div>
          )}
        </div>
      )}
    </div>
  )
}
