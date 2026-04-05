'use client'

// app/naruchnik/[slug]/NaruchnikClient.tsx
// Client Component — lead form + download (НЕ директно сваляне)

import { useState } from 'react'

interface Naruchnik {
  id: string; slug: string; title: string; subtitle?: string
  description?: string; cover_image_url?: string; pdf_url?: string
  category?: string; active: boolean
}

const CAT_EMOJI: Record<string, string> = {
  domati: '🍅', krastavici: '🥒', chushki: '🫑', default: '🌿',
}
const catEmoji = (cat = '') => CAT_EMOJI[cat] || CAT_EMOJI.default

const INSIDE_ITEMS = [
  'Пълен календар за торене и третиране',
  'Кои продукти работят наистина (и кои са пари на вятъра)',
  'Борба с болестите — органични методи без химия',
  'Грешките, които убиват реколтата (и как да ги избегнеш)',
  'Тайните на двойния добив от един декар',
]

function validateName(v: string)  { return !v.trim() ? 'Името е задължително' : v.trim().length < 2 ? 'Въведи поне 2 символа' : '' }
function validateEmail(v: string) { return !v.trim() ? 'Имейлът е задължителен' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? 'Невалиден имейл адрес' : '' }
function validatePhone(v: string) { return !v.trim() ? 'Телефонът е задължителен' : v.replace(/\D/g, '').length < 9 ? 'Въведи валиден телефон' : '' }

interface Props {
  nar: Naruchnik
  others: Naruchnik[]
}

