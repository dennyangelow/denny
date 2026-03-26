'use client'
// components/marketing/LeadForm.tsx — v2 с redirect към страница за сваляне

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  naruchnikSlug?: string  // default: 'super-domati'
  source?: string         // default: 'naruchnik'
}

export function LeadForm({ naruchnikSlug = 'super-domati', source = 'naruchnik' }: Props) {
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email) return
    setLoading(true)
    setError('')

    const params = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams()

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          source,
          naruchnik_slug: naruchnikSlug,
          utm_source: params.get('utm_source') || undefined,
          utm_campaign: params.get('utm_campaign') || undefined,
        }),
      })

      if (res.ok) {
        // Redirect to download page with name for personalisation
        const redirectParams = new URLSearchParams()
        if (form.name) redirectParams.set('name', form.name)
        redirectParams.set('email', form.email)
        router.push(`/naruchnik/${naruchnikSlug}?${redirectParams.toString()}`)
      } else {
        setError('Нещо се обърка. Опитай отново.')
        setLoading(false)
      }
    } catch {
      setError('Грешка при изпращане.')
      setLoading(false)
    }
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
        .lead-input::placeholder { color: rgba(255,255,255,0.6); }
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
        .lead-submit:disabled { opacity: 0.6; cursor: default; }
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
          {loading ? 'Изпращане...' : '📗 Изтегли наръчника безплатно'}
        </button>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textAlign: 'center', margin: 0 }}>
          🔒 Без спам · Само полезно агро съдържание
        </p>
      </form>
    </>
  )
}
