'use client'
// app/admin/components/SystemeioSyncPanel.tsx — v2

import { useState, useEffect } from 'react'

interface SyncStatus {
  unsynced:      number
  total:         number
  invalidEmails: number
}

interface SyncResult {
  success:  boolean
  total:    number
  synced:   number
  failed:   number
  invalid?: number
  errors?:  string[]
  message?: string
  invalidEmail?: boolean
}

export function SystemeioSyncPanel() {
  const [status,  setStatus]  = useState<SyncStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<SyncResult | null>(null)

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
    setResult(null)
    try {
      const res  = await fetch(`/api/leads/sync${all ? '?all=true' : ''}`, { method: 'POST' })
      const data = await res.json()
      setResult(data)
      fetchStatus()
    } catch (err: any) {
      setResult({ success: false, total: 0, synced: 0, failed: 0, message: err.message })
    } finally {
      setLoading(false)
    }
  }

  const synced = status ? status.total - status.unsynced - (status.invalidEmails ?? 0) : 0

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={{ fontSize: 20 }}>🔄</span>
        <h3 style={styles.title}>Systeme.io Синхронизация</h3>
      </div>

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

          {status.invalidEmails > 0 && (
            <div style={{ ...styles.stat, borderColor: '#ef4444', gridColumn: '1 / -1' }}>
              <span style={{ ...styles.statNum, color: '#ef4444', fontSize: 18 }}>
                ⚠️ {status.invalidEmails}
              </span>
              <span style={styles.statLabel}>Невалидни имейли (пропуснати от Systeme.io)</span>
            </div>
          )}
        </div>
      )}

      <div style={styles.actions}>
        <button
          onClick={() => runSync(false)}
          disabled={loading || status?.unsynced === 0}
          style={{
            ...styles.btn,
            background: status?.unsynced === 0
              ? '#374151'
              : 'linear-gradient(135deg, #f59e0b, #d97706)',
            opacity: loading ? 0.7 : 1,
            cursor:  loading || status?.unsynced === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {loading
            ? '⏳ Синхронизиране...'
            : `🔄 Sync несинхронизирани (${status?.unsynced ?? '...'})`}
        </button>

        <button
          onClick={() => runSync(true)}
          disabled={loading}
          style={{
            ...styles.btn,
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            opacity: loading ? 0.7 : 1,
            cursor:  loading ? 'not-allowed' : 'pointer',
            fontSize: 13,
          }}
        >
          ♻️ Full re-sync (всички валидни)
        </button>
      </div>

      {result && (
        <div style={{
          ...styles.result,
          borderColor: result.success && result.failed === 0 ? '#22c55e' : '#f59e0b',
          background:  result.success && result.failed === 0
            ? 'rgba(34,197,94,0.08)'
            : 'rgba(245,158,11,0.08)',
        }}>
          {result.message ? (
            <p style={{ color: result.invalidEmail ? '#f87171' : '#22c55e', margin: 0 }}>
              {result.invalidEmail ? '⚠️' : '✅'} {result.message}
            </p>
          ) : (
            <>
              <p style={{ color: '#e5e7eb', margin: '0 0 8px', fontWeight: 700 }}>
                {result.success ? '✅' : '❌'} Резултат: {result.synced}/{result.total} успешни
                {result.failed  > 0 && ` · ${result.failed} грешки`}
                {(result.invalid ?? 0) > 0 && ` · ${result.invalid} невалидни имейли`}
              </p>
              {result.errors && result.errors.length > 0 && (
                <div style={styles.errorList}>
                  {result.errors.slice(0, 5).map((e, i) => (
                    <p key={i} style={{ color: '#fca5a5', fontSize: 12, margin: '2px 0' }}>⚠️ {e}</p>
                  ))}
                  {result.errors.length > 5 && (
                    <p style={{ color: '#9ca3af', fontSize: 12 }}>
                      ...и още {result.errors.length - 5} грешки
                    </p>
                  )}
                </div>
              )}
            </>
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
    display:      'flex',
    alignItems:   'center',
    gap:          10,
    marginBottom: 20,
  },
  title: {
    margin: 0, color: '#fff', fontSize: 16, fontWeight: 700,
  },
  statusRow: {
    display:             'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap:                 12,
    marginBottom:        20,
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
  statNum: {
    fontSize: 24, fontWeight: 800, color: '#fff',
  },
  statLabel: {
    fontSize: 11, color: 'rgba(255,255,255,0.5)',
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
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid rgba(255,255,255,0.1)',
  },
}
