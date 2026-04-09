'use client'
// app/admin/components/SystemeioSyncPanel.tsx — v5
//
// ПОПРАВКИ v5:
//   Sync вече върви ИЗЦЯЛО НА СЪРВЪРА — /api/leads/sync/background
//   Браузърът poll-ва прогреса на всеки 3 сек.
//   Дори да затвориш прозореца / презаредиш — sync продължава!
//   При отваряне на панела автоматично се засича ако sync вече върви.

import { useState, useEffect, useRef, useCallback } from 'react'

interface SyncStatus {
  unsynced:      number
  total:         number
  invalidEmails: number
}

interface JobProgress {
  status:      'idle' | 'running' | 'done' | 'aborted' | 'error'
  all?:        boolean
  total?:      number
  done?:       number
  synced?:     number
  failed?:     number
  invalid?:    number
  errors?:     string[]
  startedAt?:  string
  finishedAt?: string
  updatedAt?:  string
}

export function SystemeioSyncPanel() {
  const [status,   setStatus]   = useState<SyncStatus | null>(null)
  const [job,      setJob]      = useState<JobProgress>({ status: 'idle' })
  const [stopping, setStopping] = useState(false)

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  // ── Fetch status ────────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res  = await fetch('/api/leads/sync')
      const data = await res.json()
      if (mountedRef.current) setStatus(data)
    } catch { /* silent */ }
  }, [])

  // ── Poll job progress ───────────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollRef.current) return // вече poll-ва
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch('/api/leads/sync/background')
        const data: JobProgress = await res.json()
        if (!mountedRef.current) return
        setJob(data)
        if (data.status !== 'running') {
          // Спираме polling-а
          clearInterval(pollRef.current!)
          pollRef.current = null
          setStopping(false)
          await fetchStatus()
        }
      } catch { /* silent */ }
    }, 3000)
  }, [fetchStatus])

  // ── При mount: проверяваме дали вече върви job ──────────────────────────────
  useEffect(() => {
    mountedRef.current = true

    const init = async () => {
      await fetchStatus()
      try {
        const res  = await fetch('/api/leads/sync/background')
        const data: JobProgress = await res.json()
        if (mountedRef.current) {
          setJob(data)
          if (data.status === 'running') {
            startPolling() // Вече върви — закачаме се за прогреса
          }
        }
      } catch { /* silent */ }
    }

    init()

    return () => {
      mountedRef.current = false
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [fetchStatus, startPolling])

  // ── Стартиране на sync ──────────────────────────────────────────────────────
  const runSync = async (all: boolean) => {
    setStopping(false)

    // Изчистваме abort
    await fetch('/api/leads/sync/abort', { method: 'DELETE' }).catch(() => {})

    // Стартираме background job
    setJob({ status: 'running', total: 0, done: 0, synced: 0, failed: 0, invalid: 0 })
    startPolling()

    try {
      await fetch('/api/leads/sync/background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all }),
      })
      // Заявката се върна (sync завърши или Vercel timeout)
      // Polling-ът ще засече финалния статус
    } catch { /* silent — браузърът може да е затворил заявката */ }
  }

  // ── Спиране ─────────────────────────────────────────────────────────────────
  const stop = async () => {
    setStopping(true)
    await fetch('/api/leads/sync/abort', { method: 'POST' }).catch(() => {})
  }

  // ── Изчисления ──────────────────────────────────────────────────────────────
  const synced = status
    ? status.total - status.unsynced - (status.invalidEmails ?? 0)
    : 0

  const isRunning = job.status === 'running'
  const progressPct = (job.total ?? 0) > 0
    ? Math.round(((job.done ?? 0) / job.total!) * 100)
    : 0

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={{ fontSize: 20 }}>🔄</span>
        <h3 style={styles.title}>Systeme.io Синхронизация</h3>
        {isRunning && (
          <span style={{
            marginLeft: 'auto', fontSize: 11, color: '#22c55e',
            background: 'rgba(34,197,94,0.1)', padding: '3px 8px', borderRadius: 99,
          }}>
            ● РАБОТИ НА СЪРВЪРА
          </span>
        )}
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

      {/* Прогрес бар */}
      {isRunning && (
        <div style={styles.progressBox}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            <span>⏳ Синхронизиране на сървъра...</span>
            <span>{job.done ?? 0} / {job.total ?? '?'} ({progressPct}%)</span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{
              ...styles.progressBar,
              width: `${progressPct}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
            Можеш да затвориш прозореца — sync продължава на сървъра
          </p>
        </div>
      )}

      {/* Бутони за стартиране */}
      {!isRunning && (
        <div style={styles.actions}>
          <button
            onClick={() => runSync(false)}
            disabled={status?.unsynced === 0}
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
      {isRunning && (
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <button
            onClick={stop}
            disabled={stopping}
            style={{
              ...styles.btn,
              background: stopping ? '#1f2937' : '#374151',
              cursor: stopping ? 'not-allowed' : 'pointer',
              fontSize: 12,
              padding: '8px 20px',
              opacity: stopping ? 0.7 : 1,
            }}
          >
            {stopping ? '⏳ Спира...' : '⏹ Спри'}
          </button>
        </div>
      )}

      {/* Краен резултат */}
      {!isRunning && (job.status === 'done' || job.status === 'aborted' || job.status === 'error') && (
        <div style={{
          ...styles.result,
          borderColor: job.failed === 0 && job.status === 'done' ? '#22c55e' : '#f59e0b',
          background:  job.failed === 0 && job.status === 'done'
            ? 'rgba(34,197,94,0.08)'
            : 'rgba(245,158,11,0.08)',
        }}>
          <p style={{ color: '#e5e7eb', margin: '0 0 4px', fontWeight: 700 }}>
            {job.status === 'done'    && '✅'}
            {job.status === 'aborted' && '⏹'}
            {job.status === 'error'   && '❌'}
            {' '}Готово: {job.synced ?? 0} синхронизирани
            {(job.failed  ?? 0) > 0 && (
              <span style={{ color: '#fca5a5' }}> · {job.failed} грешки</span>
            )}
            {(job.invalid ?? 0) > 0 && (
              <span style={{ color: '#fb923c' }}> · {job.invalid} невалидни имейли</span>
            )}
            {job.status === 'aborted' && (
              <span style={{ color: '#9ca3af' }}> · спрян ръчно</span>
            )}
          </p>
          {(job.errors?.length ?? 0) > 0 && (
            <div style={styles.errorList}>
              {job.errors!.slice(0, 5).map((e, i) => (
                <p key={i} style={{ color: '#fca5a5', fontSize: 11, margin: '2px 0' }}>⚠️ {e}</p>
              ))}
            </div>
          )}
          {job.finishedAt && (
            <p style={{ color: '#6b7280', fontSize: 10, margin: '6px 0 0' }}>
              Завършено: {new Date(job.finishedAt).toLocaleTimeString('bg-BG')}
            </p>
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
    background:    'rgba(255,255,255,0.05)',
    border:        '1px solid rgba(255,255,255,0.1)',
    borderRadius:  10,
    padding:       '12px 8px',
    textAlign:     'center',
    display:       'flex',
    flexDirection: 'column',
    gap:           4,
  },
  statNum:   { fontSize: 24, fontWeight: 800, color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  progressBox: {
    background:   'rgba(255,255,255,0.05)',
    border:       '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding:      14,
    marginBottom: 16,
  },
  progressTrack: {
    height:       10,
    background:   'rgba(255,255,255,0.1)',
    borderRadius: 99,
    overflow:     'hidden',
  },
  progressBar: {
    height:       '100%',
    background:   'linear-gradient(90deg, #22c55e, #16a34a)',
    borderRadius: 99,
  },
  actions: {
    display:       'flex',
    flexDirection: 'column',
    gap:           10,
    marginBottom:  16,
  },
  btn: {
    padding:      '12px 16px',
    borderRadius: 10,
    border:       'none',
    color:        '#fff',
    fontWeight:   700,
    fontSize:     14,
    transition:   'all 0.2s',
  },
  result: {
    border:       '1px solid',
    borderRadius: 10,
    padding:      14,
  },
  errorList: {
    marginTop:  8,
    paddingTop: 8,
    borderTop:  '1px solid rgba(255,255,255,0.1)',
  },
}
