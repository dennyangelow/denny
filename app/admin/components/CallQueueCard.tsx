'use client'
// app/admin/components/CallQueueCard.tsx — v1
// Единен, споделен компонент за опашката "За звънене днес" —
// преди беше дублиран отделно в DashboardTab.tsx и OrdersTab.tsx с различно
// поведение (единият без collapse, другият без snooze/done). Сега е едно място.
//
// ✅ Snooze бутони (+1д / +3д / +7д) — PATCH next_contact_date напред, без да
//    отваряш профила на клиента
// ✅ Готово бутон (✓) — PATCH next_contact_date = null, изчезва от опашката
// ✅ Optimistic UI — редът изчезва веднага, преди отговора от сървъра
// ✅ Compact/collapsed режим със запомнено състояние (localStorage) — не ти
//    заема половината екран всеки път, когато презаредиш страницата

import { useState, useEffect, useCallback } from 'react'
import { toast } from '@/components/ui/Toast'

export interface CallQueueEntry {
  customer_id: string
  name: string | null
  phone_raw: string
  next_contact_date: string
  days_overdue: number
  last_note: string | null
}

const STORAGE_KEY = 'da_callqueue_collapsed'

function bgDateNDaysFromNow(days: number): string {
  const now = new Date()
  const todayBg = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Sofia' })
  const utcMidnight = new Date(todayBg + 'T00:00:00Z')
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() + days)
  return utcMidnight.toLocaleDateString('en-CA', { timeZone: 'Europe/Sofia' })
}

export function CallQueueCard({
  onOpenCustomer,
  maxVisible = 5,
}: {
  onOpenCustomer?: (phone: string) => void
  /** Колко реда да показва разгърнат, преди "+N още". undefined = всички. */
  maxVisible?: number
}) {
  const [queue, setQueue]     = useState<CallQueueEntry[]>([])
  const [loaded, setLoaded]   = useState(false)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState(false)

  // Запомнено collapsed състояние
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved !== null) setCollapsed(saved === '1')
    } catch {}
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }, [])

  const load = useCallback(() => {
    fetch('/api/customers/call-queue', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setQueue(d.queue || []))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => { load() }, [load])

  const patchCustomer = useCallback(async (c: CallQueueEntry, next_contact_date: string | null) => {
    setBusyIds(prev => new Set(prev).add(c.customer_id))
    // Optimistic — маха реда веднага
    setQueue(prev => prev.filter(x => x.customer_id !== c.customer_id))
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(c.phone_raw)}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ next_contact_date }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || `HTTP ${res.status}`)
      }
    } catch (err: any) {
      console.error('[CallQueueCard] PATCH failed:', err)
      toast.error(`Неуспешно обновяване: ${err.message || 'грешка'}`)
      // Ако се провали — връщаме реда обратно
      setQueue(prev => [...prev, c].sort((a, b) => a.next_contact_date.localeCompare(b.next_contact_date)))
    } finally {
      setBusyIds(prev => { const s = new Set(prev); s.delete(c.customer_id); return s })
    }
  }, [])

  const snooze = useCallback((c: CallQueueEntry, days: number) => {
    patchCustomer(c, bgDateNDaysFromNow(days))
  }, [patchCustomer])

  const markDone = useCallback((c: CallQueueEntry) => {
    patchCustomer(c, null)
  }, [patchCustomer])

  if (!loaded || queue.length === 0) return null

  const overdueCount = queue.filter(c => c.days_overdue > 0).length
  const accentBorder = overdueCount ? '#fecaca' : '#fde68a'
  const accentBg     = overdueCount ? '#fef2f2' : '#fffbeb'
  const accentText   = overdueCount ? '#991b1b' : '#92400e'

  const visible = maxVisible ? queue.slice(0, maxVisible) : queue
  const hiddenCount = maxVisible ? Math.max(0, queue.length - maxVisible) : 0

  return (
    <div style={{ marginBottom: 14, background: '#fff', border: `1px solid ${accentBorder}`, borderRadius: 14, overflow: 'hidden' }}>
      <button
        onClick={toggleCollapsed}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', background: accentBg, border: 'none',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const,
        }}
      >
        <span style={{ fontSize: 16 }}>📞</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: accentText, flex: 1 }}>
          За звънене днес ({queue.length})
          {overdueCount > 0 && (
            <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 700 }}>
              · {overdueCount} просрочени
            </span>
          )}
        </span>
        <span style={{ fontSize: 12, color: accentText, opacity: .7 }}>{collapsed ? '▼' : '▲'}</span>
      </button>

      {!collapsed && (
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visible.map(c => {
            const busy = busyIds.has(c.customer_id)
            return (
              <div
                key={c.customer_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#f9fafb', border: '1px solid #f0f0f0', borderRadius: 10,
                  padding: '8px 10px', opacity: busy ? .5 : 1,
                  transition: 'opacity .15s',
                }}
              >
                <div
                  onClick={() => onOpenCustomer?.(c.phone_raw)}
                  style={{ flex: 1, minWidth: 0, cursor: onOpenCustomer ? 'pointer' : 'default' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{c.name || 'Клиент'}</span>
                    <span style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'monospace' }}>{c.phone_raw}</span>
                    {c.days_overdue > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#991b1b', background: '#fee2e2', borderRadius: 99, padding: '1px 7px' }}>
                        просрочено {c.days_overdue}д
                      </span>
                    )}
                  </div>
                  {c.last_note && (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                      {c.last_note}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <a
                    href={`tel:${c.phone_raw}`}
                    onClick={e => e.stopPropagation()}
                    title="Обади се"
                    style={{ fontSize: 12, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 8, padding: '5px 8px', textDecoration: 'none', fontWeight: 700, lineHeight: 1 }}
                  >
                    📞
                  </a>
                  <button
                    disabled={busy}
                    onClick={e => { e.stopPropagation(); snooze(c, 3) }}
                    title="Отложи с 3 дни"
                    style={{ fontSize: 11, background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8, padding: '5px 7px', fontWeight: 700, cursor: busy ? 'default' : 'pointer', lineHeight: 1 }}
                  >
                    +3д
                  </button>
                  <button
                    disabled={busy}
                    onClick={e => { e.stopPropagation(); snooze(c, 7) }}
                    title="Отложи със 7 дни"
                    style={{ fontSize: 11, background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8, padding: '5px 7px', fontWeight: 700, cursor: busy ? 'default' : 'pointer', lineHeight: 1 }}
                  >
                    +7д
                  </button>
                  <button
                    disabled={busy}
                    onClick={e => { e.stopPropagation(); markDone(c) }}
                    title="Готово — маха от опашката"
                    style={{ fontSize: 12, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, padding: '5px 8px', fontWeight: 800, cursor: busy ? 'default' : 'pointer', lineHeight: 1 }}
                  >
                    ✓
                  </button>
                </div>
              </div>
            )
          })}

          {hiddenCount > 0 && (
            <div style={{ fontSize: 11.5, color: '#94a3b8', textAlign: 'center' as const, marginTop: 2 }}>
              +{hiddenCount} още — виж всички в Поръчки
            </div>
          )}
        </div>
      )}
    </div>
  )
}
