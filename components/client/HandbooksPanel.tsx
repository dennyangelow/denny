'use client'

// components/client/HandbooksPanel.tsx

import { useState, useEffect } from 'react'

interface Handbook {
  slug: string; title: string; subtitle: string
  emoji: string; color: string; image_url?: string; bg: string; badge: string
}

function validateName(v: string) {
  if (!v.trim()) return 'Името е задължително'
  if (v.trim().length < 2) return 'Въведи поне 2 символа'
  return ''
}
function validateEmail(v: string) {
  if (!v.trim()) return 'Имейлът е задължителен'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'Невалиден имейл адрес'
  return ''
}
function validatePhone(v: string) {
  if (!v.trim()) return 'Телефонът е задължителен'
  if (v.replace(/\D/g, '').length < 9) return 'Въведи валиден телефон'
  return ''
}

function randomDownloads() {
  return Math.floor(Math.random() * 40 + 10)
}

const SOCIAL_NAMES = ['Мария от Пловдив', 'Георги от Варна', 'Петя от София', 'Христо от Бургас', 'Елена от Стара Загора', 'Димитър от Русе']

export function HandbooksPanel({ handbooks }: { handbooks: Handbook[] }) {
  const [selectedSlug, setSelectedSlug]   = useState<string | null>(null)
  const [hbName, setHbName]               = useState('')
  const [hbEmail, setHbEmail]             = useState('')
  const [hbPhone, setHbPhone]             = useState('')
  const [touched, setTouched]             = useState({ name: false, email: false, phone: false })
  const [hbLoading, setHbLoading]         = useState(false)
  const [hbDone, setHbDone]               = useState<{ pdfUrl: string; title: string } | null>(null)
  const [submitError, setSubmitError]     = useState('')
  const [downloads, setDownloads]         = useState(0)
  const [recentName, setRecentName]       = useState('')
  const [showNotif, setShowNotif]         = useState(false)
  const [pulseBtn, setPulseBtn]           = useState(false)

  useEffect(() => {
    setDownloads(randomDownloads())
    const timer = setTimeout(() => {
      setRecentName(SOCIAL_NAMES[Math.floor(Math.random() * SOCIAL_NAMES.length)])
      setShowNotif(true)
      setTimeout(() => setShowNotif(false), 4000)
    }, 3000)
    const pulse = setTimeout(() => setPulseBtn(true), 5000)
    return () => { clearTimeout(timer); clearTimeout(pulse) }
  }, [])

  const nameErr  = validateName(hbName)
  const emailErr = validateEmail(hbEmail)
  const phoneErr = validatePhone(hbPhone)
  const isValid  = !nameErr && !emailErr && !phoneErr

  const touch = (field: keyof typeof touched) => setTouched(t => ({ ...t, [field]: true }))

  const reset = () => {
    setHbDone(null); setSelectedSlug(null)
    setHbName(''); setHbEmail(''); setHbPhone('')
    setTouched({ name: false, email: false, phone: false })
    setSubmitError('')
  }

  const submitHandbook = async (slug: string) => {
    setTouched({ name: true, email: true, phone: true })
    if (!isValid) return
    setHbLoading(true); setSubmitError('')
    try {
      await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: hbEmail.trim(), name: hbName.trim(), phone: hbPhone.trim(), source: 'naruchnik', naruchnik_slug: slug }),
      })
      const res  = await fetch(`/api/naruchnici?slug=${encodeURIComponent(slug)}`)
      const data = await res.json()
      const nar  = (data.naruchnici || [])[0]
      if (nar?.pdf_url) {
        setHbDone({ pdfUrl: nar.pdf_url, title: nar.title })
        const a = document.createElement('a')
        a.href = nar.pdf_url; a.download = nar.title + '.pdf'; a.target = '_blank'
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
      } else { setSubmitError('Проблем при зареждане. Опитай пак.') }
    } catch { setSubmitError('Грешка. Опитай пак.') }
    setHbLoading(false)
  }

  // Светла тема — полета
  const fieldStyle = (err: string, isTouched: boolean) => ({
    padding: '13px 16px',
    borderRadius: 12,
    border: `1.5px solid ${isTouched && err ? '#f87171' : isTouched && !err ? '#16a34a' : '#d1fae5'}`,
    background: isTouched && err ? '#fff5f5' : isTouched && !err ? '#f0fdf4' : '#fff',
    color: '#111',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s, background 0.2s',
  })

  return (
    <div className="handbooks-panel" style={{ position: 'relative', overflow: 'visible' }}>

      {/* ── Social proof popup ── */}
      <div style={{
        position: 'absolute', top: -14, left: 8, right: 8, zIndex: 10,
        background: '#fff',
        border: '1.5px solid #bbf7d0',
        borderRadius: 12, padding: '8px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 8px 24px rgba(22,163,74,0.15)',
        transform: showNotif ? 'translateY(0)' : 'translateY(-80px)',
        opacity: showNotif ? 1 : 0,
        transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s',
        pointerEvents: 'none',
      }}>
        <span style={{ fontSize: 20 }}>🎉</span>
        <div>
          <div style={{ color: '#15803d', fontWeight: 700, fontSize: 12 }}>{recentName}</div>
          <div style={{ color: '#6b7280', fontSize: 11 }}>току-що изтегли наръчник</div>
        </div>
        <div style={{ marginLeft: 'auto', background: '#dcfce7', borderRadius: 20, padding: '2px 8px', color: '#15803d', fontSize: 10, fontWeight: 800 }}>LIVE</div>
      </div>

      {/* ── Хедър ── */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
      

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 26 }}>🎁</span>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#14532d', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Вземи Наръчника <span style={{ color: '#16a34a' }}>Безплатно</span>
          </div>
        </div>
        <div style={{ color: '#6b7280', fontSize: 13 }}>
          Над <strong style={{ color: '#15803d' }}>6 000</strong> фермери вече го изтеглиха
        </div>
      </div>

      <div style={{ height: 1.5, background: '#d1fae5', margin: '0 0 16px' }} />

      {/* ── Готово ── */}
      {hbDone ? (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🎉</div>
          <div style={{ color: '#15803d', fontWeight: 900, fontSize: 20, marginBottom: 6 }}>Честито! Свалянето започна!</div>
          <div style={{ color: '#374151', fontSize: 13, marginBottom: 6, lineHeight: 1.6 }}>
            Провери папката <strong style={{ color: '#14532d' }}>Изтегляния</strong> на телефона/компютъра си.
          </div>
          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 20 }}>
            📧 Изпратихме и на <span style={{ color: '#15803d', fontWeight: 700 }}>{hbEmail}</span>
          </div>
          <a href={hbDone.pdfUrl} target="_blank" rel="noopener noreferrer" download
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', borderRadius: 13, padding: '14px 26px', textDecoration: 'none', fontWeight: 900, fontSize: 15, marginBottom: 14, boxShadow: '0 8px 28px rgba(22,163,74,0.4)' }}>
            📥 Изтегли отново
          </a>
          <br />
          <button onClick={reset} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 13, textDecoration: 'underline', marginTop: 4 }}>
            ← Вземи и другия наръчник
          </button>
        </div>

      /* ── Форма ── */
      ) : selectedSlug ? (
        <div>
          {(() => {
            const hb = handbooks.find(h => h.slug === selectedSlug)
            return hb && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f0fdf4', border: `1.5px solid ${hb.color}44`, borderRadius: 14, padding: '10px 12px', marginBottom: 16 }}>
                <div style={{ width: 50, height: 68, flexShrink: 0, borderRadius: 10, overflow: 'hidden', background: `${hb.color}18`, boxShadow: `0 4px 16px ${hb.color}33` }}>
                  {hb.image_url
                    ? <img src={hb.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 10 }} />
                    : <span style={{ fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>{hb.emoji}</span>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: hb.color, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 3 }}>{hb.badge}</div>
                  <div style={{ color: '#14532d', fontWeight: 800, fontSize: 13, lineHeight: 1.3, marginBottom: 4 }}>{hb.title}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#dcfce7', borderRadius: 6, padding: '2px 8px' }}>
                    <span style={{ color: '#15803d', fontSize: 10, fontWeight: 800 }}>✦ НАПЪЛНО БЕЗПЛАТНО</span>
                  </div>
                </div>
                <button onClick={() => setSelectedSlug(null)} style={{ background: '#f3f4f6', border: '1.5px solid #e5e7eb', color: '#6b7280', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
              </div>
            )
          })()}

          <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: '8px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚡</span>
            <span style={{ color: '#374151', fontSize: 12, lineHeight: 1.4 }}>
              Попълни само <strong style={{ color: '#15803d' }}>3 полета</strong> и наръчникът се сваля <strong style={{ color: '#14532d' }}>веднага</strong> — без регистрация
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Ime */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ color: '#374151', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>
                  ИМЕ И ФАМИЛИЯ <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {touched.name && !nameErr && <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 700 }}>✓ Добре</span>}
              </div>
              <input type="text" className="hb-input" placeholder="Напр. Иван Петров"
                value={hbName} onChange={e => setHbName(e.target.value)} onBlur={() => touch('name')}
                style={fieldStyle(nameErr, touched.name)} />
              {touched.name && nameErr && <div style={{ color: '#dc2626', fontSize: 11, fontWeight: 600, marginTop: 5 }}>⚠ {nameErr}</div>}
            </div>

            {/* Email */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ color: '#374151', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>
                  ИМЕЙЛ АДРЕС <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {touched.email && !emailErr && <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 700 }}>✓ Добре</span>}
              </div>
              <input type="email" className="hb-input" placeholder="email@example.com"
                value={hbEmail} onChange={e => setHbEmail(e.target.value)} onBlur={() => touch('email')}
                style={fieldStyle(emailErr, touched.email)} />
              {touched.email && emailErr && <div style={{ color: '#dc2626', fontSize: 11, fontWeight: 600, marginTop: 5 }}>⚠ {emailErr}</div>}
            </div>

            {/* Phone */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ color: '#374151', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>
                  ТЕЛЕФОН <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {touched.phone && !phoneErr && <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 700 }}>✓ Добре</span>}
              </div>
              <input type="tel" className="hb-input" placeholder="08X XXX XXXX"
                value={hbPhone} onChange={e => setHbPhone(e.target.value)} onBlur={() => touch('phone')}
                style={fieldStyle(phoneErr, touched.phone)} />
              {touched.phone && phoneErr && <div style={{ color: '#dc2626', fontSize: 11, fontWeight: 600, marginTop: 5 }}>⚠ {phoneErr}</div>}
              <div style={{ color: '#9ca3af', fontSize: 10, marginTop: 5 }}>📞 За лична консултация при нужда</div>
            </div>

            {submitError && (
              <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, padding: '10px 14px', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
                ⚠ {submitError}
              </div>
            )}

            <button
              onClick={() => submitHandbook(selectedSlug!)}
              disabled={hbLoading}
              style={{
                background: hbLoading ? '#e5e7eb' : isValid ? 'linear-gradient(135deg, #16a34a, #15803d)' : '#f3f4f6',
                color: hbLoading ? '#9ca3af' : isValid ? '#fff' : '#9ca3af',
                border: 'none', borderRadius: 14, padding: '16px', fontSize: 16, fontWeight: 900,
                cursor: hbLoading ? 'wait' : 'pointer', fontFamily: 'inherit',
                transition: 'all 0.25s', width: '100%',
                boxShadow: isValid && !hbLoading ? '0 8px 28px rgba(22,163,74,0.35)' : 'none',
                letterSpacing: '-0.01em',
              }}
            >
              {hbLoading ? '⏳ Подготвям наръчника...' : isValid ? '📥 Изтегли Безплатно Сега →' : '📋 Попълни всички полета'}
            </button>

         
          </div>
        </div>

      /* ── Списък наръчници ── */
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        

          {/* Карти */}
          {handbooks.map((hb, idx) => (
            <button
              key={hb.slug}
              onClick={() => setSelectedSlug(hb.slug)}
              style={{
                cursor: 'pointer',
                border: '1.5px solid #d1fae5',
                textAlign: 'left' as const,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                padding: '0',
                borderRadius: '16px',
                background: '#fff',
                transition: 'transform 0.22s, box-shadow 0.22s, border-color 0.22s',
                overflow: 'hidden',
                boxShadow: '0 2px 14px rgba(22,163,74,0.07)',
                minHeight: 100,
                animation: pulseBtn && idx === 0 ? 'subtlePulse 2.5s ease-in-out infinite' : 'none',
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.boxShadow = `0 10px 32px ${hb.color}28`
                e.currentTarget.style.borderColor = `${hb.color}70`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 14px rgba(22,163,74,0.07)'
                e.currentTarget.style.borderColor = '#d1fae5'
              }}
            >
              {/* Корица — заоблени леви ъгли */}
              <div style={{
                width: 82, height: 108, flexShrink: 0,
                overflow: 'hidden', position: 'relative',
                background: `${hb.color}10`,
                borderRadius: '14px 0 0 14px',
              }}>
                {hb.image_url ? (
                  <img
                    src={hb.image_url}
                    alt={hb.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.parentElement!.innerHTML = `<span style="font-size:34px;display:flex;align-items:center;justify-content:center;width:100%;height:100%">${hb.emoji}</span>`
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>{hb.emoji}</span>
                )}
                {/* Цветна лента вляво */}
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: `linear-gradient(180deg, ${hb.color}, ${hb.color}88)` }} />
              </div>

              {/* Текст */}
              <div style={{ flex: 1, padding: '13px 14px 13px 15px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{
                    background: `${hb.color}15`, color: hb.color,
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
                    textTransform: 'uppercase' as const,
                    borderRadius: 5, padding: '2px 7px', border: `1px solid ${hb.color}35`,
                  }}>{hb.badge}</div>
                  <div style={{ background: '#dcfce7', color: '#15803d', fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', borderRadius: 5, padding: '2px 7px', border: '1px solid #a7f3d0' }}>
                    БЕЗПЛАТНО
                  </div>
                </div>
                <div style={{ color: '#14532d', fontWeight: 800, fontSize: 14.5, lineHeight: 1.25, marginBottom: 5 }}>{hb.title}</div>
                <div style={{
                  color: '#6b7280', fontSize: 11.5, lineHeight: 1.45,
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                } as React.CSSProperties}>{hb.subtitle}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 7 }}>
                  {'★★★★★'.split('').map((s, i) => <span key={i} style={{ color: '#f59e0b', fontSize: 11 }}>{s}</span>)}
                  <span style={{ color: '#9ca3af', fontSize: 10.5, marginLeft: 3 }}>6 000+ изтеглени</span>
                </div>
              </div>

              {/* CTA */}
              <div style={{ width: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, flexShrink: 0, paddingRight: 8 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${hb.color}, ${hb.color}cc)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17, color: '#fff', fontWeight: 900,
                  boxShadow: `0 4px 14px ${hb.color}44`,
                }}>↓</div>
                <span style={{ color: hb.color, fontSize: 8, fontWeight: 800, letterSpacing: '0.05em' }}>ВЗЕМИ</span>
              </div>
            </button>
          ))}

          {/* Bottom urgency — жълт тон за светла тема */}
          <div style={{ textAlign: 'center', marginTop: 4, padding: '9px 12px', background: '#fef9f0', border: '1.5px solid #fde68a', borderRadius: 10 }}>
            <span style={{ color: '#92400e', fontSize: 11, fontWeight: 700 }}>
              ⏰ Предложението е безплатно само докато трае — не чакай!
            </span>
          </div>
        </div>
      )}

      <div className="handbooks-panel-footer" style={{ marginTop: 14 }}>
        <span>🔒 Без спам</span>
        <span style={{ color: '#d1d5db' }}>·</span>
        <span>Директно сваляне</span>
        <span style={{ color: '#d1d5db' }}>·</span>
        <span>Безплатно</span>
      </div>

      <style>{`
        @keyframes subtlePulse {
          0%, 100% { box-shadow: 0 2px 14px rgba(22,163,74,0.07); }
          50% { box-shadow: 0 4px 24px rgba(22,163,74,0.2), 0 0 0 3px rgba(22,163,74,0.07); }
        }
        .hb-input::placeholder { color: #9ca3af !important; opacity: 1; }
        .hb-input { color: #111 !important; }
        .hb-input:focus { outline: none; border-color: #16a34a !important; background: #f0fdf4 !important; }
      `}</style>
    </div>
  )
}
