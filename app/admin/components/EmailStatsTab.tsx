'use client'
// app/admin/components/EmailStatsTab.tsx — v3
//
// ПОПРАВКИ v3 (спрямо v2) — "подобри статистиките както трябва":
//   ✅ НОВА секция "⚙️ Статус на автоматизациите" — показва active/
//      completed/exited БРОЙ по всеки workflow + примерни грешки (напр.
//      "Email address is not verified..." от SES sandbox), директно тук,
//      вместо да се чете през CSV експорт от Supabase. Спряна автоматизация
//      (active:false) е маркирана ясно, за да не се чудиш защо 0 са пратени.
//   ✅ Cart фунела вече показва и conversion rate (%) — бърз поглед дали
//      изобщо работи, не само 4 сурови числа.
//
// Показва данните, които /api/webhooks/ses вече пише в базата: open/click
// rate по sequence стъпка, bounce/complaint брой (30 дни), фунел на
// изоставените колички, и статус на автоматизациите.

import { useState, useEffect } from 'react'

interface SequenceStat {
  id: string; label: string
  sent: number; opened: number; clicked: number
  openRate: number; clickRate: number
}

interface WorkflowStat {
  id: string; name: string; triggerType: string; active: boolean
  enrollments: { active: number; completed: number; exited: number }
  sampleErrors: string[]
}

interface StatsResponse {
  sequenceStats: SequenceStat[]
  totals: { sent: number; opened: number; clicked: number; openRate: number; clickRate: number }
  deliverability: { hardBounces: number; complaints: number }
  abandonedCarts: { total: number; converted: number; reminded: number; pending: number; conversionRate: number }
  workflowStats: WorkflowStat[]
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

function Pill({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span style={{ fontSize: 11.5, fontWeight: 800, padding: '3px 10px', borderRadius: 99, background: bg, color }}>
      {children}
    </span>
  )
}

function WorkflowStatusCard({ wf }: { wf: WorkflowStat }) {
  const [showErrors, setShowErrors] = useState(false)
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>{wf.name}</span>
          <Pill bg={wf.active ? '#dcfce7' : '#f3f4f6'} color={wf.active ? '#166534' : '#6b7280'}>
            {wf.active ? '● Активна' : '○ Спряна'}
          </Pill>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Pill bg="#dbeafe" color="#1e40af">🟢 {wf.enrollments.active} в процес</Pill>
          <Pill bg="#dcfce7" color="#166534">✅ {wf.enrollments.completed} завършили</Pill>
          {wf.enrollments.exited > 0 && (
            <button
              type="button"
              onClick={() => setShowErrors(s => !s)}
              style={{ border: 'none', cursor: wf.sampleErrors.length ? 'pointer' : 'default', background: 'none', padding: 0 }}
            >
              <Pill bg="#fee2e2" color="#991b1b">⚪ {wf.enrollments.exited} излезли{wf.sampleErrors.length ? ' ▾' : ''}</Pill>
            </button>
          )}
        </div>
      </div>
      {!wf.active && (
        <div style={{ fontSize: 11.5, color: '#92400e', marginTop: 8 }}>
          Спряна е — нови контакти няма да влизат в тази автоматизация, докато не я активираш.
        </div>
      )}
      {showErrors && wf.sampleErrors.length > 0 && (
        <div style={{ marginTop: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>
          {wf.sampleErrors.map((err, i) => (
            <div key={i} style={{ fontSize: 11.5, color: '#991b1b', fontFamily: 'monospace', padding: '3px 0' }}>{err}</div>
          ))}
        </div>
      )}
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
              <div key={s.id}>
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

      {/* ✅ НОВО v3: Статус на автоматизациите */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>⚙️ Статус на автоматизациите</h2>
        <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 16px' }}>На живо от workflow enrollments — кликни на "излезли", за да видиш грешката</p>
        {data.workflowStats.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9ca3af' }}>Още няма workflows.</p>
        ) : (
          data.workflowStats.map(wf => <WorkflowStatusCard key={wf.id} wf={wf} />)
        )}
      </div>

      {/* Abandoned carts funnel */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>🛒 Изоставени колички</h2>
        <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 16px' }}>От въвеждане на имейл в checkout до завършена поръчка</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14 }}>
          <StatCard label="Всичко drafts" value={data.abandonedCarts.total} />
          <StatCard label="Завършени поръчки" value={data.abandonedCarts.converted} color="#16a34a" />
          <StatCard label="Conversion rate" value={`${data.abandonedCarts.conversionRate}%`} color="#16a34a" />
          <StatCard label="Получили reminder" value={data.abandonedCarts.reminded} color="#f59e0b" />
          <StatCard label="Чакат (< 2ч)" value={data.abandonedCarts.pending} color="#6b7280" />
        </div>
      </div>
    </div>
  )
}
