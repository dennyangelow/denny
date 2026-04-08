'use client'
// app/admin/components/SystemeioSyncPanel.tsx — v3
//
// КЛЮЧОВА ПРОМЯНА: Прогрес бар + автоматичен loop
//
// Защо: /api/leads/sync обработва само 5 контакта на извикване
// (за да не превиши Vercel timeout от 30 сек).
// Панелът вика API-то многократно докато hasMore=false.
// Показва live прогрес: X/329 синхронизирани.

import { useState, useEffect, useRef } from 'react'

interface SyncStatus {
  unsynced:      number
  total:         number
  invalidEmails: number
}

interface SyncResult {
  success:   boolean
  total:     number
  synced:    number
  failed:    number
  invalid?:  number
  hasMore?:  boolean
  errors?:   string[]
  message?:  string
  invalidEmail?: boolean
}

export function SystemeioSyncPanel() {
  const [status,    setStatus]    = useState<SyncStatus | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [progress,  setProgress]  = useState({ done: 0, total: 0 })
  const [finalResult, setFinalResult] = useState<{
    synced: number; failed: number; invalid: number; errors: string[]
  } | null>(null)
  const abortRef = useRef(false)

  const fetchStatus = async () => {
    try {
      const res  = await fetch('/api/leads/sync')
      const data = await res.json()
      setStatus(data)
    } catch { /* silent */ }
  }

  useEffect(() => { fetchStatus() }, [])

  const runSync = async (all = false) => {
    setLoading(true)
    setFinalResult(null)
    abortRef.current = false

    // Взимаме текущия статус за да знаем колко трябва да се sync-нат
    let statusData = status
    if (!statusData) {
      try {
        const r = await fetch('/api/leads/sync')
        statusData = await r.json()
        setStatus(statusData)
      } catch { /* ignore */ }
    }

    const totalToSync = all
      ? (statusData?.total ?? 0) - (statusData?.invalidEmails ?? 0)
      : (statusData?.unsynced ?? 0)

    setProgress({ done: 0, total: totalToSync })

    let totalSynced  = 0
    let totalFailed  = 0
    let totalInvalid = 0
    const allErrors: string[] = []

    try {
      let hasMore = true

      while (hasMore && !abortRef.current) {
        const res  = await fetch(`/api/leads/sync${all ? '?all=true' : ''}`, { method: 'POST' })
        const data: SyncResult = await res.json()

        totalSynced  += data.synced  ?? 0
        totalFailed  += data.failed  ?? 0
        totalInvalid += data.invalid ?? 0
        if (data.errors) allErrors.push(...data.errors)

        setProgress(p => ({ ...p, done: p.done + (data.synced ?? 0) + (data.invalid ?? 0) }))

        hasMore = data.hasMore === true

        if (!data.success && !hasMore) break

        // Малка пауза между batch-овете
        if (hasMore) await new Promise(r => setTimeout(r, 800))
      }
    } catch (err: any) {
      allErrors.push(err.message)
    } finally {
      setLoading(false)
      setFinalResult({ synced: totalSynced, failed: totalFailed, invalid: totalInvalid, errors: allErrors })
      await fetchStatus()
    }
  }

  const stop = () => { abortRef.current = true }

  const synced = status
    ? status.total - status.unsynced - (status.invalidEmails ?? 0)
    : 0

  const progressPct = progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={{ fontSize: 20 }}>🔄</span>
        <h3 style={styles.title}>Systeme.io Синхронизация</h3>
      </div>

      {/* Статистика */}
      {status && (
        <div style={styles.statusRow}>
          <div style={styles.stat}>
            <span style={styles.statNum}>{status.total}</span>
            <span style={styles.statLabel}>Общо лийда</span>
          </div>

          <div style={{ ...styles.stat, borderColor: status.unsynced > 0 ? '#f59e0b' : '#22c55e' }}>
            <span style={{ ...styles.statNum, color: status.unsynced > 0 ? '#f59e0b' : '#22c55e' }}>
              {status.unsynced}
            </span>
            <span style={styles.statLabel}>Чакат sync</span>
          </div>

          <div style={{ ...styles.stat, borderColor: '#22c55e' }}>
            <span style={{ ...styles.statNum, color: '#22c55e' }}>{synced}</span>
            <span style={styles.statLabel}>Синхронизирани</span>
          </div>

          {(status.invalidEmails ?? 0) > 0 && (
            <div style={{ ...styles.stat, borderColor: '#ef4444', gridColumn: '1 / -1' }}>
              <span style={{ ...styles.statNum, color: '#ef4444', fontSize: 18 }}>
                ⚠️ {status.invalidEmails}
              </span>
              <span style={styles.statLabel}>Невалидни имейли (пропуснати)</span>
            </div>
          )}
        </div>
      )}

      {/* Прогрес бар — показва се само по време на sync */}
      {loading && progress.total > 0 && (
        <div style={styles.progressBox}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            <span>⏳ Синхронизиране...</span>
            <span>{progress.done} / {progress.total} ({progressPct}%)</span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{
              ...styles.progressBar,
              width: `${progressPct}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
            Обработват се по 5 контакта наведнъж — моля изчакай
          </p>
        </div>
      )}

      {/* Бутони */}
      {!loading && (
        <div style={styles.actions}>
          <button
            onClick={() => runSync(false)}
            disabled={loading || status?.unsynced === 0}
            style={{
              ...styles.btn,
              background: status?.unsynced === 0
                ? '#374151'
                : 'linear-gradient(135deg, #f59e0b, #d97706)',
              cursor: status?.unsynced === 0 ? 'not-allowed' : 'pointer',
              opacity: status?.unsynced === 0 ? 0.6 : 1,
            }}
          >
            🔄 Sync несинхронизирани ({status?.unsynced ?? '...'})
          </button>

          <button
            onClick={() => runSync(true)}
            disabled={loading}
            style={{
              ...styles.btn,
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            ♻️ Full re-sync (обнови всички — имена, телефони, тагове)
          </button>
        </div>
      )}

      {/* Бутон за спиране */}
      {loading && (
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <button onClick={stop} style={{
            ...styles.btn,
            background: '#374151',
            cursor: 'pointer',
            fontSize: 12,
            padding: '8px 20px',
          }}>
            ⏹ Спри
          </button>
        </div>
      )}

      {/* Краен резултат */}
      {!loading && finalResult && (
        <div style={{
          ...styles.result,
          borderColor: finalResult.failed === 0 ? '#22c55e' : '#f59e0b',
          background:  finalResult.failed === 0 ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
        }}>
          <p style={{ color: '#e5e7eb', margin: '0 0 4px', fontWeight: 700 }}>
            ✅ Готово: {finalResult.synced} синхронизирани
            {finalResult.failed  > 0 && <span style={{ color: '#fca5a5' }}> · {finalResult.failed} грешки</span>}
            {finalResult.invalid > 0 && <span style={{ color: '#fb923c' }}> · {finalResult.invalid} невалидни имейли</span>}
          </p>
          {finalResult.errors.length > 0 && (
            <div style={styles.errorList}>
              {finalResult.errors.slice(0, 5).map((e, i) => (
                <p key={i} style={{ color: '#fca5a5', fontSize: 11, margin: '2px 0' }}>⚠️ {e}</p>
              ))}
              {finalResult.errors.length > 5 && (
                <p style={{ color: '#9ca3af', fontSize: 11 }}>...и още {finalResult.errors.length - 5}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background:   'rgba(255,255,255,0.05)',
    border:       '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding:      24,
    maxWidth:     480,
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
  },
  title: {
    margin: 0, color: '#fff', fontSize: 16, fontWeight: 700,
  },
  statusRow: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20,
  },
  stat: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '12px 8px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  statNum:   { fontSize: 24, fontWeight: 800, color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  progressBox: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: 14, marginBottom: 16,
  },
  progressTrack: {
    height: 10, background: 'rgba(255,255,255,0.1)',
    borderRadius: 99, overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #22c55e, #16a34a)',
    borderRadius: 99,
  },
  actions: {
    display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16,
  },
  btn: {
    padding: '12px 16px', borderRadius: 10, border: 'none',
    color: '#fff', fontWeight: 700, fontSize: 14, transition: 'all 0.2s',
  },
  result: {
    border: '1px solid', borderRadius: 10, padding: 14,
  },
  errorList: {
    marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)',
  },
}
