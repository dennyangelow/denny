'use client'
// app/naruchnik/[slug]/NaruchnikClient.tsx — v13
// ✅ Без хардкодирани данни — всичко от БД (Supabase)
// ✅ Responsive дизайн — десктоп + мобилни
// ✅ Красива, стегната визия без излишно разтягане

import { useState, useCallback } from 'react'
import { validateName, validateEmail, validatePhone } from '@/lib/validation'
import type { Naruchnik } from './page'

export interface FaqEntry { q: string; a: string }

interface Props {
  nar:            Naruchnik
  others:         Naruchnik[]
  faqEntries:     FaqEntry[]
  downloadsCount: number
  avgRating:      number
  reviewsCount:   number
}

const CAT_EMOJI: Record<string, string> = {
  domati: '🍅', krastavici: '🥒', chushki: '🫑', default: '🌿',
}
const catEmoji = (cat = '') => CAT_EMOJI[cat] || CAT_EMOJI.default

export default function NaruchnikClient({
  nar, others, faqEntries, downloadsCount, avgRating, reviewsCount,
}: Props) {
  const emoji  = catEmoji(nar.category)
  const pdfUrl = nar.pdf_url || '#'

  const [name,        setName]        = useState('')
  const [email,       setEmail]       = useState('')
  const [phone,       setPhone]       = useState('')
  const [touched,     setTouched]     = useState({ name: false, email: false, phone: false })
  const [loading,     setLoading]     = useState(false)
  const [done,        setDone]        = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [openFaq,     setOpenFaq]     = useState<number | null>(null)

  const nameErr  = validateName(name)
  const emailErr = validateEmail(email)
  const phoneErr = validatePhone(phone)
  const isValid  = !nameErr && !emailErr && !phoneErr

  const touch = (f: keyof typeof touched) => setTouched(t => ({ ...t, [f]: true }))

  const handleEmailChange = (raw: string) => {
    setEmail(raw.replace(/[^\x21-\x7E]/g, '').toLowerCase())
    touch('email')
  }
  const handlePhoneChange = (raw: string) => {
    setPhone(raw.replace(/[^0-9+\s\-().]/g, ''))
    touch('phone')
  }

  const handleSubmit = useCallback(async () => {
    setTouched({ name: true, email: true, phone: true })
    if (!isValid) return
    setLoading(true); setSubmitError('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(), name: name.trim(), phone: phone.trim(),
          source: 'naruchnik_page', naruchnik_slug: nar.slug,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error || 'Грешка при изпращане. Опитай пак.')
        setLoading(false); return
      }
      const a = document.createElement('a')
      a.href = pdfUrl; a.download = nar.title + '.pdf'; a.target = '_blank'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setDone(true)
    } catch { setSubmitError('Грешка при изпращане. Опитай пак.') }
    setLoading(false)
  }, [isValid, email, name, phone, nar.slug, nar.title, pdfUrl])

  const fieldStyle = (err: string, isTouched: boolean): React.CSSProperties => ({
    padding: '13px 15px', borderRadius: 10, width: '100%', boxSizing: 'border-box',
    border: `1.5px solid ${isTouched && err ? '#f87171' : isTouched && !err ? '#4ade80' : '#d1d5db'}`,
    background: isTouched && err ? '#fef2f2' : isTouched && !err ? '#f0fdf4' : '#fff',
    color: '#111827', fontSize: 15, outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.2s, background 0.2s',
  })

  const downloadsK = downloadsCount >= 1000
    ? `${Math.floor(downloadsCount / 1000)} 000+`
    : `${downloadsCount}+`

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{font-family:'Plus Jakarta Sans',sans-serif;-webkit-font-smoothing:antialiased;background:#f7f8f5;color:#111827}

        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}

        /* ── Breadcrumb ── */
        .nb-bc{background:#052e16;padding:9px 20px;font-size:12px;color:rgba(255,255,255,.4)}
        .nb-bc a{color:rgba(255,255,255,.4);text-decoration:none;transition:color .2s}
        .nb-bc a:hover{color:#4ade80}
        .nb-bc span{margin:0 5px}

        /* ── Hero ── */
        .nb-hero{background:linear-gradient(135deg,#052e16 0%,#14532d 50%,#166534 100%);padding:48px 20px 40px;position:relative;overflow:hidden}
        .nb-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 15% 50%,rgba(74,222,128,.1) 0%,transparent 55%),radial-gradient(ellipse at 85% 10%,rgba(134,239,172,.07) 0%,transparent 50%);pointer-events:none}
        .nb-hero-inner{max-width:720px;margin:0 auto;text-align:center;position:relative;animation:fadeUp .55s ease both}
        .nb-badge{display:inline-flex;align-items:center;gap:7px;background:rgba(74,222,128,.14);border:1px solid rgba(74,222,128,.28);border-radius:100px;padding:5px 16px;margin-bottom:18px}
        .nb-badge-dot{width:6px;height:6px;border-radius:50%;background:#4ade80;animation:pulse 2s infinite;display:inline-block}
        .nb-badge-text{font-size:10px;font-weight:800;color:#86efac;letter-spacing:.1em;text-transform:uppercase}
        .nb-h1{font-family:'Playfair Display',serif;font-size:clamp(26px,5vw,50px);font-weight:900;color:#fff;line-height:1.1;letter-spacing:-.02em;margin-bottom:12px}
        .nb-sub{font-size:clamp(14px,1.8vw,16px);color:rgba(255,255,255,.6);line-height:1.75;max-width:520px;margin:0 auto 28px}

        /* Stats bar */
        .nb-stats{display:flex;justify-content:center;flex-wrap:wrap;gap:0;border-top:1px solid rgba(255,255,255,.1);padding-top:24px;margin-top:4px}
        .nb-stat{padding:8px 24px;border-right:1px solid rgba(255,255,255,.1);text-align:center}
        .nb-stat:last-child{border-right:none}
        .nb-stat-v{font-size:20px;font-weight:800;color:#4ade80;display:block;line-height:1;margin-bottom:3px}
        .nb-stat-l{font-size:10px;color:rgba(255,255,255,.4);font-weight:700;letter-spacing:.07em;text-transform:uppercase}

        /* ── Page layout ── */
        .nb-page{max-width:980px;margin:0 auto;padding:36px 20px 64px;display:grid;grid-template-columns:1fr 380px;gap:28px;align-items:start}
        @media(max-width:760px){.nb-page{grid-template-columns:1fr;padding:24px 16px 56px}}
        .nb-left{display:flex;flex-direction:column;gap:18px}

        /* ── Cards ── */
        .nb-card{background:#fff;border-radius:18px;border:1px solid #e5e7eb;box-shadow:0 2px 8px rgba(0,0,0,.04),0 16px 48px rgba(0,0,0,.06);animation:fadeUp .5s ease both}

        /* Book top */
        .nb-book-top{background:linear-gradient(135deg,#f0fdf4,#dcfce7);padding:28px;display:flex;gap:24px;align-items:flex-start;border-radius:18px 18px 0 0;position:relative;overflow:hidden}
        .nb-book-top::after{content:'';position:absolute;top:-30px;right:-30px;width:140px;height:140px;border-radius:50%;background:rgba(22,163,74,.07)}
        @media(max-width:540px){.nb-book-top{flex-direction:column;align-items:center;text-align:center;padding:22px 18px}}
        .nb-img-wrap{flex-shrink:0;position:relative;animation:float 4s ease-in-out infinite}
        .nb-img{max-height:180px;max-width:130px;object-fit:contain;border-radius:10px;box-shadow:0 14px 36px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.1);display:block}
        .nb-img-placeholder{width:110px;height:150px;background:linear-gradient(135deg,#16a34a,#15803d);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;box-shadow:0 14px 36px rgba(0,0,0,.18)}
        .nb-free{position:absolute;top:-6px;right:-10px;background:#dc2626;color:#fff;font-size:9px;font-weight:900;padding:3px 9px;border-radius:20px;letter-spacing:.06em;text-transform:uppercase;box-shadow:0 3px 10px rgba(220,38,38,.4)}
        .nb-meta{flex:1;min-width:0}
        .nb-cat{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:800;color:#16a34a;letter-spacing:.08em;text-transform:uppercase;background:rgba(22,163,74,.1);padding:3px 9px;border-radius:5px;margin-bottom:8px}
        .nb-book-title{font-family:'Playfair Display',serif;font-size:clamp(18px,2.2vw,24px);font-weight:800;color:#0f172a;line-height:1.2;letter-spacing:-.02em;margin-bottom:8px}
        .nb-book-desc{font-size:13.5px;color:#6b7280;line-height:1.7;margin-bottom:14px}
        .nb-stars{display:flex;align-items:center;gap:3px;flex-wrap:wrap}
        .nb-star{color:#f59e0b;font-size:14px}
        .nb-stars-lbl{font-size:12px;color:#6b7280;font-weight:600;margin-left:3px}

        /* Inside section */
        .nb-inside{padding:24px 28px;border-top:1px solid #f3f4f6}
        @media(max-width:540px){.nb-inside{padding:18px}}
        .nb-sec-label{font-size:10px;font-weight:800;color:#16a34a;letter-spacing:.1em;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:8px}
        .nb-sec-label::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,#d1fae5,transparent)}
        .nb-inside-list{list-style:none;display:flex;flex-direction:column;gap:9px}
        .nb-inside-item{display:flex;align-items:flex-start;gap:10px;padding:11px 13px;background:#f8fafc;border-radius:9px;border-left:3px solid #16a34a;transition:background .2s,transform .2s}
        .nb-inside-item:hover{background:#f0fdf4;transform:translateX(2px)}
        .nb-inside-icon{font-size:16px;flex-shrink:0;margin-top:1px}
        .nb-inside-text{font-size:13.5px;color:#374151;font-weight:500;line-height:1.55}

        /* FAQ */
        .nb-faq-item{border-bottom:1px solid #f3f4f6}
        .nb-faq-item:last-child{border-bottom:none}
        .nb-faq-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 0;background:none;border:none;cursor:pointer;font-family:inherit;text-align:left}
        .nb-faq-q{font-size:14px;font-weight:700;color:#111827;line-height:1.5;flex:1}
        .nb-faq-icon{width:22px;height:22px;border-radius:50%;background:#f0fdf4;border:1.5px solid #d1fae5;display:flex;align-items:center;justify-content:center;font-size:14px;color:#16a34a;flex-shrink:0;transition:transform .25s,background .2s}
        .nb-faq-icon.open{transform:rotate(45deg);background:#16a34a;color:#fff;border-color:#16a34a}
        .nb-faq-ans{font-size:13.5px;color:#4b5563;line-height:1.75;max-height:0;overflow:hidden;transition:max-height .3s ease,opacity .3s,padding .3s;opacity:0;padding-bottom:0}
        .nb-faq-ans.open{max-height:500px;opacity:1;padding-bottom:14px}

        /* Content body */
        .nb-content-body{font-size:14px;color:#374151;line-height:1.85;white-space:pre-line}

        /* Author */
        .nb-author{background:linear-gradient(135deg,#f0fdf4,#dcfce7 80%,#fff);border-radius:18px;padding:22px 26px;border:1px solid #d1fae5;animation:fadeUp .5s ease .3s both;display:flex;align-items:center;gap:18px}
        @media(max-width:540px){.nb-author{flex-direction:column;text-align:center}}
        .nb-author-avatar{width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#052e16,#16a34a);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;box-shadow:0 4px 14px rgba(22,163,74,.3)}
        .nb-author-name{font-size:15px;font-weight:800;color:#111827;margin-bottom:1px}
        .nb-author-role{font-size:11px;color:#16a34a;font-weight:700;margin-bottom:6px}
        .nb-author-bio{font-size:13px;color:#4b5563;line-height:1.6}

        /* Others */
        .nb-others-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:9px;margin-top:12px}
        .nb-other-link{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 10px;background:#f8fafc;border:1.5px solid #e5e7eb;border-radius:12px;text-decoration:none;text-align:center;transition:all .2s}
        .nb-other-link:hover{border-color:#16a34a;background:#f0fdf4;transform:translateY(-2px);box-shadow:0 6px 20px rgba(22,163,74,.1)}
        .nb-other-emoji{font-size:26px}
        .nb-other-title{font-size:11px;font-weight:700;color:#111;line-height:1.35}
        .nb-other-cta{font-size:10px;color:#16a34a;font-weight:800}

        /* ── Sticky form ── */
        .nb-right{position:sticky;top:20px}
        .nb-form-card{background:#fff;border-radius:18px;border:1px solid #e5e7eb;box-shadow:0 4px 8px rgba(0,0,0,.05),0 20px 56px rgba(0,0,0,.09);overflow:hidden;animation:fadeUp .45s ease .1s both}
        .nb-form-top{background:linear-gradient(135deg,#052e16,#15803d);padding:26px 24px 22px;text-align:center;position:relative;overflow:hidden}
        .nb-form-top::before{content:'';position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='1.5' fill='%234ade80' fill-opacity='0.07'/%3E%3C/svg%3E")}
        .nb-form-icon{font-size:40px;display:block;margin-bottom:8px;animation:float 3s ease-in-out infinite;position:relative}
        .nb-form-title{font-family:'Playfair Display',serif;font-size:21px;font-weight:800;color:#fff;line-height:1.2;margin-bottom:5px;position:relative}
        .nb-form-sub{font-size:12px;color:rgba(255,255,255,.6);line-height:1.6;position:relative}
        .nb-form-sub strong{color:#4ade80}
        .nb-urgency{display:flex;align-items:center;justify-content:center;gap:6px;background:#fef3c7;border-bottom:1px solid #fde68a;padding:9px 14px;font-size:11px;font-weight:700;color:#92400e}
        .nb-urg-dot{width:6px;height:6px;border-radius:50%;background:#f59e0b;animation:pulse 1.5s infinite;flex-shrink:0}
        .nb-form-body{padding:22px 22px 18px}
        .nb-field-grp{margin-bottom:13px}
        .nb-field-lbl{font-size:10px;font-weight:800;color:#6b7280;letter-spacing:.09em;text-transform:uppercase;margin-bottom:5px;display:flex;justify-content:space-between;align-items:center}
        .nb-field-ok{color:#16a34a;font-size:10px;font-weight:700}
        .nb-field-err{color:#ef4444;font-size:11px;font-weight:600;margin-top:4px}
        .nb-field-hint{color:#9ca3af;font-size:10px;margin-top:3px}
        input::placeholder{color:#9ca3af !important;opacity:1}
        input:focus{border-color:#16a34a !important;background:#f0fdf4 !important;outline:none}
        .nb-cta{width:100%;border:none;border-radius:11px;padding:16px;font-size:15px;font-weight:900;cursor:pointer;font-family:inherit;letter-spacing:-.01em;transition:all .25s;margin-top:4px}
        .nb-cta-ready{background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;box-shadow:0 6px 24px rgba(22,163,74,.38)}
        .nb-cta-ready:hover{transform:translateY(-2px);box-shadow:0 12px 36px rgba(22,163,74,.52)}
        .nb-cta-inactive{background:#f3f4f6;color:#9ca3af;cursor:default}
        .nb-cta-loading{background:#e5e7eb;color:#9ca3af;cursor:wait}
        .nb-trust{display:flex;justify-content:center;gap:5px;padding:10px 14px 14px;font-size:9px;color:#9ca3af;font-weight:700;border-top:1px solid #f3f4f6;flex-wrap:wrap;letter-spacing:.04em}
        .nb-err-box{background:#fef2f2;border:1.5px solid #fecaca;border-radius:9px;padding:9px 13px;color:#dc2626;font-size:12px;font-weight:600;margin-top:8px}

        /* Success state */
        .nb-success{padding:30px 22px;text-align:center}
        .nb-success-icon{font-size:56px;margin-bottom:10px;animation:float 2s ease-in-out infinite}
        .nb-success-title{font-family:'Playfair Display',serif;font-size:22px;font-weight:800;color:#111;margin-bottom:6px}
        .nb-success-text{font-size:13px;color:#6b7280;line-height:1.7;margin-bottom:5px}
        .nb-success-email{font-size:12px;color:#9ca3af;margin-bottom:22px}
        .nb-success-email span{color:#16a34a;font-weight:700}
        .nb-dl-btn{display:inline-flex;align-items:center;gap:7px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:11px;padding:13px 26px;text-decoration:none;font-weight:900;font-size:14px;box-shadow:0 6px 24px rgba(22,163,74,.38);transition:transform .2s,box-shadow .2s}
        .nb-dl-btn:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(22,163,74,.48)}

        /* Back link */
        .nb-back{text-align:center;padding:6px 20px 28px}
        .nb-back a{color:#9ca3af;text-decoration:none;font-size:12px;font-weight:600;transition:color .2s}
        .nb-back a:hover{color:#16a34a}

        /* Mobile form order — показва формата ПРЕДИ съдържанието на мобилни */
        @media(max-width:760px){
          .nb-page{display:flex;flex-direction:column}
          .nb-right{position:static;order:-1}
          .nb-left{order:1}
        }
      `}</style>

      {/* Breadcrumb */}
      <nav className="nb-bc" aria-label="Навигация">
        <a href="/">Начало</a><span>›</span>
        <a href="/naruchnici">Наръчници</a><span>›</span>
        <span style={{ color: 'rgba(255,255,255,.65)', fontWeight: 600 }}>{nar.title}</span>
      </nav>

      {/* Hero */}
      <header className="nb-hero">
        <div className="nb-hero-inner">
          <div className="nb-badge">
            <span className="nb-badge-dot" />
            <span className="nb-badge-text">Безплатен PDF Наръчник</span>
          </div>
          <h1 className="nb-h1">{emoji} {nar.title}</h1>
          {nar.subtitle && <p className="nb-sub">{nar.subtitle}</p>}
          <div className="nb-stats" role="list">
            <div className="nb-stat" role="listitem">
              <span className="nb-stat-v">{downloadsK}</span>
              <span className="nb-stat-l">изтегляния</span>
            </div>
            <div className="nb-stat" role="listitem">
              <span className="nb-stat-v">{avgRating}/5</span>
              <span className="nb-stat-l">средна оценка</span>
            </div>
            <div className="nb-stat" role="listitem">
              <span className="nb-stat-v">100%</span>
              <span className="nb-stat-l">безплатно</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main grid */}
      <main className="nb-page" id="main-content">

        {/* ── Left column ── */}
        <div className="nb-left">

          {/* Book card */}
          <article className="nb-card" style={{ animationDelay: '.05s' }} aria-label={`Наръчник: ${nar.title}`}>
            <div className="nb-book-top">
              <div className="nb-img-wrap">
                {nar.cover_image_url ? (
                  <img src={nar.cover_image_url} alt={`${nar.title} — PDF наръчник от Denny Angelow`}
                    className="nb-img" loading="eager" width={130} height={180} />
                ) : (
                  <div className="nb-img-placeholder">
                    <span style={{ fontSize: 48 }}>{emoji}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,.7)', fontWeight: 700 }}>PDF</span>
                  </div>
                )}
                <span className="nb-free">БЕЗПЛАТНО</span>
              </div>
              <div className="nb-meta">
                <div className="nb-cat">
                  <span>{emoji}</span>
                  {nar.category ? nar.category.charAt(0).toUpperCase() + nar.category.slice(1) : 'Градинарство'}
                </div>
                <h2 className="nb-book-title">{nar.title}</h2>
                {nar.description && <p className="nb-book-desc">{nar.description}</p>}
                <div className="nb-stars" aria-label={`Оценка ${avgRating} от 5 звезди`}>
                  {[1,2,3,4,5].map(i => <span key={i} className="nb-star">★</span>)}
                  <span className="nb-stars-lbl">{avgRating}/5 · {reviewsCount.toLocaleString('bg-BG')} оценки</span>
                </div>
              </div>
            </div>

            {/* "Какво ще намериш вътре" — само ако има content_body или показваме generic */}
            <section className="nb-inside" aria-labelledby="inside-heading">
              <div className="nb-sec-label" id="inside-heading">Какво ще намериш вътре</div>
              {nar.content_body ? (
                <div className="nb-content-body">{nar.content_body}</div>
              ) : (
                <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>
                  Практично ръководство с конкретни съвети за по-добра реколта, органични методи и грешките, които трябва да избягваш.
                </p>
              )}
            </section>
          </article>

          {/* FAQ */}
          {faqEntries.length > 0 && (
            <section className="nb-card" style={{ padding: '22px 26px', animationDelay: '.15s' }} aria-labelledby="faq-heading">
              <div className="nb-sec-label" id="faq-heading">Често задавани въпроси</div>
              {faqEntries.map((item, i) => (
                <div key={i} className="nb-faq-item">
                  <button className="nb-faq-btn"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    aria-expanded={openFaq === i}
                    aria-controls={`faq-${i}`}>
                    <span className="nb-faq-q">{item.q}</span>
                    <span className={`nb-faq-icon${openFaq === i ? ' open' : ''}`} aria-hidden="true">+</span>
                  </button>
                  <div id={`faq-${i}`} className={`nb-faq-ans${openFaq === i ? ' open' : ''}`}>
                    {item.a}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Author bio — само от БД */}
          {nar.author_bio && (
            <aside className="nb-author" aria-label="За автора">
              <div className="nb-author-avatar">🌱</div>
              <div>
                <div className="nb-author-name">Denny Angelow</div>
                <div className="nb-author-role">Агро Консултант</div>
                <p className="nb-author-bio">{nar.author_bio}</p>
              </div>
            </aside>
          )}

          {/* Other guides */}
          {others.length > 0 && (
            <nav className="nb-card" style={{ padding: '22px 26px', animationDelay: '.25s' }} aria-labelledby="others-heading">
              <div className="nb-sec-label" id="others-heading">Виж и другите наръчници</div>
              <div className="nb-others-grid">
                {others.map(o => (
                  <a key={o.slug} href={`/naruchnik/${o.slug}`} className="nb-other-link" title={o.title}>
                    <span className="nb-other-emoji">{catEmoji(o.category)}</span>
                    <span className="nb-other-title">{o.title}</span>
                    <span className="nb-other-cta">Изтегли →</span>
                  </a>
                ))}
              </div>
            </nav>
          )}
        </div>

        {/* ── Right column — sticky form ── */}
        <aside className="nb-right" aria-label="Форма за изтегляне">
          <div className="nb-form-card">
            {done ? (
              <div className="nb-success" role="alert">
                <div className="nb-success-icon">🎉</div>
                <h3 className="nb-success-title">Свалянето започна!</h3>
                <p className="nb-success-text">Провери папката <strong>Изтегляния</strong> на устройството си.</p>
                <p className="nb-success-email">📧 Изпратихме копие на <span>{email}</span></p>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download className="nb-dl-btn">
                  📥 Изтегли отново
                </a>
              </div>
            ) : (
              <>
                <div className="nb-form-top">
                  <span className="nb-form-icon">🎁</span>
                  <h3 className="nb-form-title">Изтегли Безплатно</h3>
                  <p className="nb-form-sub">
                    Над <strong>{downloadsK}</strong> фермери вече го изтеглиха.<br />
                    Получи и ти своя екземпляр — веднага.
                  </p>
                </div>

                <div className="nb-urgency" role="status">
                  <span className="nb-urg-dot" />
                  🔥 Изтегли го безплатно сега
                </div>

                <div className="nb-form-body">
                  <div className="nb-field-grp">
                    <div className="nb-field-lbl">
                      <span>ИМЕ <span style={{ color: '#ef4444' }}>*</span></span>
                      {touched.name && !nameErr && <span className="nb-field-ok">✓ Добре</span>}
                    </div>
                    <input type="text" placeholder="Георги Петров" value={name}
                      onChange={e => { setName(e.target.value); touch('name') }}
                      onBlur={() => touch('name')}
                      style={fieldStyle(nameErr, touched.name)}
                      aria-required="true" autoComplete="name" />
                    {touched.name && nameErr && <div className="nb-field-err" role="alert">⚠ {nameErr}</div>}
                  </div>

                  <div className="nb-field-grp">
                    <div className="nb-field-lbl">
                      <span>ИМЕЙЛ <span style={{ color: '#ef4444' }}>*</span></span>
                      {touched.email && !emailErr && <span className="nb-field-ok">✓ Добре</span>}
                    </div>
                    <input type="text" placeholder="email@example.com" value={email}
                      onChange={e => handleEmailChange(e.target.value)}
                      onBlur={() => touch('email')}
                      onPaste={e => { e.preventDefault(); handleEmailChange(e.clipboardData.getData('text')) }}
                      style={fieldStyle(emailErr, touched.email)}
                      aria-required="true" autoComplete="email"
                      inputMode="email" spellCheck={false} autoCapitalize="none" autoCorrect="off" />
                    {touched.email && emailErr && <div className="nb-field-err" role="alert">⚠ {emailErr}</div>}
                    <div className="nb-field-hint">📧 Ще получиш копие на наръчника на имейл</div>
                  </div>

                  <div className="nb-field-grp">
                    <div className="nb-field-lbl">
                      <span>ТЕЛЕФОН <span style={{ color: '#ef4444' }}>*</span></span>
                      {touched.phone && !phoneErr && <span className="nb-field-ok">✓ Добре</span>}
                    </div>
                    <input type="tel" placeholder="0887 123 456" value={phone}
                      onChange={e => handlePhoneChange(e.target.value)}
                      onBlur={() => touch('phone')}
                      onKeyDown={e => { if (e.key.length === 1 && /[^0-9+\-().\ ]/.test(e.key)) e.preventDefault() }}
                      onPaste={e => { e.preventDefault(); handlePhoneChange(e.clipboardData.getData('text')) }}
                      style={fieldStyle(phoneErr, touched.phone)}
                      aria-required="true" autoComplete="tel" inputMode="tel" />
                    {touched.phone && phoneErr && <div className="nb-field-err" role="alert">⚠ {phoneErr}</div>}
                    <div className="nb-field-hint">📞 За лична консултация при нужда</div>
                  </div>

                  {submitError && <div className="nb-err-box" role="alert">⚠ {submitError}</div>}

                  <button
                    className={`nb-cta ${loading ? 'nb-cta-loading' : isValid ? 'nb-cta-ready' : 'nb-cta-inactive'}`}
                    onClick={handleSubmit}
                    disabled={loading || !isValid}
                    aria-busy={loading}>
                    {loading ? '⏳ Подготвям наръчника...' : isValid ? '📥 Изтегли Безплатно Сега →' : '📋 Попълни всички полета'}
                  </button>
                </div>

                <div className="nb-trust">
                  <span>🔒 БЕЗ СПАМ</span>
                  <span>·</span>
                  <span>✅ БЕЗ РЕГИСТРАЦИЯ</span>
                  <span>·</span>
                  <span>📥 ДИРЕКТНО СВАЛЯНЕ</span>
                </div>
              </>
            )}
          </div>
        </aside>
      </main>

      <div className="nb-back">
        <a href="/">← Обратно към сайта</a>
      </div>
    </>
  )
}
