'use client'
// app/admin/components/EmailStatsTab.tsx — v1
//
// Показва данните, които /api/webhooks/ses вече пише в базата: open/click
// rate по sequence стъпка, bounce/complaint брой (30 дни), и фунел на
// изоставените колички (abandoned_carts).

import { useState, useEffect } from 'react'

interface SequenceStat {
  step: number; label: string
  sent: number; opened: number; clicked: number
  openRate: number; clickRate: number
}

interface StatsResponse {
  sequenceStats: SequenceStat[]
  totals: { sent: number; opened: number; clicked: number; openRate: number; clickRate: number }
  deliverability: { hardBounces: number; complaints: number }
  abandonedCarts: { total: number; converted: number; reminded: number; pending: number }
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: color || '#111', letterSpacing: '-.03em', marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function RateBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 8, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden', minWidth: 100 }}>
      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 99, transition: 'width .5s ease' }} />
    </div>
  )
}

export function EmailStatsTab() {
  const [data, setData]       = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    fetch('/api/email-stats')
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6b7280', fontSize: 14 }}>
      <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#2d6a4f', borderRadius: '50%', animation: 'spin .7s linear infinite', marginRight: 12 }} />
      Зарежда статистиките...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#b91c1c' }}>Грешка: {error}</div>
  )

  if (!data) return null

  return (
    <div style={{ padding: '16px 14px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Email статистики</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Последните 90 дни · автоматично от Amazon SES webhook</p>
      </div>

      {/* Общи числа */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard label="Пратени" value={data.totals.sent} />
        <StatCard label="Open rate" value={`${data.totals.openRate}%`} sub={`${data.totals.opened} отворени`} color="#0ea5e9" />
        <StatCard label="Click rate" value={`${data.totals.clickRate}%`} sub={`${data.totals.clicked} кликнати`} color="#7c3aed" />
        <StatCard label="Hard bounces (30д)" value={data.deliverability.hardBounces} color={data.deliverability.hardBounces > 0 ? '#ef4444' : '#16a34a'} />
        <StatCard label="Spam complaints (30д)" value={data.deliverability.complaints} color={data.deliverability.complaints > 0 ? '#ef4444' : '#16a34a'} />
      </div>

      {/* По стъпка */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>📈 По sequence стъпка</h2>
        {data.sequenceStats.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9ca3af' }}>Все още няма данни — ще се появят след първите пратени и отворени имейли.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {data.sequenceStats.map(s => (
              <div key={s.step}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ fontWeight: 700, color: '#111' }}>{s.label}</span>
                  <span style={{ color: '#9ca3af' }}>{s.sent} пратени</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#0ea5e9', width: 90 }}>Open {s.openRate}%</span>
                  <RateBar pct={s.openRate} color="#0ea5e9" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: '#7c3aed', width: 90 }}>Click {s.clickRate}%</span>
                  <RateBar pct={s.clickRate} color="#7c3aed" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Abandoned carts funnel */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>🛒 Изоставени колички</h2>
        <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 16px' }}>От въвеждане на имейл в checkout до завършена поръчка</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14 }}>
          <StatCard label="Всичко drafts" value={data.abandonedCarts.total} />
          <StatCard label="Завършени поръчки" value={data.abandonedCarts.converted} color="#16a34a" />
          <StatCard label="Получили reminder" value={data.abandonedCarts.reminded} color="#f59e0b" />
          <StatCard label="Чакат (< 2ч)" value={data.abandonedCarts.pending} color="#6b7280" />
        </div>
      </div>
    </div>
  )
}
