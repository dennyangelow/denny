'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { validateName, validateEmail, validatePhone } from '@/lib/validation'

interface Naruchnik { id: string; slug: string; title: string; subtitle: string; cover_image_url: string; category: string }
interface LeadFormProps { naruchnikSlug?: string; source?: string; showSelector?: boolean }

export function LeadForm({ naruchnikSlug, source = 'marketing_page', showSelector = false }: LeadFormProps) {
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [naruchnici, setNaruchnici] = useState<Naruchnik[]>([])
  const [selectedSlug, setSelectedSlug] = useState(naruchnikSlug || '')
  const [touched, setTouched] = useState({ name: false, email: false, phone: false })

  const nameErr  = validateName(form.name)
  const emailErr = validateEmail(form.email)
  const phoneErr = form.phone.trim() ? validatePhone(form.phone) : ''
  const isValid  = !nameErr && !emailErr && !phoneErr

  const touch = (f: keyof typeof touched) => setTouched(t => ({ ...t, [f]: true }))

  const handleEmailChange = (raw: string) => {
    // ВАЖНО: НЕ strip-ваме символите — validateEmail ги хваща и показва грешка
    // Предишното strip-ване правеше "садас@абж.бр" → "@." → минаваше валидацията!
    setForm(p => ({ ...p, email: raw }))
    touch('email')
  }

  const handlePhoneChange = (raw: string) => {
    const clean = raw.replace(/[^0-9+\s\-().]/g, '')
    setForm(p => ({ ...p, phone: clean }))
    touch('phone')
  }

  const router = useRouter()

  useEffect(() => {
    fetch('/api/naruchnici').then(r => r.json()).then(data => {
      const list: Naruchnik[] = data.naruchnici || []
      setNaruchnici(list)
      if (!naruchnikSlug && list.length > 0) setSelectedSlug(list[0].slug)
    }).catch(console.error)
  }, [naruchnikSlug])

  const utmParams = useMemo(() => {
    if (typeof window === 'undefined') return {}
    const p = new URLSearchParams(window.location.search)
    return { utm_source: p.get('utm_source') || undefined, utm_campaign: p.get('utm_campaign') || undefined, utm_medium: p.get('utm_medium') || undefined }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ name: true, email: true, phone: true })
    if (!form.email || !selectedSlug || !isValid) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim(), source, naruchnik_slug: selectedSlug, ...utmParams }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/naruchnik/${selectedSlug}?${new URLSearchParams({ email: form.email, name: form.name, new_lead: 'true' }).toString()}`)
      } else {
        setError(data.error || 'Възникна грешка')
        setLoading(false)
      }
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const bc = (err: string, t: boolean) => t && err ? '#f87171' : t && !err ? '#4ade80' : undefined

  return (
    <div className="lead-form-container">
      <form onSubmit={handleSubmit} className="lead-form-base">
        {showSelector && naruchnici.length > 0 && (
          <div className="selector-section">
            <label className="section-label">Избери твоя подарък:</label>
            <div className="naruchnik-grid">
              {naruchnici.map(n => (
                <button key={n.slug} type="button" className={`nar-card ${selectedSlug === n.slug ? 'active' : ''}`} onClick={() => setSelectedSlug(n.slug)}>
                  <div className="nar-card-content">
                    <div className="img-container">
                      {n.cover_image_url ? <img src={n.cover_image_url} alt={n.title} /> : <span className="emoji-icon">📗</span>}
                    </div>
                    <div className="text-container">
                      <span className="title">{n.title}</span>
                      <span className="category">{n.category}</span>
                    </div>
                    <div className="check-indicator" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="inputs-group">
          <div className="input-wrapper">
            <input className="lead-field" type="text" placeholder="Твоето име *"
              value={form.name}
              onChange={e => { setForm(p => ({ ...p, name: e.target.value })); touch('name') }}
              onBlur={() => touch('name')}
              style={{ borderColor: bc(nameErr, touched.name) }}
            />
            {touched.name && nameErr && <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 4, paddingLeft: 4 }}>⚠ {nameErr}</div>}
          </div>

          <div className="input-wrapper">
            <input className="lead-field" type="text" placeholder="Имейл адрес *"
              value={form.email}
              onChange={e => handleEmailChange(e.target.value)}
              onBlur={() => touch('email')}
              onPaste={e => { e.preventDefault(); handleEmailChange(e.clipboardData.getData('text')) }}
              spellCheck={false} autoCapitalize="none" autoCorrect="off"
              style={{ borderColor: bc(emailErr, touched.email) }}
            />
            {touched.email && emailErr && <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 4, paddingLeft: 4 }}>⚠ {emailErr}</div>}
          </div>

          <div className="input-wrapper">
            <input className="lead-field" type="tel" placeholder="Телефон (по желание)"
              value={form.phone}
              onChange={e => handlePhoneChange(e.target.value)}
              onBlur={() => touch('phone')}
              onKeyDown={e => { if (e.key.length === 1 && /[a-zA-Z\u0400-\u04FF]/.test(e.key)) e.preventDefault() }}
              onPaste={e => { e.preventDefault(); handlePhoneChange(e.clipboardData.getData('text')) }}
              style={{ borderColor: bc(phoneErr, touched.phone) }}
            />
            {touched.phone && phoneErr && <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 4, paddingLeft: 4 }}>⚠ {phoneErr}</div>}
          </div>
        </div>

        {error && <div className="error-bubble">{error}</div>}

        <button className="submit-action" type="submit" disabled={loading || !isValid}>
          {loading ? <span className="loader" /> : <span className="btn-text">📗 Вземи наръчника безплатно</span>}
        </button>

        <p className="privacy-note">🔒 Твоите данни са защитени. Само ценни съвети.</p>
      </form>

      <style jsx>{`
        .lead-form-container { width: 100%; max-width: 480px; margin: 0 auto; }
        .lead-form-base { display: flex; flex-direction: column; gap: 16px; }
        .lead-field { width: 100%; padding: 14px 18px; border-radius: 14px; border: 1.5px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.08); color: #fff; font-size: 15px; transition: all 0.3s; backdrop-filter: blur(12px); outline: none; box-sizing: border-box; }
        .lead-field:focus { border-color: #4ade80; background: rgba(255,255,255,0.12); box-shadow: 0 0 0 4px rgba(74,222,128,0.1); }
        .section-label { display: block; color: rgba(255,255,255,0.7); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; }
        .nar-card { width: 100%; background: rgba(255,255,255,0.05); border: 1.5px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 10px; margin-bottom: 8px; cursor: pointer; transition: all 0.25s; text-align: left; }
        .nar-card.active { border-color: #4ade80; background: rgba(74,222,128,0.08); }
        .nar-card-content { display: flex; align-items: center; gap: 12px; position: relative; }
        .img-container img { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; }
        .emoji-icon { font-size: 24px; width: 44px; text-align: center; display: block; }
        .text-container { flex: 1; display: flex; flex-direction: column; }
        .text-container .title { color: #fff; font-size: 14px; font-weight: 700; }
        .text-container .category { color: rgba(255,255,255,0.5); font-size: 11px; }
        .check-indicator { width: 20px; height: 20px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.2); position: relative; }
        .nar-card.active .check-indicator { background: #4ade80; border-color: #4ade80; }
        .nar-card.active .check-indicator::after { content: 'v'; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); color: #052e16; font-weight: 900; font-size: 12px; }
        .submit-action { width: 100%; padding: 16px; border-radius: 14px; border: none; background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); color: #052e16; font-weight: 800; font-size: 16px; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 25px -5px rgba(34,197,94,0.4); }
        .submit-action:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 15px 30px -5px rgba(34,197,94,0.5); filter: brightness(1.05); }
        .submit-action:disabled { opacity: 0.7; cursor: not-allowed; }
        .loader { width: 20px; height: 20px; border: 3px solid rgba(5,46,22,0.2); border-top: 3px solid #052e16; border-radius: 50%; animation: spin 0.8s linear infinite; }
        .error-bubble { background: rgba(239,68,68,0.15); color: #fca5a5; padding: 12px; border-radius: 10px; font-size: 13px; text-align: center; border: 1px solid rgba(239,68,68,0.2); }
        .privacy-note { color: rgba(255,255,255,0.4); font-size: 11px; text-align: center; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}