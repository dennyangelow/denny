'use client'
// app/admin/components/SystemeioSyncPanel.tsx — v6
//
// ПОПРАВКИ v6:
//   1. runSync НЕ чака await fetch(POST) — пуска fire-and-forget.
//      Vercel timeout убива заявката, но сървърът продължава да пише прогрес.
//      Polling-ът засича финалния статус сам.
//   2. "Stale job" детекция: ако updatedAt е > 35 сек стар и status='running' →
//      показваме предупреждение вместо безкраен spinner.
//   3. При stale job: бутон "Продължи от там" (рестартира sync от останалите).
//   4. Poll interval: 3 сек (непроменено).

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
  const [stale,    setStale]    = useState(false)

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
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch('/api/leads/sync/background')
        const data: JobProgress = await res.json()
        if (!mountedRef.current) return

        setJob(data)

        // Stale detection: running но не е update-вано > 35 сек
        if (data.status === 'running' && data.updatedAt) {
          const age = Date.now() - new Date(data.updatedAt).getTime()
          setStale(age > 35_000)
        } else {
          setStale(false)
        }

        if (data.status !== 'running') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setStopping(false)
          setStale(false)
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
            startPolling()
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
  // ВАЖНО: НЕ await-ваме POST заявката!
  // Vercel може да я убие след timeout, но сървърът продължава.
  // Polling-ът сам засича края.
  const runSync = async (all: boolean) => {
    setStopping(false)
    setStale(false)

    // Изчистваме abort
    await fetch('/api/leads/sync/abort', { method: 'DELETE' }).catch(() => {})

    // Показваме running веднага
    setJob({ status: 'running', total: 0, done: 0, synced: 0, failed: 0, invalid: 0 })
    startPolling()

    // Fire-and-forget — не await-ваме!
    fetch('/api/leads/sync/background', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ all }),
    }).catch(() => {
      // Заявката може да умре от timeout — OK, сървърът продължава
      // Polling-ът ще засече финалния статус от settings таблицата
    })
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

  const isRunning  = job.status === 'running'
  const progressPct = (job.total ?? 0) > 0
    ? Math.round(((job.done ?? 0) / job.total!) * 100)
    : 0

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={{ fontSize: 20 }}>🔄</span>
        <h3 style={styles.title}>Systeme.io Синхронизация</h3>
        {isRunning && !stale && (
          <span style={{
            marginLeft: 'auto', fontSize: 11, color: '#22c55e',
            background: 'rgba(34,197,94,0.1)', padding: '3px 8px', borderRadius: 99,
          }}>
            ● РАБОТИ НА СЪРВЪРА
          </span>
        )}
        {isRunning && stale && (
          <span style={{
            marginLeft: 'auto', fontSize: 11, color: '#f59e0b',
            background: 'rgba(245,158,11,0.1)', padding: '3px 8px', borderRadius: 99,
          }}>
            ⚠ ПАУЗИРАН / TIMEOUT
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
            <span>{stale ? '⚠ Сървърът не отговаря...' : '⏳ Синхронизиране на сървъра...'}</span>
            <span>{job.done ?? 0} / {job.total ?? '?'} ({progressPct}%)</span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{
              ...styles.progressBar,
              width:      `${progressPct}%`,
              background: stale
                ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                : 'linear-gradient(90deg, #22c55e, #16a34a)',
              transition: 'width 0.4s ease',
            }} />
          </div>
          {!stale && (
            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
              Можеш да затвориш прозореца — sync продължава на сървъра
            </p>
          )}
          {stale && (
            <p style={{ margin: '8px 0 0', fontSize: 11, color: '#f59e0b', textAlign: 'center' }}>
              Vercel timeout — натисни "Продължи" за да sync-неш останалите
            </p>
          )}
        </div>
      )}

      {/* Бутони: Стартиране (когато не върви) */}
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
              cursor:  status?.unsynced === 0 ? 'not-allowed' : 'pointer',
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
              cursor:     'pointer',
              fontSize:   13,
            }}
          >
            ♻️ Full re-sync (обнови всички — имена, телефони, тагове)
          </button>
        </div>
      )}

      {/* Бутони: Стале или спиране (когато върви) */}
      {isRunning && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
          {stale && (
            <button
              onClick={() => runSync(job.all ?? false)}
              style={{
                ...styles.btn,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                cursor:     'pointer',
                fontSize:   12,
                padding:    '8px 20px',
              }}
            >
              ▶ Продължи от там
            </button>
          )}
          <button
            onClick={stop}
            disabled={stopping}
            style={{
              ...styles.btn,
              background: stopping ? '#1f2937' : '#374151',
              cursor:     stopping ? 'not-allowed' : 'pointer',
              fontSize:   12,
              padding:    '8px 20px',
              opacity:    stopping ? 0.7 : 1,
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
          {job.status === 'error' && (
            <p style={{ color: '#fca5a5', fontSize: 12, margin: '4px 0 0' }}>
              Натисни "Sync несинхронизирани" за да продължиш — вече sync-натите са запазени.
            </p>
          )}
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
