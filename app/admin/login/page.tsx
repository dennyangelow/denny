'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginContent() {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [noSecret, setNoSecret] = useState(false)
  
  const router = useRouter()
  const params = useSearchParams()
  const from = params.get('from') || '/admin'

  // Проверка за конфигуриран секрет
  useEffect(() => {
    fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '__check__' }),
    }).then(r => r.json()).then(d => {
      if (d.ok) setNoSecret(true)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (noSecret) router.replace(from)
  }, [noSecret, from, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim() || loading) return
    
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
      setError('Грешна парола. Опитайте отново.')
      setLoading(false)
      // Кратка вибрация или анимация може да се добави тук
    }
  }

  if (noSecret) return <div className="full-center"><div className="spinner" /></div>

  return (
    <div className="login-page">
      <style>{loginStyles}</style>
      
      <div className={`login-card ${error ? 'shake' : ''}`}>
        <div className="avatar">🍅</div>
        <h1>Админ Панел</h1>
        <p className="subtitle">Въведете вашия секретен ключ</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <span className="icon">🔑</span>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Парола..."
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              className={error ? 'input-error' : ''}
            />
            <button 
              type="button" 
              className="toggle-pass" 
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? '👁️' : '🙈'}
            </button>
          </div>

          {error && <div className="error-box">⚠️ {error}</div>}

          <button 
            type="submit" 
            className="submit-btn" 
            disabled={loading || !password.trim()}
          >
            {loading ? 'Проверка...' : 'Влез в системата'}
          </button>
        </form>

        <footer className="login-footer">
          Забравена парола? Проверете <code>.env</code> файла си.
        </footer>
      </div>
    </div>
  )
}

const loginStyles = `
  .login-page {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: radial-gradient(circle at top left, #14532d, #064e3b, #022c22);
    padding: 20px; font-family: 'DM Sans', sans-serif;
  }
  .login-card {
    background: white; padding: 40px; border-radius: 28px; width: 100%; max-width: 400px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); text-align: center;
  }
  .avatar { font-size: 50px; margin-bottom: 10px; }
  h1 { font-size: 24px; font-weight: 800; color: #111827; margin-bottom: 4px; }
  .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 30px; }
  
  .input-group { position: relative; margin-bottom: 16px; }
  .input-group input {
    width: 100%; padding: 14px 45px; border-radius: 14px; border: 2px solid #f3f4f6;
    background: #f9fafb; font-size: 16px; transition: all 0.2s; outline: none;
  }
  .input-group input:focus { border-color: #10b981; background: white; }
  .input-group .icon { position: absolute; left: 15px; top: 14px; font-size: 20px; }
  .toggle-pass { position: absolute; right: 15px; top: 14px; background: none; border: none; cursor: pointer; opacity: 0.5; }
  
  .submit-btn {
    width: 100%; padding: 14px; border-radius: 14px; border: none;
    background: #059669; color: white; font-weight: 700; font-size: 16px;
    cursor: pointer; transition: 0.2s; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
  }
  .submit-btn:hover:not(:disabled) { background: #047857; transform: translateY(-1px); }
  .submit-btn:disabled { background: #d1d5db; box-shadow: none; cursor: not-allowed; }
  
  .error-box { background: #fef2f2; color: #dc2626; padding: 12px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; border: 1px solid #fee2e2; }
  .login-footer { margin-top: 24px; color: #9ca3af; font-size: 12px; }
  
  .shake { animation: shake 0.4s ease-in-out; }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-8px); }
    75% { transform: translateX(8px); }
  }
  .spinner { width: 30px; height: 30px; border: 3px solid #10b981; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`

export default function AdminLogin() {
  return (
    <Suspense fallback={<div className="full-center"><div className="spinner" /></div>}>
      <LoginContent />
    </Suspense>
  )
}