'use client'
// components/marketing/LeadForm.tsx

import { useState } from 'react'

export function LeadForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source: 'naruchnik' }),
      })
      const data = await res.json()
      if (data.success || res.ok) {
        setDone(true)
      } else {
        setError('Нещо се обърка. Опитай отново.')
      }
    } catch {
      setError('Грешка при изпращане. Провери интернет връзката.')
    }
    setLoading(false)
  }

  if (done) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.15)',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: 16,
        padding: '20px 24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Изпратено!</div>
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>Провери имейла си — наръчникът е на път.</div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        type="text"
        placeholder="Твоето име"
        value={form.name}
        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
        style={inputStyle}
        onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#86efac' }}
        onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.25)' }}
      />
      <input
        type="email"
        placeholder="Имейл адрес *"
        required
        value={form.email}
        onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
        style={inputStyle}
        onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#86efac' }}
        onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.25)' }}
      />
      <input
        type="tel"
        placeholder="Телефон (по желание)"
        value={form.phone}
        onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
        style={inputStyle}
        onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#86efac' }}
        onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.25)' }}
      />
      {error && <div style={{ color: '#fca5a5', fontSize: 13 }}>{error}</div>}
      <button
        type="submit"
        disabled={loading}
        style={{
          background: loading ? 'rgba(134,239,172,0.5)' : 'linear-gradient(135deg,#4ade80,#22c55e)',
          color: '#052e16',
          border: 'none',
          borderRadius: 12,
          padding: '14px 20px',
          fontWeight: 900,
          fontSize: 15,
          cursor: loading ? 'default' : 'pointer',
          transition: 'all 0.2s',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {loading ? 'Изпращане...' : '📗 Изпрати ми наръчника безплатно'}
      </button>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textAlign: 'center', margin: 0 }}>
        🔒 Без спам · Само полезно агро съдържание
      </p>
    </form>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '13px 16px',
  borderRadius: 12,
  border: '1.5px solid rgba(255,255,255,0.25)',
  background: 'rgba(255,255,255,0.1)',
  color: '#fff',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s',
  backdropFilter: 'blur(8px)',
}
