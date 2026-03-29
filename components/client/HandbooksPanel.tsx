'use client'

// components/client/HandbooksPanel.tsx

import { useState } from 'react'

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
  const digits = v.replace(/\D/g, '')
  if (digits.length < 9) return 'Въведи валиден телефон'
  return ''
}

export function HandbooksPanel({ handbooks }: { handbooks: Handbook[] }) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [hbName, setHbName]   = useState('')
  const [hbEmail, setHbEmail] = useState('')
  const [hbPhone, setHbPhone] = useState('')
  const [touched, setTouched] = useState({ name: false, email: false, phone: false })
  const [hbLoading, setHbLoading] = useState(false)
  const [hbDone, setHbDone]   = useState<{ pdfUrl: string; title: string } | null>(null)
  const [submitError, setSubmitError] = useState('')

  const nameErr  = validateName(hbName)
  const emailErr = validateEmail(hbEmail)
  const phoneErr = validatePhone(hbPhone)
  const isValid  = !nameErr && !emailErr && !phoneErr

  const touch = (field: keyof typeof touched) =>
    setTouched(t => ({ ...t, [field]: true }))

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
        body: JSON.stringify({
          email: hbEmail.trim(), name: hbName.trim(),
          phone: hbPhone.trim(), source: 'naruchnik', naruchnik_slug: slug,
        }),
      })
      const res  = await fetch(`/api/naruchnici?slug=${encodeURIComponent(slug)}`)
      const data = await res.json()
      const nar  = (data.naruchnici || [])[0]
      if (nar?.pdf_url) {
        setHbDone({ pdfUrl: nar.pdf_url, title: nar.title })
        const a = document.createElement('a')
        a.href = nar.pdf_url; a.download = nar.title + '.pdf'; a.target = '_blank'
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
      } else {
        setSubmitError('Проблем при зареждане на файла. Опитай пак.')
      }
    } catch {
      setSubmitError('Грешка при връзката. Опитай пак.')
    }
    setHbLoading(false)
  }

  const fieldStyle = (err: string, isTouched: boolean) => ({
    padding: '12px 14px',
    borderRadius: 12,
    border: `1.5px solid ${isTouched && err ? '#f87171' : isTouched && !err ? '#86efac' : 'rgba(255,255,255,0.15)'}`,
    background: isTouched && err ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.07)',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s, background 0.2s',
  })

  return (
    <div className="handbooks-panel">
      {/* Хедър */}
      <div className="handbooks-panel-header">
        <div className="handbooks-panel-icon">🎁</div>
        <div>
          <div className="handbooks-panel-title">Безплатни Наръчници</div>
          <div className="handbooks-panel-sub">Избери · Попълни · Изтегли веднага</div>
        </div>
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '0 0 14px' }} />

      {/* ── Готово ── */}
      {hbDone ? (
        <div style={{ textAlign: 'center', padding: '14px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
          <div style={{ color: '#86efac', fontWeight: 800, fontSize: 17, marginBottom: 6 }}>
            Наръчникът се сваля!
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 18, lineHeight: 1.5 }}>
            Изпратихме потвърждение на<br />
            <span style={{ color: '#86efac', fontWeight: 600 }}>{hbEmail}</span>
          </div>
          <a
            href={hbDone.pdfUrl} target="_blank" rel="noopener noreferrer" download
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#16a34a', color: '#fff', borderRadius: 12, padding: '13px 24px', textDecoration: 'none', fontWeight: 800, fontSize: 15, marginBottom: 14, boxShadow: '0 6px 20px rgba(22,163,74,0.4)' }}
          >
            📥 Изтегли пак
          </a>
          <br />
          <button
            onClick={reset}
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}
          >
            ← Избери друг наръчник
          </button>
        </div>

      /* ── Форма ── */
      ) : selectedSlug ? (
        <div>
          {(() => {
            const hb = handbooks.find(h => h.slug === selectedSlug)
            return hb ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.07)', border: `1px solid ${hb.color}44`, borderRadius: 14, padding: '10px 12px', marginBottom: 16 }}>
                <div style={{ width: 44, height: 62, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: `${hb.color}22` }}>
                  {hb.image_url
                    ? <img src={hb.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <span style={{ fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>{hb.emoji}</span>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: hb.color, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{hb.badge}</div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{hb.title}</div>
                </div>
                <button
                  onClick={() => setSelectedSlug(null)}
                  style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >✕</button>
              </div>
            ) : null
          })()}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Ime */}
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, marginBottom: 5, letterSpacing: '0.05em' }}>
                ИМЕ И ФАМИЛИЯ <span style={{ color: '#f87171' }}>*</span>
              </div>
              <input
                type="text"
                className="hb-input"
                placeholder="Напр. Иван Иванов"
                value={hbName}
                onChange={e => setHbName(e.target.value)}
                onBlur={() => touch('name')}
                style={fieldStyle(nameErr, touched.name)}
              />
              {touched.name && nameErr && <div style={{ color: '#f87171', fontSize: 11, fontWeight: 600, marginTop: 4 }}>⚠ {nameErr}</div>}
              {touched.name && !nameErr && <div style={{ color: '#86efac', fontSize: 11, fontWeight: 600, marginTop: 4 }}>✓ Добре</div>}
            </div>

            {/* Email */}
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, marginBottom: 5, letterSpacing: '0.05em' }}>
                ИМЕЙЛ АДРЕС <span style={{ color: '#f87171' }}>*</span>
              </div>
              <input
                type="email"
                className="hb-input"
                placeholder="email@example.com"
                value={hbEmail}
                onChange={e => setHbEmail(e.target.value)}
                onBlur={() => touch('email')}
                style={fieldStyle(emailErr, touched.email)}
              />
              {touched.email && emailErr && <div style={{ color: '#f87171', fontSize: 11, fontWeight: 600, marginTop: 4 }}>⚠ {emailErr}</div>}
              {touched.email && !emailErr && <div style={{ color: '#86efac', fontSize: 11, fontWeight: 600, marginTop: 4 }}>✓ Добре</div>}
            </div>

            {/* Phone */}
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, marginBottom: 5, letterSpacing: '0.05em' }}>
                ТЕЛЕФОН <span style={{ color: '#f87171' }}>*</span>
              </div>
              <input
                type="tel"
                className="hb-input"
                placeholder="08X XXX XXXX"
                value={hbPhone}
                onChange={e => setHbPhone(e.target.value)}
                onBlur={() => touch('phone')}
                style={fieldStyle(phoneErr, touched.phone)}
              />
              {touched.phone && phoneErr && <div style={{ color: '#f87171', fontSize: 11, fontWeight: 600, marginTop: 4 }}>⚠ {phoneErr}</div>}
              {touched.phone && !phoneErr && <div style={{ color: '#86efac', fontSize: 11, fontWeight: 600, marginTop: 4 }}>✓ Добре</div>}
            </div>

            {submitError && (
              <div style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '10px 14px', color: '#f87171', fontSize: 13, fontWeight: 600 }}>
                ⚠ {submitError}
              </div>
            )}

            {/* Бутон */}
            <button
              onClick={() => submitHandbook(selectedSlug!)}
              disabled={hbLoading}
              style={{
                background: hbLoading
                  ? '#4b5563'
                  : isValid
                    ? 'linear-gradient(135deg,#16a34a,#15803d)'
                    : 'rgba(255,255,255,0.06)',
                color: isValid || hbLoading ? '#fff' : 'rgba(255,255,255,0.3)',
                border: isValid ? 'none' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 13,
                padding: '15px',
                fontSize: 15,
                fontWeight: 900,
                cursor: hbLoading ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.25s',
                boxShadow: isValid ? '0 6px 22px rgba(22,163,74,0.4)' : 'none',
                marginTop: 2,
              }}
            >
              {hbLoading ? '⏳ Зарежда...' : isValid ? '📥 Изтегли Безплатно' : '📋 Попълни всички полета'}
            </button>

            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 2 }}>
              🔒 Данните ти са защитени · Без спам
            </div>
          </div>
        </div>

      /* ── Списък наръчници ── */
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {handbooks.map((hb) => (
            <button
              key={hb.slug}
              onClick={() => setSelectedSlug(hb.slug)}
              className="hb-card"
              style={{
                '--hb-color': hb.color,
                cursor: 'pointer',
                border: `1px solid ${hb.color}33`,
                textAlign: 'left',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 0,
                padding: '0',
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.04)',
                transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
                minHeight: 100,
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.boxShadow = `0 8px 28px ${hb.color}44`
                e.currentTarget.style.borderColor = `${hb.color}88`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.2)'
                e.currentTarget.style.borderColor = `${hb.color}33`
              }}
            >
              {/* Корица */}
              <div style={{ width: 70, height: 100, flexShrink: 0, overflow: 'hidden', position: 'relative', background: `${hb.color}22` }}>
                {hb.image_url ? (
                  <img
                    src={hb.image_url}
                    alt={hb.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.parentElement!.innerHTML = `<span style="font-size:32px;display:flex;align-items:center;justify-content:center;width:100%;height:100%">${hb.emoji}</span>`
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>{hb.emoji}</span>
                )}
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: hb.color }} />
              </div>

              {/* Текст */}
              <div style={{ flex: 1, padding: '12px 14px', overflow: 'hidden' }}>
                <div style={{
                  display: 'inline-block', background: `${hb.color}22`, color: hb.color,
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase',
                  borderRadius: 5, padding: '2px 7px', marginBottom: 5,
                }}>{hb.badge}</div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.3, marginBottom: 4 }}>{hb.title}</div>
                <div style={{
                  color: 'rgba(255,255,255,0.45)', fontSize: 11, lineHeight: 1.4,
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                } as React.CSSProperties}>{hb.subtitle}</div>
                <div style={{ color: '#86efac', fontSize: 10, fontWeight: 700, marginTop: 6 }}>✦ БЕЗПЛАТНО</div>
              </div>

              {/* Стрелка */}
              <div style={{ width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', background: hb.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, color: '#fff', fontWeight: 900, boxShadow: `0 4px 12px ${hb.color}66`,
                }}>↓</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="handbooks-panel-footer" style={{ marginTop: 14 }}>
        <span>🔒 Без спам</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Директно сваляне</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Безплатно</span>
      </div>
    </div>
  )
}
