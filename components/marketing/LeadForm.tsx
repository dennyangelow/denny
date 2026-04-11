'use client'
// components/marketing/LeadForm.tsx — v2
// ПОПРАВКИ v2:
//   1. Валидация чрез споделената lib/validation.ts
//   2. Inline грешки под всяко поле (показват се след blur)
//   3. Бутонът е disabled докато не са попълнени правилно задължителните полета
//   4. Стиловете и структурата са запазени

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { validateName, validateEmail, validatePhone } from '@/lib/validation'

/** * Интерфейси за сигурност на данните 
 */
interface Naruchnik {
  id: string
  slug: string
  title: string
  subtitle: string
  cover_image_url: string
  category: string
}

interface LeadFormProps {
  naruchnikSlug?: string
  source?: string
  showSelector?: boolean
}

export function LeadForm({ 
  naruchnikSlug, 
  source = 'marketing_page', 
  showSelector = false 
}: LeadFormProps) {
  
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [naruchnici, setNaruchnici] = useState<Naruchnik[]>([])
  const [selectedSlug, setSelectedSlug] = useState(naruchnikSlug || '')
  const [touched, setTouched] = useState({ name: false, email: false, phone: false })

  // Изчислени грешки
  const nameErr  = validateName(form.name)
  const emailErr = validateEmail(form.email)
  // Телефонът е по желание в LeadForm — валидираме само ако е попълнен
  const phoneErr = form.phone.trim() ? validatePhone(form.phone) : ''
  const isValid  = !nameErr && !emailErr && !phoneErr

  const touch = (f: keyof typeof touched) => setTouched(t => ({ ...t, [f]: true }))

  const handlePhoneChange = (raw: string) => {
    const clean = raw.replace(/[^0-9+\s\-().]/g, '')
    setForm(p => ({ ...p, phone: clean }))
  }

  const router = useRouter()

  // Зареждане на наръчниците
  useEffect(() => {
    const loadNaruchnici = async () => {
      try {
        const res = await fetch('/api/naruchnici')
        const data = await res.json()
        const list: Naruchnik[] = data.naruchnici || []
        setNaruchnici(list)
        
        // Ако нямаме зададен slug, избираме първия наличен
        if (!naruchnikSlug && list.length > 0) {
          setSelectedSlug(list[0].slug)
        }
      } catch (err) {
        console.error("Failed to load naruchnici", err)
      }
    }

    loadNaruchnici()
  }, [naruchnikSlug])

  // По-сигурно извличане на UTM параметри
  const utmParams = useMemo(() => {
    if (typeof window === 'undefined') return {}
    const p = new URLSearchParams(window.location.search)
    return {
      utm_source: p.get('utm_source') || undefined,
      utm_campaign: p.get('utm_campaign') || undefined,
      utm_medium: p.get('utm_medium') || undefined
    }
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
        body: JSON.stringify({
          name:           form.name.trim(),
          email:          form.email.trim().toLowerCase(),
          phone:          form.phone.trim(),
          source,
          naruchnik_slug: selectedSlug,
          ...utmParams
        }),
      })

      const data = await res.json()

      if (res.ok) {
        const params = new URLSearchParams({ 
          email: form.email, 
          name: form.name,
          new_lead: 'true' 
        })
        router.push(`/naruchnik/${selectedSlug}?${params.toString()}`)
      } else {
        throw new Error(data.error || 'Възникна грешка')
      }
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="lead-form-container">
      <form onSubmit={handleSubmit} className="lead-form-base">
        
        {/* Секция за избор на наръчник (ако е активна) */}
        {showSelector && naruchnici.length > 0 && (
          <div className="selector-section">
            <label className="section-label">Избери твоя подарък:</label>
            <div className="naruchnik-grid">
              {naruchnici.map(n => (
                <button
                  key={n.slug}
                  type="button"
                  className={`nar-card ${selectedSlug === n.slug ? 'active' : ''}`}
                  onClick={() => setSelectedSlug(n.slug)}
                >
                  <div className="nar-card-content">
                    <div className="img-container">
                      {n.cover_image_url ? (
                        <img src={n.cover_image_url} alt={n.title} />
                      ) : (
                        <span className="emoji-icon">📗</span>
                      )}
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

        {/* Полета за вход */}
        <div className="inputs-group">
          <div className="input-wrapper">
            <input 
              className="lead-field" 
              type="text" 
              placeholder="Твоето име *"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              onBlur={() => touch('name')}
              style={{ borderColor: touched.name && nameErr ? '#f87171' : touched.name && !nameErr ? '#4ade80' : undefined }}
            />
            {touched.name && nameErr && (
              <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 4, paddingLeft: 4 }}>⚠ {nameErr}</div>
            )}
          </div>

          <div className="input-wrapper">
            <input 
              className="lead-field" 
              type="email" 
              placeholder="Имейл адрес *" 
              required
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              onBlur={() => touch('email')}
              style={{ borderColor: touched.email && emailErr ? '#f87171' : touched.email && !emailErr ? '#4ade80' : undefined }}
            />
            {touched.email && emailErr && (
              <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 4, paddingLeft: 4 }}>⚠ {emailErr}</div>
            )}
          </div>

          <div className="input-wrapper">
            <input 
              className="lead-field" 
              type="tel" 
              placeholder="Телефон (по желание)"
              value={form.phone}
              onChange={e => handlePhoneChange(e.target.value)}
              onBlur={() => touch('phone')}
              style={{ borderColor: touched.phone && phoneErr ? '#f87171' : touched.phone && form.phone && !phoneErr ? '#4ade80' : undefined }}
            />
            {touched.phone && phoneErr && (
              <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 4, paddingLeft: 4 }}>⚠ {phoneErr}</div>
            )}
          </div>
        </div>

        {/* Съобщения за грешка */}
        {error && <div className="error-bubble">{error}</div>}

        {/* Бутон за изпращане */}
        <button className="submit-action" type="submit" disabled={loading || !isValid}>
          {loading ? (
            <span className="loader" />
          ) : (
            <span className="btn-text">📗 Вземи наръчника безплатно</span>
          )}
        </button>

        <p className="privacy-note">
           🔒 Твоите данни са защитени. Само ценни съвети.
        </p>
      </form>

      <style jsx>{`
        .lead-form-container { width: 100%; max-width: 480px; margin: 0 auto; }
        .lead-form-base { display: flex; flex-direction: column; gap: 16px; }
        
        /* Inputs Stylings */
        .lead-field {
          width: 100%;
          padding: 14px 18px;
          border-radius: 14px;
          border: 1.5px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.08);
          color: #fff;
          font-size: 15px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(12px);
          outline: none;
        }
        .lead-field:focus {
          border-color: #4ade80;
          background: rgba(255,255,255,0.12);
          box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.1);
        }

        /* Selector Styling */
        .section-label {
          display: block;
          color: rgba(255,255,255,0.7);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 12px;
        }
        .nar-card {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1.5px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 10px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.25s;
          text-align: left;
        }
        .nar-card.active {
          border-color: #4ade80;
          background: rgba(74, 222, 128, 0.08);
        }
        .nar-card-content { display: flex; align-items: center; gap: 12px; position: relative; }
        .img-container img { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; }
        .emoji-icon { font-size: 24px; width: 44px; text-align: center; display: block; }
        
        .text-container { flex: 1; display: flex; flex-direction: column; }
        .text-container .title { color: #fff; font-size: 14px; font-weight: 700; }
        .text-container .category { color: rgba(255,255,255,0.5); font-size: 11px; }

        .check-indicator {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.2);
          position: relative;
        }
        .nar-card.active .check-indicator {
          background: #4ade80;
          border-color: #4ade80;
        }
        .nar-card.active .check-indicator::after {
          content: '✓';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #052e16;
          font-weight: 900;
          font-size: 12px;
        }

        /* Button Styling */
        .submit-action {
          width: 100%;
          padding: 16px;
          border-radius: 14px;
          border: none;
          background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
          color: #052e16;
          font-weight: 800;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 25px -5px rgba(34, 197, 94, 0.4);
        }
        .submit-action:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 15px 30px -5px rgba(34, 197, 94, 0.5);
          filter: brightness(1.05);
        }
        .submit-action:disabled { opacity: 0.7; cursor: not-allowed; }

        /* Loader Animation */
        .loader {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(5, 46, 22, 0.2);
          border-top: 3px solid #052e16;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .error-bubble {
          background: rgba(239, 68, 68, 0.15);
          color: #fca5a5;
          padding: 12px;
          border-radius: 10px;
          font-size: 13px;
          text-align: center;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .privacy-note {
          color: rgba(255,255,255,0.4);
          font-size: 11px;
          text-align: center;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}