export default function NaruchnikClient({ nar, others }: Props) {
  const emoji = catEmoji(nar.category)
  const pdfUrl = nar.pdf_url || '#'

  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [touched, setTouched] = useState({ name: false, email: false, phone: false })
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [submitError, setSubmitError] = useState('')

  const nameErr  = validateName(name)
  const emailErr = validateEmail(email)
  const phoneErr = validatePhone(phone)
  const isValid  = !nameErr && !emailErr && !phoneErr

  const touch = (f: keyof typeof touched) => setTouched(t => ({ ...t, [f]: true }))

  const handleSubmit = async () => {
    setTouched({ name: true, email: true, phone: true })
    if (!isValid) return
    setLoading(true); setSubmitError('')
    try {
      await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(), name: name.trim(), phone: phone.trim(),
          source: 'naruchnik_page', naruchnik_slug: nar.slug,
        }),
      })
      // Trigger automatic download
      const a = document.createElement('a')
      a.href = pdfUrl; a.download = nar.title + '.pdf'; a.target = '_blank'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setDone(true)
    } catch {
      setSubmitError('Грешка при изпращане. Опитай пак.')
    }
    setLoading(false)
  }

  const fieldStyle = (err: string, isTouched: boolean): React.CSSProperties => ({
    padding: '13px 16px',
    borderRadius: 12,
    border: `1.5px solid ${isTouched && err ? '#f87171' : isTouched && !err ? '#4ade80' : 'rgba(255,255,255,0.22)'}`,
    background: isTouched && err ? 'rgba(254,242,242,0.12)' : isTouched && !err ? 'rgba(240,253,244,0.12)' : 'rgba(255,255,255,0.08)',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, background 0.2s',
  })

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@700;800&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .nar-hero{padding:48px 24px 0;max-width:960px;margin:0 auto;text-align:center;animation:fadeUp .5s ease}
        .nar-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.18);border-radius:100px;padding:6px 18px;margin-bottom:20px;backdrop-filter:blur(8px)}
        .nar-badge-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block}
        .nar-badge-text{font-size:11px;font-weight:700;color:rgba(255,255,255,0.85);letter-spacing:.08em;text-transform:uppercase}
        .nar-hero h1{font-family:'Cormorant Garamond',serif;font-size:clamp(28px,4vw,50px);font-weight:800;color:#fff;line-height:1.08;letter-spacing:-.02em;margin-bottom:14px}
        .nar-hero-sub{font-size:15px;color:rgba(255,255,255,0.65);line-height:1.75;max-width:520px;margin:0 auto 32px}

        /* Two-column layout */
        .nar-layout{max-width:960px;margin:0 auto;padding:0 24px;display:grid;grid-template-columns:1fr 380px;gap:28px;align-items:start;animation:fadeUp .6s ease .1s both}
        @media(max-width:760px){.nar-layout{grid-template-columns:1fr;padding:0 16px}}

        /* Info card */
        .nar-main-card{background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,0.45)}
        .nar-cover-zone{background:linear-gradient(145deg,#f0fdf4,#dcfce7);padding:32px;display:flex;align-items:center;gap:28px;position:relative;overflow:hidden}
        .nar-cover-zone::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle,rgba(22,163,74,0.07) 1px,transparent 1px);background-size:20px 20px;pointer-events:none}
        .nar-cover-img{max-height:180px;max-width:155px;object-fit:contain;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,0.15);position:relative;flex-shrink:0}
        .nar-cover-text{flex:1;min-width:0}
        .nar-category-tag{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:#15803d;letter-spacing:.07em;text-transform:uppercase;margin-bottom:10px}
        .nar-cover-title{font-family:'Cormorant Garamond',serif;font-size:clamp(20px,2.5vw,27px);font-weight:800;color:#0f172a;line-height:1.15;letter-spacing:-.02em;margin-bottom:8px}
        .nar-cover-sub{font-size:13px;color:#6b7280;line-height:1.6;margin-bottom:14px}
        .nar-free-badge{display:inline-flex;align-items:center;gap:6px;background:#16a34a;color:#fff;font-size:12px;font-weight:800;padding:6px 14px;border-radius:30px;letter-spacing:.03em}
        .nar-inside-zone{padding:24px 32px}
        .nar-zone-label{font-size:11px;font-weight:800;color:#16a34a;letter-spacing:.08em;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:8px}
        .nar-zone-label::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,#d1fae5,transparent)}
        .nar-inside-list{display:flex;flex-direction:column;gap:9px}
        .nar-inside-item{display:flex;align-items:flex-start;gap:11px;font-size:14px;color:#374151;font-weight:500;line-height:1.5}
        .nar-inside-check{width:20px;height:20px;border-radius:6px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;flex-shrink:0;margin-top:1px;box-shadow:0 2px 6px rgba(22,163,74,.3)}

        /* Others */
        .nar-others-zone{padding:20px 32px 24px;border-top:1px solid #f3f4f6}
        .nar-others-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:12px}
        .nar-other-card{display:flex;flex-direction:column;align-items:center;gap:7px;padding:14px 10px;background:#f8fafc;border:1.5px solid #e5e7eb;border-radius:14px;text-decoration:none;text-align:center;transition:border-color .2s,background .2s,box-shadow .2s,transform .2s}
        .nar-other-card:hover{border-color:#16a34a;background:#f0fdf4;box-shadow:0 4px 16px rgba(22,163,74,.15);transform:translateY(-2px)}
        .nar-other-emoji{font-size:26px}
        .nar-other-title{font-size:12px;font-weight:700;color:#111;line-height:1.3}
        .nar-other-cta{font-size:11px;color:#16a34a;font-weight:800}

        /* Form card */
        .nar-form-card{background:rgba(255,255,255,0.07);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.14);border-radius:24px;padding:28px;box-shadow:0 24px 60px rgba(0,0,0,0.3);position:sticky;top:24px}
        .nar-form-heading{font-family:'Cormorant Garamond',serif;font-size:23px;font-weight:800;color:#fff;line-height:1.2;margin-bottom:6px}
        .nar-form-sub{font-size:13px;color:rgba(255,255,255,0.58);line-height:1.6;margin-bottom:20px}
        .nar-divider{height:1px;background:rgba(255,255,255,0.11);margin-bottom:20px}
        .nar-label{font-size:10px;font-weight:800;color:rgba(255,255,255,0.48);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center}
        .nar-ok{color:#4ade80;font-size:11px;font-weight:700}
        .nar-err{color:#fca5a5;font-size:11px;font-weight:600;margin-top:5px}
        .nar-hint{color:rgba(255,255,255,0.32);font-size:10px;margin-top:4px}
        .nar-input::placeholder{color:rgba(255,255,255,0.32) !important;opacity:1}
        .nar-input:focus{border-color:#4ade80 !important;background:rgba(74,222,128,0.08) !important;outline:none}
        .nar-btn{width:100%;border:none;border-radius:14px;padding:17px;font-size:15.5px;font-weight:900;cursor:pointer;font-family:inherit;letter-spacing:-.01em;transition:all .25s;margin-top:4px}
        .nar-btn-ready{background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;box-shadow:0 8px 28px rgba(22,163,74,0.4)}
        .nar-btn-ready:hover{transform:translateY(-2px);box-shadow:0 14px 40px rgba(22,163,74,0.55)}
        .nar-btn-inactive{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.35);cursor:default}
        .nar-btn-loading{background:#374151;color:#9ca3af;cursor:wait}
        .nar-form-footer{display:flex;justify-content:center;gap:8px;margin-top:14px;font-size:11px;color:rgba(255,255,255,0.32);flex-wrap:wrap}

        /* Back */
        .nar-back-row{text-align:center;padding-top:28px;padding-bottom:8px}
        .nar-back-link{color:rgba(255,255,255,0.38);text-decoration:none;font-size:13.5px;font-weight:600;transition:color .2s}
        .nar-back-link:hover{color:#86efac}

        @media(max-width:580px){
          .nar-cover-zone{flex-direction:column;text-align:center;padding:24px 20px}
          .nar-inside-zone,.nar-others-zone{padding:18px 20px}
          .nar-form-card{padding:22px 18px}
          .nar-hero{padding:36px 18px 0}
        }
      `}</style>

      {/* ── Hero ── */}
      <div className="nar-hero">
        <div className="nar-badge">
          <span className="nar-badge-dot" />
          <span className="nar-badge-text">Безплатен PDF Наръчник</span>
        </div>
        <h1>{emoji} {nar.title}</h1>
        {nar.subtitle && <p className="nar-hero-sub">{nar.subtitle}</p>}
      </div>

      {/* ── Two-column layout ── */}
      <div className="nar-layout">

        {/* LEFT — info */}
        <div className="nar-main-card">
          <div className="nar-cover-zone">
            {nar.cover_image_url && (
              <img src={nar.cover_image_url} alt={nar.title} className="nar-cover-img" />
            )}
            <div className="nar-cover-text">
              <div className="nar-category-tag">
                <span>{emoji}</span>
                {nar.category ? nar.category.charAt(0).toUpperCase() + nar.category.slice(1) : 'Наръчник'}
              </div>
              <h2 className="nar-cover-title">{nar.title}</h2>
              {nar.description && <p className="nar-cover-sub">{nar.description}</p>}
              <span className="nar-free-badge"><span>🆓</span> Напълно безплатно</span>
            </div>
          </div>

          <div className="nar-inside-zone">
            <div className="nar-zone-label">Вътре ще намериш</div>
            <ul className="nar-inside-list" style={{ listStyle: 'none', padding: 0 }}>
              {INSIDE_ITEMS.map(item => (
                <li key={item} className="nar-inside-item">
                  <span className="nar-inside-check">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {others.length > 0 && (
            <div className="nar-others-zone">
              <div className="nar-zone-label">Виж и другите наръчници</div>
              <div className="nar-others-grid">
                {others.map(o => (
                  <a key={o.slug} href={`/naruchnik/${o.slug}`} className="nar-other-card">
                    <span className="nar-other-emoji">{catEmoji(o.category)}</span>
                    <span className="nar-other-title">{o.title}</span>
                    <span className="nar-other-cta">Изтегли →</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — lead form */}
        <div>
          <div className="nar-form-card">
            {done ? (
              /* ── Success state ── */
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 52, marginBottom: 10 }}>🎉</div>
                <div className="nar-form-heading" style={{ marginBottom: 8 }}>Свалянето започна!</div>
                <div style={{ color: 'rgba(255,255,255,0.62)', fontSize: 13, lineHeight: 1.65, marginBottom: 8 }}>
                  Провери папката <strong style={{ color: '#86efac' }}>Изтегляния</strong> на устройството си.
                </div>
                <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 12, marginBottom: 22 }}>
                  📧 Изпратихме копие на <span style={{ color: '#4ade80', fontWeight: 700 }}>{email}</span>
                </div>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', borderRadius: 13, padding: '13px 24px', textDecoration: 'none', fontWeight: 900, fontSize: 15, boxShadow: '0 8px 28px rgba(22,163,74,0.4)' }}>
                  📥 Изтегли отново
                </a>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 38, marginBottom: 8 }}>🎁</div>
                  <div className="nar-form-heading">Изтегли Безплатно</div>
                  <div className="nar-form-sub">
                    Над <strong style={{ color: '#4ade80' }}>6 000</strong> фермери вече го изтеглиха.<br />
                    Въведи данните и го получи веднага.
                  </div>
                </div>

                <div className="nar-divider" />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Name */}
                  <div>
                    <div className="nar-label">
                      ИМЕ <span style={{ color: '#f87171', marginLeft: 2 }}>*</span>
                      {touched.name && !nameErr && <span className="nar-ok">✓ Добре</span>}
                    </div>
                    <input className="nar-input" type="text" placeholder="Георги Петров"
                      value={name} onChange={e => setName(e.target.value)} onBlur={() => touch('name')}
                      style={fieldStyle(nameErr, touched.name)} />
                    {touched.name && nameErr && <div className="nar-err">⚠ {nameErr}</div>}
                  </div>

                  {/* Email */}
                  <div>
                    <div className="nar-label">
                      ИМЕЙЛ <span style={{ color: '#f87171', marginLeft: 2 }}>*</span>
                      {touched.email && !emailErr && <span className="nar-ok">✓ Добре</span>}
                    </div>
                    <input className="nar-input" type="email" placeholder="email@example.com"
                      value={email} onChange={e => setEmail(e.target.value)} onBlur={() => touch('email')}
                      style={fieldStyle(emailErr, touched.email)} />
                    {touched.email && emailErr && <div className="nar-err">⚠ {emailErr}</div>}
                    <div className="nar-hint">📧 Ще получиш копие и на имейла си</div>
                  </div>

                  {/* Phone */}
                  <div>
                    <div className="nar-label">
                      ТЕЛЕФОН <span style={{ color: '#f87171', marginLeft: 2 }}>*</span>
                      {touched.phone && !phoneErr && <span className="nar-ok">✓ Добре</span>}
                    </div>
                    <input className="nar-input" type="tel" placeholder="08X XXX XXXX"
                      value={phone} onChange={e => setPhone(e.target.value)} onBlur={() => touch('phone')}
                      style={fieldStyle(phoneErr, touched.phone)} />
                    {touched.phone && phoneErr && <div className="nar-err">⚠ {phoneErr}</div>}
                    <div className="nar-hint">📞 За лична консултация при нужда</div>
                  </div>

                  {submitError && (
                    <div style={{ background: 'rgba(254,242,242,0.1)', border: '1.5px solid rgba(252,165,165,0.35)', borderRadius: 10, padding: '10px 14px', color: '#fca5a5', fontSize: 13, fontWeight: 600 }}>
                      ⚠ {submitError}
                    </div>
                  )}

                  <button
                    className={`nar-btn ${loading ? 'nar-btn-loading' : isValid ? 'nar-btn-ready' : 'nar-btn-inactive'}`}
                    onClick={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? '⏳ Подготвям наръчника...' : isValid ? '📥 Изтегли Безплатно Сега →' : '📋 Попълни всички полета'}
                  </button>
                </div>

                <div className="nar-form-footer">
                  <span>🔒 Без спам</span>
                  <span>·</span>
                  <span>Без регистрация</span>
                  <span>·</span>
                  <span>Директно сваляне</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="nar-back-row">
        <a href="/" className="nar-back-link">← Обратно към сайта</a>
      </div>
    </>
  )
}
