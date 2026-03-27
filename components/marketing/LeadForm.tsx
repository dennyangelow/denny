'use client'
// components/marketing/LeadForm.tsx — v4

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Naruchnik {
  id: string
  slug: string
  title: string
  subtitle: string
  cover_image_url: string
  category: string
  sort_order: number
}

interface Props {
  naruchnikSlug?: string
  source?: string
  showSelector?: boolean
}

export function LeadForm({ naruchnikSlug, source = 'naruchnik', showSelector = false }: Props) {
  const [form, setForm]             = useState({ name: '', email: '', phone: '' })
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [naruchnici, setNaruchnici] = useState<Naruchnik[]>([])
  const [selectedSlug, setSelectedSlug] = useState(naruchnikSlug || 'super-domati')
  const router = useRouter()

  useEffect(() => {
    if (!showSelector && naruchnikSlug) return
    fetch('/api/naruchnici')
      .then(r => r.json())
      .then(d => {
        const list: Naruchnik[] = d.naruchnici || []
        setNaruchnici(list)
        if (!naruchnikSlug && list.length > 0) setSelectedSlug(list[0].slug)
      })
      .catch(() => {})
  }, [naruchnikSlug, showSelector])

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
          name:           form.name,
          email:          form.email,
          phone:          form.phone || undefined,
          source,
          naruchnik_slug: selectedSlug,
          utm_source:     params.get('utm_source')   || undefined,
          utm_campaign:   params.get('utm_campaign') || undefined,
        }),
      })

      if (res.ok) {
        const redirectParams = new URLSearchParams()
        if (form.name) redirectParams.set('name', form.name)
        redirectParams.set('email', form.email)
        router.push(`/naruchnik/${selectedSlug}?${redirectParams.toString()}`)
      } else {
        const data = await res.json()
        setError(data.error || 'Нещо се обърка. Опитай отново.')
        setLoading(false)
      }
    } catch {
      setError('Грешка при изпращане. Провери интернет връзката.')
      setLoading(false)
    }
  }

  const hasMultiple = naruchnici.length > 1 && showSelector

  return (
    <>
      <style>{`
        .lead-input{width:100%;padding:13px 16px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.12);color:#fff;font-size:14px;outline:none;font-family:inherit;transition:border-color .2s,background .2s;backdrop-filter:blur(8px);box-sizing:border-box}
        .lead-input::placeholder{color:rgba(255,255,255,0.6)}
        .lead-input:focus{border-color:#86efac;background:rgba(255,255,255,0.18)}
        .lead-submit{width:100%;background:linear-gradient(135deg,#4ade80,#22c55e);color:#052e16;border:none;border-radius:12px;padding:14px 20px;font-weight:900;font-size:15px;cursor:pointer;transition:all .2s;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 16px rgba(74,222,128,0.25)}
        .lead-submit:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 20px rgba(74,222,128,0.35)}
        .lead-submit:disabled{opacity:.6;cursor:default}
        .nar-option{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;cursor:pointer;border:1.5px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);transition:all .2s;margin-bottom:8px}
        .nar-option.selected{border-color:#86efac;background:rgba(134,239,172,0.15)}
        .nar-option img{width:40px;height:40px;border-radius:6px;object-fit:cover;flex-shrink:0}
        .nar-check{width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s}
        .nar-option.selected .nar-check{background:#4ade80;border-color:#4ade80}
      `}</style>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {hasMultiple && (
          <div>
            <p style={{ color: 'rgba(255,255,255,.8)', fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Избери наръчник:
            </p>
            {naruchnici.map(n => (
              <div key={n.slug} className={`nar-option${selectedSlug === n.slug ? ' selected' : ''}`} onClick={() => setSelectedSlug(n.slug)}>
                {n.cover_image_url
                  ? <img src={n.cover_image_url} alt={n.title} />
                  : <span style={{ fontSize: 28 }}>📗</span>
                }
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{n.title}</div>
                  {n.subtitle && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>{n.subtitle}</div>}
                </div>
                <div className="nar-check">
                  {selectedSlug === n.slug && <span style={{ color: '#052e16', fontSize: 10, fontWeight: 900 }}>✓</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        <input className="lead-input" type="text" placeholder="Твоето име" value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <input className="lead-input" type="email" placeholder="Имейл адрес *" required value={form.email}
          onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
        <input className="lead-input" type="tel" placeholder="Телефон (по желание)" value={form.phone}
          onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />

        {error && <div style={{ color: '#fca5a5', fontSize: 13, background: 'rgba(239,68,68,.15)', borderRadius: 8, padding: '8px 12px' }}>{error}</div>}

        <button className="lead-submit" type="submit" disabled={loading}>
          {loading ? (
            <>
              <div style={{ width: 16, height: 16, border: '2px solid rgba(5,46,22,.3)', borderTopColor: '#052e16', borderRadius: '50%', animation: 'lead-spin .6s linear infinite' }} />
              Изпраща...
            </>
          ) : '📗 Изтегли наръчника безплатно'}
        </button>
        <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 11, textAlign: 'center', margin: 0 }}>
          🔒 Без спам · Само полезно агро съдържание
        </p>
      </form>
      <style>{`@keyframes lead-spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
