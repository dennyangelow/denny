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
      if (res.ok) {
        setDone(true)
      } else {
        setError('Нещо се обърка. Опитай отново.')
      }
    } catch {
      setError('Грешка при изпращане.')
    }
    setLoading(false)
  }

  if (done) {
    return (
      <div style={{ background: 'rgba(74,222,128,0.15)', border: '1.5px solid rgba(74,222,128,0.4)', borderRadius: 16, padding: '22px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Изпратено успешно!</div>
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>Провери имейла си — наръчникът е на път.</div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .lead-input {
          width: 100%;
          padding: 13px 16px;
          border-radius: 12px;
          border: 1.5px solid rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.12);
          color: #fff;
          font-size: 14px;
          outline: none;
          font-family: inherit;
          transition: border-color 0.2s, background 0.2s;
          backdrop-filter: blur(8px);
          box-sizing: border-box;
        }
        .lead-input::placeholder {
          color: rgba(255,255,255,0.6);
        }
        .lead-input:focus {
          border-color: #86efac;
          background: rgba(255,255,255,0.18);
        }
        .lead-submit {
          width: 100%;
          background: linear-gradient(135deg, #4ade80, #22c55e);
          color: #052e16;
          border: none;
          border-radius: 12px;
          padding: 14px 20px;
          font-weight: 900;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 16px rgba(74,222,128,0.25);
        }
        .lead-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(74,222,128,0.35);
        }
        .lead-submit:disabled {
          opacity: 0.6;
          cursor: default;
        }
      `}</style>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          className="lead-input"
          type="text"
          placeholder="Твоето име"
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
        />
        <input
          className="lead-input"
          type="email"
          placeholder="Имейл адрес *"
          required
          value={form.email}
          onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
        />
        <input
          className="lead-input"
          type="tel"
          placeholder="Телефон (по желание)"
          value={form.phone}
          onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
        />
        {error && <div style={{ color: '#fca5a5', fontSize: 13 }}>{error}</div>}
        <button className="lead-submit" type="submit" disabled={loading}>
          {loading ? 'Изпращане...' : '📗 Изпрати ми наръчника безплатно'}
        </button>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textAlign: 'center', margin: 0 }}>
          🔒 Без спам · Само полезно агро съдържание
        </p>
      </form>
    </>
  )
}
