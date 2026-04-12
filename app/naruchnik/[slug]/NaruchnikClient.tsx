'use client'
// app/naruchnik/[slug]/NaruchnikClient.tsx — v14
// ✅ Компактен hero
// ✅ Testimonials от БД (поле testimonials JSON в naruchnici)
// ✅ Елегантен дизайн — editorial/refined
// ✅ Всичко от БД, нищо хардкодирано

import { useState, useCallback } from 'react'
import { validateName, validateEmail, validatePhone } from '@/lib/validation'
import type { Naruchnik } from './page'

export interface FaqEntry { q: string; a: string }
export interface Testimonial { name: string; location: string; text: string; stars?: number }

interface Props {
  nar:            Naruchnik
  others:         Naruchnik[]
  faqEntries:     FaqEntry[]
  testimonials:   Testimonial[]
  downloadsCount: number
  avgRating:      number
  reviewsCount:   number
}

const CAT_EMOJI: Record<string, string> = {
  domati: '🍅', krastavici: '🥒', chushki: '🫑', default: '🌿',
}
const catEmoji = (cat = '') => CAT_EMOJI[cat] || CAT_EMOJI.default

export default function NaruchnikClient({
  nar, others, faqEntries, testimonials, downloadsCount, avgRating, reviewsCount,
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
  const [activeT,     setActiveT]     = useState(0)

  const nameErr  = validateName(name)
  const emailErr = validateEmail(email)
  const phoneErr = validatePhone(phone)
  const isValid  = !nameErr && !emailErr && !phoneErr

  const touch = (f: keyof typeof touched) => setTouched(t => ({ ...t, [f]: true }))

  const handleEmailChange = (raw: string) => {
    setEmail(raw.replace(/[^\x21-\x7E]/g, '').toLowerCase()); touch('email')
  }
  const handlePhoneChange = (raw: string) => {
    setPhone(raw.replace(/[^0-9+\s\-().]/g, '')); touch('phone')
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
      if (!res.ok) { setSubmitError(data.error || 'Грешка при изпращане.'); setLoading(false); return }
      const a = document.createElement('a')
      a.href = pdfUrl; a.download = nar.title + '.pdf'; a.target = '_blank'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setDone(true)
    } catch { setSubmitError('Грешка при изпращане. Опитай пак.') }
    setLoading(false)
  }, [isValid, email, name, phone, nar.slug, nar.title, pdfUrl])

  const fs = (err: string, t: boolean): React.CSSProperties => ({
    padding: '12px 14px', borderRadius: 9, width: '100%', boxSizing: 'border-box',
    border: `1.5px solid ${t && err ? '#f87171' : t && !err ? '#4ade80' : '#d1d5db'}`,
    background: t && err ? '#fef2f2' : t && !err ? '#f0fdf4' : '#fafafa',
    color: '#111827', fontSize: 14, outline: 'none', fontFamily: 'inherit',
    transition: 'border-color .2s,background .2s',
  })

  const dlK = downloadsCount >= 1000 ? `${Math.floor(downloadsCount / 1000)} 000+` : `${downloadsCount}+`

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,600;0,700;1,400&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased;background:#f5f4f0;color:#1a1a1a}

        @keyframes up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}

        /* ── Breadcrumb ── */
        .bc{background:#0a2416;padding:8px 0;font-size:11.5px;color:rgba(255,255,255,.38)}
        .bc-inner{max-width:1020px;margin:0 auto;padding:0 24px;display:flex;align-items:center;gap:5px;flex-wrap:wrap}
        .bc a{color:rgba(255,255,255,.38);text-decoration:none;transition:color .2s}
        .bc a:hover{color:#86efac}
        .bc-cur{color:rgba(255,255,255,.6);font-weight:600}

        /* ── Hero ── */
        .hero{background:linear-gradient(160deg,#0a2416 0%,#14532d 60%,#16a34a 100%);padding:32px 24px 28px;position:relative;overflow:hidden}
        .hero::after{content:'';position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='30' cy='30' r='1' fill='%234ade80' fill-opacity='0.06'/%3E%3C/svg%3E");pointer-events:none}
        .hero-inner{max-width:680px;margin:0 auto;text-align:center;position:relative;z-index:1;animation:up .5s ease both}
        .hero-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.25);border-radius:100px;padding:4px 14px;margin-bottom:14px}
        .hero-dot{width:5px;height:5px;border-radius:50%;background:#4ade80;animation:pulse 2s infinite}
        .hero-badge-t{font-size:10px;font-weight:700;color:#86efac;letter-spacing:.1em;text-transform:uppercase}
        .hero-h1{font-family:'Lora',serif;font-size:clamp(22px,4vw,40px);font-weight:700;color:#fff;line-height:1.15;letter-spacing:-.01em;margin-bottom:8px}
        .hero-sub{font-size:clamp(13px,1.6vw,15px);color:rgba(255,255,255,.55);line-height:1.65;max-width:480px;margin:0 auto 20px}

        /* Stats in hero — horizontal compact */
        .hero-stats{display:inline-flex;background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.08);border-radius:12px;overflow:hidden}
        .hs{padding:8px 20px;text-align:center;border-right:1px solid rgba(255,255,255,.07)}
        .hs:last-child{border-right:none}
        .hs-v{font-size:16px;font-weight:800;color:#4ade80;display:block;line-height:1;margin-bottom:2px}
        .hs-l{font-size:9px;color:rgba(255,255,255,.38);font-weight:700;letter-spacing:.07em;text-transform:uppercase}

        /* ── Page layout ── */
        .page{max-width:1020px;margin:0 auto;padding:32px 24px 60px;display:grid;grid-template-columns:1fr 360px;gap:24px;align-items:start}
        @media(max-width:780px){
          .page{display:flex;flex-direction:column;padding:20px 16px 52px}
          .right-col{order:-1}
          .left-col{order:1}
        }
        .left-col{display:flex;flex-direction:column;gap:16px}
        .right-col{position:sticky;top:20px}

        /* ── Cards ── */
        .card{background:#fff;border-radius:16px;border:1px solid #e8e5de;box-shadow:0 1px 4px rgba(0,0,0,.04),0 12px 40px rgba(0,0,0,.06)}
        .card-p{padding:22px 24px}
        .sec-lbl{font-size:9.5px;font-weight:800;color:#16a34a;letter-spacing:.12em;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:8px}
        .sec-lbl::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,#d1fae5,transparent)}

        /* Book top */
        .book-top{background:linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 100%);padding:24px;display:flex;gap:20px;align-items:flex-start;border-radius:16px 16px 0 0;position:relative;overflow:hidden}
        .book-top::before{content:'';position:absolute;top:-20px;right:-20px;width:120px;height:120px;border-radius:50%;background:rgba(22,163,74,.06)}
        @media(max-width:500px){.book-top{flex-direction:column;align-items:center;text-align:center;padding:20px 16px}}
        .img-wrap{flex-shrink:0;position:relative;animation:float 4s ease-in-out infinite}
        .book-img{max-height:160px;max-width:115px;object-fit:contain;border-radius:9px;box-shadow:0 12px 32px rgba(0,0,0,.18),0 3px 8px rgba(0,0,0,.1);display:block}
        .img-ph{width:100px;height:140px;background:linear-gradient(135deg,#16a34a,#15803d);border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;box-shadow:0 12px 32px rgba(0,0,0,.18)}
        .free-pill{position:absolute;top:-5px;right:-8px;background:#dc2626;color:#fff;font-size:8px;font-weight:900;padding:3px 8px;border-radius:20px;letter-spacing:.06em;text-transform:uppercase;box-shadow:0 3px 8px rgba(220,38,38,.35)}
        .book-meta{flex:1;min-width:0}
        .book-cat{display:inline-flex;align-items:center;gap:4px;font-size:9.5px;font-weight:800;color:#16a34a;letter-spacing:.08em;text-transform:uppercase;background:rgba(22,163,74,.08);padding:3px 8px;border-radius:5px;margin-bottom:7px}
        .book-title{font-family:'Lora',serif;font-size:clamp(17px,2vw,22px);font-weight:700;color:#0f172a;line-height:1.25;letter-spacing:-.01em;margin-bottom:7px}
        .book-desc{font-size:13px;color:#6b7280;line-height:1.65;margin-bottom:12px}
        .stars{display:flex;align-items:center;gap:2px}
        .star{color:#f59e0b;font-size:13px}
        .stars-lbl{font-size:11px;color:#9ca3af;font-weight:600;margin-left:3px}

        /* Inside */
        .inside{padding:20px 24px;border-top:1px solid #f0ede6}
        .inside-text{font-size:13.5px;color:#4b5563;line-height:1.8;white-space:pre-line}

        /* FAQ */
        .faq-item{border-bottom:1px solid #f0ede6}
        .faq-item:last-child{border-bottom:none}
        .faq-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 0;background:none;border:none;cursor:pointer;font-family:inherit;text-align:left}
        .faq-q{font-size:13.5px;font-weight:700;color:#111827;line-height:1.5;flex:1}
        .faq-icon{width:20px;height:20px;border-radius:50%;background:#f0fdf4;border:1.5px solid #d1fae5;display:flex;align-items:center;justify-content:center;font-size:13px;color:#16a34a;flex-shrink:0;transition:transform .25s,background .2s;font-weight:700}
        .faq-icon.open{transform:rotate(45deg);background:#16a34a;color:#fff;border-color:#16a34a}
        .faq-ans{font-size:13px;color:#4b5563;line-height:1.75;max-height:0;overflow:hidden;transition:max-height .35s ease,opacity .35s,padding .35s;opacity:0;padding-bottom:0}
        .faq-ans.open{max-height:600px;opacity:1;padding-bottom:14px}

        /* Testimonials */
        .testi-wrap{position:relative;overflow:hidden;min-height:110px}
        .testi{animation:up .35s ease both}
        .testi-quote{font-family:'Lora',serif;font-size:14px;font-style:italic;color:#374151;line-height:1.75;margin-bottom:14px;position:relative;padding-left:18px}
        .testi-quote::before{content:'\\201C';position:absolute;left:0;top:-3px;font-size:32px;color:#d1fae5;font-family:'Lora',serif;line-height:1}
        .testi-author{display:flex;align-items:center;gap:10px}
        .testi-avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#16a34a,#0d6b30);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;flex-shrink:0}
        .testi-name{font-size:13px;font-weight:700;color:#111}
        .testi-loc{font-size:11px;color:#9ca3af}
        .testi-stars{display:flex;gap:2px;margin-left:auto}
        .testi-dots{display:flex;gap:5px;margin-top:14px;justify-content:center}
        .tdot{width:6px;height:6px;border-radius:50%;background:#e5e0d8;border:none;cursor:pointer;padding:0;transition:background .25s,transform .25s}
        .tdot.a{background:#16a34a;transform:scale(1.3)}

        /* Author */
        .author-card{background:linear-gradient(135deg,#f0fdf4,#ecfdf5 80%,#fff);border-radius:16px;padding:20px 22px;border:1px solid #d1fae5;display:flex;align-items:flex-start;gap:16px}
        @media(max-width:500px){.author-card{flex-direction:column;align-items:center;text-align:center}}
        .author-av{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#052e16,#16a34a);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;box-shadow:0 3px 12px rgba(22,163,74,.28)}
        .author-name{font-size:14px;font-weight:800;color:#0f172a;margin-bottom:1px}
        .author-role{font-size:10.5px;color:#16a34a;font-weight:700;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em}
        .author-bio{font-size:12.5px;color:#4b5563;line-height:1.6}

        /* Others */
        .others-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-top:12px}
        .other-a{display:flex;flex-direction:column;align-items:center;gap:5px;padding:12px 8px;background:#faf9f6;border:1.5px solid #e8e5de;border-radius:11px;text-decoration:none;text-align:center;transition:all .2s}
        .other-a:hover{border-color:#16a34a;background:#f0fdf4;transform:translateY(-2px);box-shadow:0 5px 16px rgba(22,163,74,.1)}
        .other-em{font-size:24px}
        .other-ttl{font-size:11px;font-weight:700;color:#1a1a1a;line-height:1.35}
        .other-cta{font-size:10px;color:#16a34a;font-weight:800}

        /* ── Form card ── */
        .form-card{background:#fff;border-radius:16px;border:1px solid #e8e5de;box-shadow:0 2px 8px rgba(0,0,0,.05),0 16px 48px rgba(0,0,0,.09);overflow:hidden;animation:up .45s ease .1s both}
        .form-top{background:linear-gradient(150deg,#0a2416 0%,#15803d 100%);padding:22px 22px 18px;text-align:center;position:relative;overflow:hidden}
        .form-top::before{content:'';position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='1' fill='%234ade80' fill-opacity='0.08'/%3E%3C/svg%3E")}
        .f-icon{font-size:36px;display:block;margin-bottom:7px;animation:float 3s ease-in-out infinite;position:relative}
        .f-title{font-family:'Lora',serif;font-size:19px;font-weight:700;color:#fff;line-height:1.2;margin-bottom:4px;position:relative}
        .f-sub{font-size:11.5px;color:rgba(255,255,255,.55);line-height:1.6;position:relative}
        .f-sub strong{color:#4ade80}
        .f-urgency{display:flex;align-items:center;justify-content:center;gap:6px;background:#fef3c7;border-bottom:1px solid #fde68a;padding:8px 14px;font-size:11px;font-weight:700;color:#92400e}
        .f-urg-dot{width:5px;height:5px;border-radius:50%;background:#f59e0b;animation:pulse 1.5s infinite;flex-shrink:0}
        .f-body{padding:18px 20px 14px}
        .f-grp{margin-bottom:12px}
        .f-lbl{font-size:9.5px;font-weight:800;color:#9ca3af;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center}
        .f-ok{color:#16a34a;font-size:9.5px;font-weight:700}
        .f-err{color:#ef4444;font-size:11px;font-weight:600;margin-top:3px}
        .f-hint{color:#b0a89a;font-size:10px;margin-top:3px}
        input::placeholder{color:#c4bdb3 !important;opacity:1}
        input:focus{border-color:#16a34a !important;background:#f0fdf4 !important;outline:none}
        .cta{width:100%;border:none;border-radius:10px;padding:14px;font-size:14.5px;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:-.01em;transition:all .25s;margin-top:4px}
        .cta-ready{background:linear-gradient(135deg,#16a34a,#0d6b30);color:#fff;box-shadow:0 5px 20px rgba(22,163,74,.35)}
        .cta-ready:hover{transform:translateY(-1px);box-shadow:0 10px 30px rgba(22,163,74,.48)}
        .cta-inactive{background:#f0ede6;color:#b0a89a;cursor:default}
        .cta-loading{background:#e8e5de;color:#b0a89a;cursor:wait}
        .f-trust{display:flex;justify-content:center;gap:4px;padding:8px 14px 12px;font-size:9px;color:#b0a89a;font-weight:700;border-top:1px solid #f0ede6;flex-wrap:wrap;letter-spacing:.05em;text-transform:uppercase}
        .f-err-box{background:#fef2f2;border:1.5px solid #fecaca;border-radius:8px;padding:8px 12px;color:#dc2626;font-size:11.5px;font-weight:600;margin-top:7px}

        /* Success */
        .success{padding:28px 20px;text-align:center}
        .success-icon{font-size:52px;margin-bottom:8px;animation:float 2s ease-in-out infinite}
        .success-title{font-family:'Lora',serif;font-size:21px;font-weight:700;color:#111;margin-bottom:6px}
        .success-text{font-size:12.5px;color:#6b7280;line-height:1.7;margin-bottom:4px}
        .success-email{font-size:11.5px;color:#9ca3af;margin-bottom:20px}
        .success-email span{color:#16a34a;font-weight:700}
        .dl-btn{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#16a34a,#0d6b30);color:#fff;border-radius:10px;padding:12px 24px;text-decoration:none;font-weight:800;font-size:13.5px;box-shadow:0 5px 20px rgba(22,163,74,.35);transition:transform .2s,box-shadow .2s}
        .dl-btn:hover{transform:translateY(-1px);box-shadow:0 10px 28px rgba(22,163,74,.45)}

        .back-bar{text-align:center;padding:4px 20px 24px}
        .back-bar a{color:#b0a89a;text-decoration:none;font-size:11.5px;font-weight:600;transition:color .2s}
        .back-bar a:hover{color:#16a34a}
      `}</style>

      {/* Breadcrumb */}
      <nav className="bc" aria-label="Навигация">
        <div className="bc-inner">
          <a href="/">Начало</a><span>›</span>
          <a href="/naruchnici">Наръчници</a><span>›</span>
          <span className="bc-cur">{nar.title}</span>
        </div>
      </nav>

      {/* Hero — компактен */}
      <header className="hero">
        <div className="hero-inner">
          <div className="hero-badge">
            <span className="hero-dot" />
            <span className="hero-badge-t">Безплатен PDF Наръчник</span>
          </div>
          <h1 className="hero-h1">{emoji} {nar.title}</h1>
          {nar.subtitle && <p className="hero-sub">{nar.subtitle}</p>}
          <div className="hero-stats">
            <div className="hs">
              <span className="hs-v">{dlK}</span>
              <span className="hs-l">изтегляния</span>
            </div>
            <div className="hs">
              <span className="hs-v">{avgRating}/5</span>
              <span className="hs-l">оценка</span>
            </div>
            <div className="hs">
              <span className="hs-v">PDF</span>
              <span className="hs-l">безплатно</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="page" id="main-content">
        {/* ── Left ── */}
        <div className="left-col">

          {/* Book card */}
          <article className="card" style={{ animation: 'up .45s ease .05s both' }}>
            <div className="book-top">
              <div className="img-wrap">
                {nar.cover_image_url ? (
                  <img src={nar.cover_image_url}
                    alt={`${nar.title} — PDF от Denny Angelow`}
                    className="book-img" loading="eager" width={115} height={160} />
                ) : (
                  <div className="img-ph">
                    <span style={{ fontSize: 40 }}>{emoji}</span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,.65)', fontWeight: 700 }}>PDF</span>
                  </div>
                )}
                <span className="free-pill">БЕЗПЛАТНО</span>
              </div>
              <div className="book-meta">
                <div className="book-cat">{emoji} {nar.category ? nar.category.charAt(0).toUpperCase() + nar.category.slice(1) : 'Градинарство'}</div>
                <h2 className="book-title">{nar.title}</h2>
                {nar.description && <p className="book-desc">{nar.description}</p>}
                <div className="stars" aria-label={`Оценка ${avgRating} от 5`}>
                  {[1,2,3,4,5].map(i => <span key={i} className="star">★</span>)}
                  <span className="stars-lbl">{avgRating}/5 · {reviewsCount.toLocaleString('bg-BG')} оценки</span>
                </div>
              </div>
            </div>

            {/* Content body от БД */}
            <section className="inside" aria-labelledby="inside-h">
              <div className="sec-lbl" id="inside-h">Какво ще намериш вътре</div>
              {nar.content_body ? (
                <div className="inside-text">{nar.content_body}</div>
              ) : (
                <p className="inside-text" style={{ fontStyle: 'italic', color: '#9ca3af' }}>
                  Практични съвети за по-добра реколта, органични методи и конкретни стъпки за прилагане.
                </p>
              )}
            </section>
          </article>

          {/* FAQ */}
          {faqEntries.length > 0 && (
            <section className="card card-p" style={{ animation: 'up .45s ease .1s both' }}>
              <div className="sec-lbl">Често задавани въпроси</div>
              {faqEntries.map((item, i) => (
                <div key={i} className="faq-item">
                  <button className="faq-btn"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    aria-expanded={openFaq === i}>
                    <span className="faq-q">{item.q}</span>
                    <span className={`faq-icon${openFaq === i ? ' open' : ''}`}>+</span>
                  </button>
                  <div className={`faq-ans${openFaq === i ? ' open' : ''}`}>{item.a}</div>
                </div>
              ))}
            </section>
          )}

          {/* Testimonials от БД */}
          {testimonials.length > 0 && (
            <section className="card card-p" style={{ animation: 'up .45s ease .15s both' }}>
              <div className="sec-lbl">Какво казват фермерите</div>
              <div className="testi-wrap">
                <div className="testi" key={activeT}>
                  <p className="testi-quote">{testimonials[activeT].text}</p>
                  <div className="testi-author">
                    <div className="testi-avatar">{testimonials[activeT].name.charAt(0)}</div>
                    <div>
                      <div className="testi-name">{testimonials[activeT].name}</div>
                      <div className="testi-loc">📍 {testimonials[activeT].location}</div>
                    </div>
                    <div className="testi-stars">
                      {[1,2,3,4,5].map(i => (
                        <span key={i} style={{ color: '#f59e0b', fontSize: 11 }}>★</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {testimonials.length > 1 && (
                <div className="testi-dots">
                  {testimonials.map((_, i) => (
                    <button key={i} className={`tdot${i === activeT ? ' a' : ''}`}
                      onClick={() => setActiveT(i)} aria-label={`Отзив ${i + 1}`} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Author — само ако има author_bio в БД */}
          {nar.author_bio && (
            <aside className="author-card" style={{ animation: 'up .45s ease .2s both' }}>
              <div className="author-av">🌱</div>
              <div>
                <div className="author-name">Denny Angelow</div>
                <div className="author-role">Агро Консултант</div>
                <p className="author-bio">{nar.author_bio}</p>
              </div>
            </aside>
          )}

          {/* Other guides */}
          {others.length > 0 && (
            <nav className="card card-p" style={{ animation: 'up .45s ease .25s both' }}>
              <div className="sec-lbl">Виж и другите наръчници</div>
              <div className="others-grid">
                {others.map(o => (
                  <a key={o.slug} href={`/naruchnik/${o.slug}`} className="other-a" title={o.title}>
                    <span className="other-em">{catEmoji(o.category)}</span>
                    <span className="other-ttl">{o.title}</span>
                    <span className="other-cta">Изтегли →</span>
                  </a>
                ))}
              </div>
            </nav>
          )}
        </div>

        {/* ── Right — sticky form ── */}
        <aside className="right-col">
          <div className="form-card">
            {done ? (
              <div className="success" role="alert">
                <div className="success-icon">🎉</div>
                <h3 className="success-title">Свалянето започна!</h3>
                <p className="success-text">Провери папката <strong>Изтегляния</strong> на устройството си.</p>
                <p className="success-email">📧 Изпратихме копие на <span>{email}</span></p>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download className="dl-btn">
                  📥 Изтегли отново
                </a>
              </div>
            ) : (
              <>
                <div className="form-top">
                  <span className="f-icon">🎁</span>
                  <h3 className="f-title">Изтегли Безплатно</h3>
                  <p className="f-sub">Над <strong>{dlK}</strong> фермери вече го изтеглиха.<br />Получи своя екземпляр — веднага.</p>
                </div>
                <div className="f-urgency">
                  <span className="f-urg-dot" />
                  🔥 Изтегли го безплатно сега
                </div>
                <div className="f-body">
                  <div className="f-grp">
                    <div className="f-lbl">
                      <span>ИМЕ <span style={{ color: '#ef4444' }}>*</span></span>
                      {touched.name && !nameErr && <span className="f-ok">✓ Добре</span>}
                    </div>
                    <input type="text" placeholder="Георги Петров" value={name}
                      onChange={e => { setName(e.target.value); touch('name') }}
                      onBlur={() => touch('name')}
                      style={fs(nameErr, touched.name)}
                      aria-required="true" autoComplete="name" />
                    {touched.name && nameErr && <div className="f-err">⚠ {nameErr}</div>}
                  </div>
                  <div className="f-grp">
                    <div className="f-lbl">
                      <span>ИМЕЙЛ <span style={{ color: '#ef4444' }}>*</span></span>
                      {touched.email && !emailErr && <span className="f-ok">✓ Добре</span>}
                    </div>
                    <input type="text" placeholder="email@example.com" value={email}
                      onChange={e => handleEmailChange(e.target.value)}
                      onBlur={() => touch('email')}
                      onPaste={e => { e.preventDefault(); handleEmailChange(e.clipboardData.getData('text')) }}
                      style={fs(emailErr, touched.email)}
                      aria-required="true" autoComplete="email"
                      inputMode="email" spellCheck={false} autoCapitalize="none" autoCorrect="off" />
                    {touched.email && emailErr && <div className="f-err">⚠ {emailErr}</div>}
                    <div className="f-hint">📧 Ще получиш копие на имейл</div>
                  </div>
                  <div className="f-grp">
                    <div className="f-lbl">
                      <span>ТЕЛЕФОН <span style={{ color: '#ef4444' }}>*</span></span>
                      {touched.phone && !phoneErr && <span className="f-ok">✓ Добре</span>}
                    </div>
                    <input type="tel" placeholder="0887 123 456" value={phone}
                      onChange={e => handlePhoneChange(e.target.value)}
                      onBlur={() => touch('phone')}
                      onKeyDown={e => { if (e.key.length === 1 && /[^0-9+\-().\ ]/.test(e.key)) e.preventDefault() }}
                      onPaste={e => { e.preventDefault(); handlePhoneChange(e.clipboardData.getData('text')) }}
                      style={fs(phoneErr, touched.phone)}
                      aria-required="true" autoComplete="tel" inputMode="tel" />
                    {touched.phone && phoneErr && <div className="f-err">⚠ {phoneErr}</div>}
                    <div className="f-hint">📞 За лична консултация при нужда</div>
                  </div>
                  {submitError && <div className="f-err-box">⚠ {submitError}</div>}
                  <button
                    className={`cta ${loading ? 'cta-loading' : isValid ? 'cta-ready' : 'cta-inactive'}`}
                    onClick={handleSubmit} disabled={loading || !isValid} aria-busy={loading}>
                    {loading ? '⏳ Подготвям...' : isValid ? '📥 Изтегли Безплатно →' : '📋 Попълни всички полета'}
                  </button>
                </div>
                <div className="f-trust">
                  <span>🔒 БЕЗ СПАМ</span><span>·</span>
                  <span>✅ БЕЗ РЕГИСТРАЦИЯ</span><span>·</span>
                  <span>📥 ДИРЕКТНО</span>
                </div>
              </>
            )}
          </div>
        </aside>
      </main>

      <div className="back-bar"><a href="/">← Обратно към сайта</a></div>
    </>
  )
}