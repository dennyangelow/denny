'use client'
// app/admin/login/page.tsx

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginContent() {
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [noSecret, setNoSecret] = useState(false)
  const router = useRouter()
  const params = useSearchParams()
  const from = params.get('from') || '/admin'

  // Check if ADMIN_SECRET is configured by trying with empty password
  useEffect(() => {
    fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '__check__' }),
    }).then(r => r.json()).then(d => {
      if (d.ok) setNoSecret(true)
    }).catch(() => {})
  }, [])

  // If no secret configured, auto-redirect
  useEffect(() => {
    if (noSecret) {
      router.replace(from)
    }
  }, [noSecret, from, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return
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
      setError('Грешна парола. Провери ADMIN_SECRET в Vercel.')
      setLoading(false)
    }
  }

  if (noSecret) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#0f1f16', fontFamily:"'DM Sans',sans-serif" }}>
        <div style={{ color:'#86efac', fontSize:16, display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:24, height:24, border:'3px solid rgba(134,239,172,0.3)', borderTopColor:'#86efac', borderRadius:'50%', animation:'spin .6s linear infinite' }} />
          Пренасочване към Admin...
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'linear-gradient(135deg,#0c3a1c,#0f1f16)', fontFamily:"'DM Sans',sans-serif", padding:'20px' }}>
      <div style={{ background:'#fff', borderRadius:24, padding:'44px 40px', width:'100%', maxWidth:400, textAlign:'center', boxShadow:'0 24px 80px rgba(0,0,0,0.5)' }}>
        {/* Logo */}
        <div style={{ fontSize:44, marginBottom:12 }}>🍅</div>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#111', letterSpacing:'-.02em', marginBottom:4 }}>Denny Angelow</h1>
        <p style={{ fontSize:13, color:'#6b7280', marginBottom:32 }}>Admin панел</p>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ position:'relative' }}>
            <input
              type="password"
              placeholder="Въведи паролата"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              style={{
                width:'100%', padding:'14px 16px', paddingLeft:44,
                border:`1.5px solid ${error ? '#ef4444' : '#e5e7eb'}`,
                borderRadius:12, fontSize:15, outline:'none',
                fontFamily:'inherit', color:'#111', background:'#fafafa',
                transition:'border-color .2s', boxSizing:'border-box',
              }}
              onFocus={e => { if (!error) (e.target as HTMLInputElement).style.borderColor = '#2d6a4f' }}
              onBlur={e => { if (!error) (e.target as HTMLInputElement).style.borderColor = '#e5e7eb' }}
            />
            <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:18, pointerEvents:'none' }}>🔑</span>
          </div>

          {error && (
            <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#991b1b', textAlign:'left', display:'flex', gap:8, alignItems:'flex-start' }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            style={{
              background: (!password.trim() || loading) ? '#d1d5db' : 'linear-gradient(135deg,#2d6a4f,#16a34a)',
              color:'#fff', border:'none', borderRadius:12,
              padding:'14px', fontWeight:800, fontSize:16,
              cursor: (!password.trim() || loading) ? 'default' : 'pointer',
              fontFamily:'inherit', transition:'all .2s',
              boxShadow: password.trim() ? '0 4px 16px rgba(22,163,74,0.3)' : 'none',
            }}
          >
            {loading ? 'Влизане...' : 'Влез в Admin →'}
          </button>
        </form>

        <p style={{ fontSize:12, color:'#9ca3af', marginTop:20, lineHeight:1.5 }}>
          Паролата се задава чрез <code style={{ background:'#f3f4f6', padding:'2px 6px', borderRadius:4, fontSize:11 }}>ADMIN_SECRET</code> в Vercel Environment Variables
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default function AdminLogin() {
  return (
    <Suspense fallback={
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#0f1f16' }}>
        <div style={{ width:32, height:32, border:'3px solid rgba(134,239,172,0.3)', borderTopColor:'#86efac', borderRadius:'50%', animation:'spin .6s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
