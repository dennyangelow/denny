'use client'
// app/admin/login/page.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/admin')
    } else {
      setError('Грешна парола')
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">🍅</div>
        <h1 className="login-title">Denny Angelow</h1>
        <p className="login-sub">Влез в Admin панела</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            type="password"
            className={`login-input${error ? ' error' : ''}`}
            placeholder="Парола"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-btn" disabled={loading || !password}>
            {loading ? 'Влизане...' : 'Влез →'}
          </button>
        </form>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .login-page {
          display: flex; align-items: center; justify-content: center;
          min-height: 100vh; background: #0f1f16;
          font-family: 'DM Sans', sans-serif;
        }
        .login-card {
          background: #fff; border-radius: 20px; padding: 40px 36px;
          width: 100%; max-width: 380px; text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,.4);
        }
        .login-logo { font-size: 40px; margin-bottom: 12px; }
        .login-title { font-size: 22px; font-weight: 700; color: #111; letter-spacing: -.02em; }
        .login-sub { font-size: 14px; color: #6b7280; margin-top: 4px; margin-bottom: 28px; }
        .login-form { display: flex; flex-direction: column; gap: 12px; }
        .login-input {
          width: 100%; padding: 12px 16px; border: 1.5px solid #e5e7eb;
          border-radius: 10px; font-family: inherit; font-size: 15px;
          transition: border-color .2s; outline: none;
        }
        .login-input:focus { border-color: #2d6a4f; }
        .login-input.error { border-color: #ef4444; }
        .login-error { font-size: 13px; color: #ef4444; text-align: left; }
        .login-btn {
          width: 100%; padding: 12px; background: #2d6a4f; color: #fff;
          border: none; border-radius: 10px; font-family: inherit; font-size: 15px;
          font-weight: 600; cursor: pointer; transition: opacity .2s;
        }
        .login-btn:hover:not(:disabled) { opacity: .88; }
        .login-btn:disabled { opacity: .5; cursor: default; }
      `}</style>
    </div>
  )
}
