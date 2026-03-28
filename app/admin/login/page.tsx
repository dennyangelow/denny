'use client'
// app/admin/login/page.tsx

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginContent() {
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [noSecret, setNoSecret] = useState(false)
  const [lockout, setLockout]   = useState(0)
  const router = useRouter()
  const params = useSearchParams()
  const from   = params.get('from') || '/admin'

  // Проверява дали ADMIN_SECRET е зададен — ако не е, директно пуска
  useEffect(() => {
    fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '__check__' }),
    })
      .then(r => r.json())
      .then(d => { if (d.ok) setNoSecret(true) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (noSecret) router.replace(from)
  }, [noSecret, from, router])

  // Countdown за lockout
  useEffect(() => {
    if (lockout <= 0) return
    const t = setInterval(() => setLockout(l => {
      if (l <= 1) clearInterval(t)
      return l - 1
    }), 1000)
    return () => clearInterval(t)
  }, [lockout])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim() || lockout > 0) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.replace(from)
    } else {
      const data = await res.json()
      if (res.status === 429) {
        setLockout(900)
        setError(data.error || 'Твърде много опити. Изчакай.')
      } else {
        setError(data.error || 'Грешна парола.')
      }
      setLoading(false)
    }
  }

  if (noSecret) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f1f16', fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ color: '#86efac', fontSize: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 24, height: 24, border: '3px solid rgba(134,239,172,0.3)', borderTopColor: '#86efac', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
        Пренасочване...
      </div>
    </div>
  )

  const isDisabled = !password.trim() || loading || lockout > 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(135deg,#0c3a1c,#0f1f16)', fontFamily: "'DM Sans',sans-serif", padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: '44px 40px', width: '100%', maxWidth: 400, textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🍅</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', letterSpacing: '-.02em', marginBottom: 4 }}>Denny Angelow</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 32 }}>Admin панел</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <input
              type="password"
              placeholder="Въведи паролата"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              disabled={lockout > 0}
              style={{
                width: '100%',
                padding: '14px 16px',
                paddingLeft: 44,
                border: `1.5px solid ${error ? '#ef4444' : '#e5e7eb'}`,
                borderRadius: 12,
                fontSize: 15,
                outline: 'none',
                fontFamily: 'inherit',
                color: '#111',
                background: '#fafafa',
                transition: 'border-color .2s',
                boxSizing: 'border-box',
              }}
              onFocus={e => { if (!error) e.target.style.borderColor = '#2d6a4f' }}
              onBlur={e => { if (!error) e.target.style.borderColor = '#e5e7eb' }}
            />
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, pointerEvents: 'none' }}>🔑</span>
          </div>

          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#991b1b', textAlign: 'left', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span>⚠️</span>
              <div>
                <div>{error}</div>
                {lockout > 0 && (
                  <div style={{ fontSize: 12, marginTop: 4, fontWeight: 700 }}>
                    Изчакай: {Math.floor(lockout / 60)}:{String(lockout % 60).padStart(2, '0')}
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isDisabled}
            style={{
              background: isDisabled ? '#d1d5db' : 'linear-gradient(135deg,#2d6a4f,#16a34a)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '14px',
              fontWeight: 800,
              fontSize: 16,
              cursor: isDisabled ? 'default' : 'pointer',
              fontFamily: 'inherit',
              transition: 'all .2s',
            }}
          >
            {loading ? 'Влизане...' : lockout > 0 ? `Изчакай ${lockout}с` : 'Влез в Admin →'}
          </button>
        </form>

        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 20, lineHeight: 1.5 }}>
          Паролата се задава чрез{' '}
          <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>ADMIN_SECRET</code>{' '}
          в Vercel
        </p>
      </div>

      {/* suppressHydrationWarning — предотвратява hydration грешка от @keyframes */}
      <style suppressHydrationWarning>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f1f16' }}>
      <div style={{ width: 32, height: 32, border: '3px solid rgba(134,239,172,0.3)', borderTopColor: '#86efac', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
      <style suppressHydrationWarning>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default function AdminLogin() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LoginContent />
    </Suspense>
  )
}
