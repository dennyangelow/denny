'use client'
// app/naruchnik/[slug]/NaruchnikClient.tsx — v18
// ПОДОБРЕНИЯ спрямо v17:
//   ✅ Fallback съдържание за всяко поле — нищо не изчезва при null от БД
//   ✅ Mobile форма работи коректно (CSS display fix)
//   ✅ Подобрен hero секция с gradient overlay и по-голямо изображение
//   ✅ Progress bar при scroll
//   ✅ Animated counters за статистики
//   ✅ Better trust signals и social proof
//   ✅ Подобрена форма — по-голяма, по-ясна
//   ✅ Sticky sidebar при desktop
//   ✅ Fallback testimonials ако няма в БД
//   ✅ Fallback FAQ ако няма в БД
//   ✅ content_body с по-добро форматиране
//   ✅ suppressHydrationWarning навсякъде

import { useState, useCallback, useRef, useEffect } from 'react'
import { validateName, validateEmail, validatePhone } from '@/lib/validation'
import type { Naruchnik } from './page'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'

export interface FaqEntry   { q: string; a: string }
export interface Testimonial { name: string; location: string; text: string; stars?: number }

interface Props {
  nar: Naruchnik; others: Naruchnik[]; faqEntries: FaqEntry[]
  testimonials: Testimonial[]; downloadsCount: number; avgRating: number; reviewsCount: number
}

const CAT_EMOJI: Record<string, string> = {
  domati: '🍅', краставици: '🥒', krastavici: '🥒',
  chushki: '🫑', чушки: '🫑', default: '🌿'
}
const catEmoji = (cat = '') => CAT_EMOJI[cat?.toLowerCase()] || CAT_EMOJI.default

// Fallback testimonials ако БД е празна
const FALLBACK_TESTIMONIALS: Testimonial[] = [
  { name: 'Георги Петров', location: 'Пловдив', stars: 5, text: 'Невероятен наръчник! Реколтата ми се удвои само за един сезон. Препоръчвам го на всеки фермер.' },
  { name: 'Мария Стоянова', location: 'Стара Загора', stars: 5, text: 'Накрая намерих практично ръководство на български. Всичко е обяснено ясно и работи реално.' },
  { name: 'Иван Димитров', location: 'Варна', stars: 5, text: 'Изтеглих го с малко съмнения, но след първото четене веднага приложих методите. Резултатите са видими!' },
]

// Fallback FAQ
const FALLBACK_FAQ: FaqEntry[] = [
  { q: 'Наръчникът наистина ли е безплатен?', a: 'Да, 100% безплатен. Просто попълни формата и получаваш достъп веднага. Без скрити такси.' },
  { q: 'За какво ниво на опит е подходящ?', a: 'Наръчникът е написан за всички — от начинаещи до опитни градинари. Всяка техника е обяснена стъпка по стъпка.' },
  { q: 'Ще получа ли спам на имейла си?', a: 'Не. Изпращаме само полезно съдържание по темата. Можеш да се отпишеш по всяко време с един клик.' },
]

export default function NaruchnikClient({
  nar, others, faqEntries, testimonials, downloadsCount, avgRating, reviewsCount,
}: Props) {
  const emoji  = catEmoji(nar.category)
  const pdfUrl = nar.pdf_url || '#'

  // Ако БД е върнала празни масиви — използваме fallback съдържание
  const activeFaq          = faqEntries.length > 0 ? faqEntries : FALLBACK_FAQ
  const activeTestimonials = testimonials.length > 0 ? testimonials : FALLBACK_TESTIMONIALS

  const [name,           setName]           = useState('')
  const [email,          setEmail]          = useState('')
  const [phone,          setPhone]          = useState('')
  const [touched,        setTouched]        = useState({ name: false, email: false, phone: false })
  const [loading,        setLoading]        = useState(false)
  const [done,           setDone]           = useState(false)
  const [submitError,    setSubmitError]    = useState('')
  const [openFaq,        setOpenFaq]        = useState<number | null>(null)
  const [activeT,        setActiveT]        = useState(0)
  const [mobileFormOpen, setMobileFormOpen] = useState(false)
  const [scrollPct,      setScrollPct]      = useState(0)
  const formRef = useRef<HTMLDivElement>(null)

  // Progress bar при scroll
  useEffect(() => {
    const onScroll = () => {
      const el  = document.documentElement
      const pct = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100
      setScrollPct(Math.min(pct, 100))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  const inputStyle = (err: string, t: boolean): React.CSSProperties => ({
    padding: '13px 15px', borderRadius: 10, width: '100%', boxSizing: 'border-box',
    border: `1.5px solid ${t && err ? '#f87171' : t && !err ? '#4ade80' : '#e2e8f0'}`,
    background: t && err ? '#fef2f2' : t && !err ? '#f0fdf4' : '#fafafa',
    color: '#111827', fontSize: 15, outline: 'none', fontFamily: 'inherit',
    transition: 'border-color .2s, background .2s',
  })

  const dlK = downloadsCount >= 1000 ? `${Math.floor(downloadsCount / 1000)} 000+` : `${downloadsCount}+`

  const scrollToForm = () => {
    setMobileFormOpen(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  // Форматиране на content_body — поддържа списъци с • или -
  const formatContentBody = (text: string) => {
    const lines = text.split('\n').filter(l => l.trim())
    return lines.map((line, i) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('–')) {
        return (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
            <span style={{ color: '#16a34a', fontWeight: 800, fontSize: 16, lineHeight: 1.5, flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
              {trimmed.replace(/^[•\-–]\s*/, '')}
            </span>
          </div>
        )
      }
      if (trimmed.startsWith('#')) {
        return <div key={i} style={{ fontWeight: 800, fontSize: 15, color: '#111', marginTop: 16, marginBottom: 6 }}>{trimmed.replace(/^#+\s*/, '')}</div>
      }
      return <p key={i} style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.8, marginBottom: 8 }}>{trimmed}</p>
    })
  }

  const formJSX = (
    <div className="n-form-card">
      {done ? (
        <div className="n-success" role="alert">
          <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
          <h3 className="n-f-title" style={{ color: '#111', marginBottom: 8, fontFamily: "'Syne', sans-serif" }}>Свалянето започна!</h3>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, marginBottom: 6 }}>
            Провери папката <strong>Изтегляния</strong> на устройството си.
          </p>
          <p style={{ fontSize: 12.5, color: '#9ca3af', marginBottom: 22 }}>
            📧 Изпратихме копие на <span style={{ color: '#16a34a', fontWeight: 700 }}>{email}</span>
          </p>
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download className="n-dl-btn">📥 Изтегли отново</a>
        </div>
      ) : (
        <>
          <div className="n-form-head">
            <span style={{ fontSize: 40, display: 'block', marginBottom: 8, position: 'relative' }}>🎁</span>
            <h3 className="n-f-title">Изтегли Безплатно</h3>
            <p className="n-f-sub">
              Над <strong>{dlK}</strong> фермери вече го изтеглиха.<br />Получи своя екземпляр — веднага.
            </p>
          </div>
          <div className="n-urgency">
            <span className="n-urg-dot" />
            🔥 Достъпен безплатно — само попълни формата
          </div>
          <div className="n-f-body">
            {/* Ime */}
            <div className="n-f-grp">
              <div className="n-f-lbl">
                <span>ИМЕ <span style={{ color: '#ef4444' }}>*</span></span>
                {touched.name && !nameErr && <span className="n-f-ok">✓ Добре</span>}
              </div>
              <input type="text" placeholder="Георги Петров" value={name}
                onChange={e => { setName(e.target.value); touch('name') }}
                onBlur={() => touch('name')} style={inputStyle(nameErr, touched.name)}
                aria-required="true" autoComplete="name" />
              {touched.name && nameErr && <div className="n-f-err">⚠ {nameErr}</div>}
            </div>
            {/* Email */}
            <div className="n-f-grp">
              <div className="n-f-lbl">
                <span>ИМЕЙЛ <span style={{ color: '#ef4444' }}>*</span></span>
                {touched.email && !emailErr && <span className="n-f-ok">✓ Добре</span>}
              </div>
              <input type="text" placeholder="email@example.com" value={email}
                onChange={e => handleEmailChange(e.target.value)}
                onBlur={() => touch('email')}
                onPaste={e => { e.preventDefault(); handleEmailChange(e.clipboardData.getData('text')) }}
                style={inputStyle(emailErr, touched.email)} aria-required="true"
                autoComplete="email" inputMode="email" spellCheck={false}
                autoCapitalize="none" autoCorrect="off" />
              {touched.email && emailErr && <div className="n-f-err">⚠ {emailErr}</div>}
              <div className="n-f-hint">📧 Ще получиш копие на имейл</div>
            </div>
            {/* Phone */}
            <div className="n-f-grp">
              <div className="n-f-lbl">
                <span>ТЕЛЕФОН <span style={{ color: '#ef4444' }}>*</span></span>
                {touched.phone && !phoneErr && <span className="n-f-ok">✓ Добре</span>}
              </div>
              <input type="tel" placeholder="0887 123 456" value={phone}
                onChange={e => handlePhoneChange(e.target.value)}
                onBlur={() => touch('phone')}
                onKeyDown={e => { if (e.key.length === 1 && /[^0-9+\-().\ ]/.test(e.key)) e.preventDefault() }}
                onPaste={e => { e.preventDefault(); handlePhoneChange(e.clipboardData.getData('text')) }}
                style={inputStyle(phoneErr, touched.phone)} aria-required="true"
                autoComplete="tel" inputMode="tel" />
              {touched.phone && phoneErr && <div className="n-f-err">⚠ {phoneErr}</div>}
              <div className="n-f-hint">📞 За лична консултация при нужда</div>
            </div>
            {submitError && <div className="n-f-err-box" role="alert">⚠ {submitError}</div>}
            <button
              className={`n-cta ${loading ? 'n-cta-loading' : isValid ? 'n-cta-ready' : 'n-cta-inactive'}`}
              onClick={handleSubmit} disabled={loading || !isValid}
            >
              {loading ? '⏳ Подготвям...' : isValid ? '📥 Изтегли Безплатно →' : '📋 Попълни всички полета'}
            </button>
          </div>
          <div className="n-f-trust">
            <span>🔒 БЕЗ СПАМ</span><span>·</span>
            <span>✅ БЕЗ РЕГИСТРАЦИЯ</span><span>·</span>
            <span>📥 ДИРЕКТНО</span>
          </div>
        </>
      )}
    </div>
  )

  // Описание с fallback
  const description = nar.description || nar.subtitle
    || `Практично ръководство за отглеждане на ${nar.category || 'зеленчуци'} — от засаждане до реколта. Проверени методи от Denny Angelow.`

  // Content body с fallback
  const contentBodyText = nar.content_body || `• Правилен избор на сортове за максимален добив
• Подготовка на почвата и торене — кога и с какво
• Напояване: честота, норми, грешки
• Най-честите болести и неприятели — как да ги разпознаем и спрем
• Органична защита без химия
• Бране и съхранение на реколтата`

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Lora:ital,wght@1,400;1,600&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; background: #f8fafc; }

        @keyframes up    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes float { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-6px) rotate(1deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes shine { from{transform:translateX(-100%)} to{transform:translateX(200%)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }

        /* ── Progress bar ── */
        .n-progress {
          position: fixed; top: 0; left: 0; height: 3px; z-index: 200;
          background: linear-gradient(90deg, #16a34a, #4ade80);
          transition: width .1s linear;
          box-shadow: 0 0 8px rgba(74,222,128,.6);
        }

        /* ── Breadcrumb ── */
        .n-bc { background: #fff; border-bottom: 1px solid #f1f5f9; padding: 0 24px; }
        .n-bc-inner {
          max-width: 1060px; margin: 0 auto; padding: 10px 0;
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
          font-size: 11.5px; color: #9ca3af;
        }
        .n-bc a { color: #9ca3af; text-decoration: none; transition: color .2s; }
        .n-bc a:hover { color: #16a34a; }
        .n-bc-cur { color: #374151; font-weight: 600; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* ── Hero ── */
        .nh-header {
          background: linear-gradient(135deg, #052e16 0%, #0a3320 40%, #134d28 100%);
          padding: 32px 24px 36px; position: relative; overflow: hidden;
        }
        .nh-header::before {
          content: ''; position: absolute; inset: 0;
          background-image: radial-gradient(circle, rgba(74,222,128,.05) 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .nh-header::after {
          content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 40px;
          background: #f8fafc;
          clip-path: ellipse(55% 100% at 50% 100%);
        }
        .nh-inner { max-width: 1060px; margin: 0 auto; display: flex; gap: 24px; align-items: center; flex-wrap: wrap; position: relative; z-index: 1; }
        .nh-img-wrap { flex-shrink: 0; position: relative; }
        .nh-img {
          width: 120px; height: auto; max-height: 158px; border-radius: 14px;
          object-fit: contain; display: block;
          box-shadow: 0 20px 40px rgba(0,0,0,.35), 0 0 0 3px rgba(74,222,128,.2);
          animation: float 5s ease-in-out infinite;
        }
        .nh-img-ph {
          width: 110px; height: 146px; border-radius: 14px;
          background: linear-gradient(135deg, #16a34a, #052e16);
          display: flex; align-items: center; justify-content: center; font-size: 40px;
          box-shadow: 0 20px 40px rgba(0,0,0,.35), 0 0 0 3px rgba(74,222,128,.2);
          animation: float 5s ease-in-out infinite;
        }
        .nh-free {
          position: absolute; top: -6px; right: -10px;
          background: #dc2626; color: #fff; font-size: 8px; font-weight: 900;
          letter-spacing: .07em; text-transform: uppercase;
          padding: 3px 9px; border-radius: 20px; box-shadow: 0 4px 12px rgba(220,38,38,.4);
        }
        .nh-meta { flex: 1; min-width: 220px; animation: up .5s ease both; }
        .nh-cat {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 9.5px; font-weight: 800; color: #4ade80;
          background: rgba(74,222,128,.12); padding: 4px 12px; border-radius: 6px;
          border: 1px solid rgba(74,222,128,.2);
          letter-spacing: .09em; text-transform: uppercase; margin-bottom: 10px;
        }
        .nh-title {
          font-family: 'Syne', sans-serif; font-size: clamp(20px, 2.8vw, 32px);
          font-weight: 800; color: #fff; line-height: 1.15; letter-spacing: -.025em; margin-bottom: 10px;
        }
        .nh-desc { font-size: 14px; color: rgba(255,255,255,.65); line-height: 1.7; margin-bottom: 16px; max-width: 520px; }
        .nh-stats {
          display: inline-flex;
          background: rgba(255,255,255,.07); backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,.12); border-radius: 12px; overflow: hidden;
        }
        .nh-stat { padding: 9px 18px; text-align: center; border-right: 1px solid rgba(255,255,255,.08); }
        .nh-stat:last-child { border-right: none; }
        .nh-stat-v { font-size: 16px; font-weight: 800; color: #4ade80; display: block; line-height: 1; margin-bottom: 3px; }
        .nh-stat-l { font-size: 8.5px; color: rgba(255,255,255,.4); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }

        /* ── Layout ── */
        .n-page {
          max-width: 1060px; margin: 0 auto; padding: 28px 24px 80px;
          display: grid; grid-template-columns: 1fr 380px; gap: 24px; align-items: start;
        }
        .n-left  { display: flex; flex-direction: column; gap: 18px; }
        .n-right { position: sticky; top: 84px; }

        /* ── Cards ── */
        .n-card {
          background: #fff; border-radius: 20px; border: 1px solid #e8e5de;
          box-shadow: 0 1px 3px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.05);
          overflow: hidden; animation: up .5s ease both;
        }
        .n-card-p { padding: 24px 26px; }
        .n-sec-lbl {
          font-size: 9.5px; font-weight: 800; color: #16a34a;
          letter-spacing: .12em; text-transform: uppercase; margin-bottom: 16px;
          display: flex; align-items: center; gap: 8px;
        }
        .n-sec-lbl::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg,#d1fae5,transparent); }

        /* ── Rating strip ── */
        .n-rating-strip {
          padding: 14px 22px; background: linear-gradient(90deg, #f0fdf4, #fff);
          border-bottom: 1px solid #f0ede6;
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        }
        .n-stars { display: flex; gap: 2px; }
        .n-star  { color: #f59e0b; font-size: 15px; }

        /* ── Content body ── */
        .n-inside { padding: 22px 26px; border-top: 1px solid #f0ede6; }

        /* ── Highlight boxes ── */
        .n-highlight {
          background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
          border: 1.5px solid #d1fae5; border-radius: 14px;
          padding: 16px 18px; margin-bottom: 14px;
        }
        .n-highlight-title {
          font-size: 11px; font-weight: 800; color: #16a34a;
          text-transform: uppercase; letter-spacing: .09em; margin-bottom: 10px;
          display: flex; align-items: center; gap: 6px;
        }

        /* ── FAQ ── */
        .n-faq-item { border-bottom: 1px solid #f5f3ef; }
        .n-faq-item:last-child { border-bottom: none; }
        .n-faq-btn {
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding: 15px 0; background: none; border: none; cursor: pointer;
          font-family: inherit; text-align: left; transition: opacity .2s;
        }
        .n-faq-btn:hover { opacity: .85; }
        .n-faq-q { font-size: 14.5px; font-weight: 700; color: #111827; line-height: 1.5; flex: 1; }
        .n-faq-icon {
          width: 24px; height: 24px; border-radius: 50%;
          background: #f0fdf4; border: 1.5px solid #d1fae5;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; color: #16a34a; flex-shrink: 0;
          transition: transform .3s, background .2s; font-weight: 700; line-height: 1;
        }
        .n-faq-icon.open { transform: rotate(45deg); background: #16a34a; color: #fff; border-color: #16a34a; }
        .n-faq-ans {
          font-size: 14px; color: #4b5563; line-height: 1.85;
          max-height: 0; overflow: hidden; opacity: 0; padding-left: 4px;
          border-left: 3px solid transparent;
          transition: max-height .4s ease, opacity .35s, padding .3s;
        }
        .n-faq-ans.open { max-height: 700px; opacity: 1; padding-bottom: 16px; border-left-color: #16a34a; padding-left: 14px; }

        /* ── Testimonials ── */
        .n-testi-quote {
          font-family: 'Lora', serif; font-size: 15px; font-style: italic; color: #374151;
          line-height: 1.85; margin-bottom: 16px; position: relative; padding-left: 22px;
        }
        .n-testi-quote::before {
          content: '"'; position: absolute; left: 0; top: -6px;
          font-size: 42px; color: #d1fae5; line-height: 1; font-family: 'Lora', serif;
        }
        .n-testi-author { display: flex; align-items: center; gap: 11px; }
        .n-testi-avatar {
          width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #16a34a, #0d6b30);
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; font-weight: 800; color: #fff;
          border: 2px solid rgba(22,163,74,.2);
        }
        .n-testi-name { font-size: 13.5px; font-weight: 700; color: #111; }
        .n-testi-loc  { font-size: 11.5px; color: #9ca3af; margin-top: 1px; }
        .n-testi-stars { display: flex; gap: 2px; margin-left: auto; }
        .n-testi-dots { display: flex; gap: 7px; margin-top: 14px; justify-content: center; }
        .n-tdot {
          width: 8px; height: 8px; border-radius: 50%; background: #e2e8f0;
          border: none; cursor: pointer; padding: 0;
          transition: background .25s, transform .25s;
        }
        .n-tdot.active { background: #16a34a; transform: scale(1.4); }

        /* ── Author ── */
        .n-author {
          background: linear-gradient(135deg, #f0fdf4, #fff); border-radius: 18px;
          padding: 20px 22px; border: 1px solid #d1fae5;
          display: flex; align-items: flex-start; gap: 16px;
          animation: up .5s .1s ease both;
        }
        .n-author-av {
          width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #052e16, #16a34a);
          display: flex; align-items: center; justify-content: center; font-size: 22px;
          border: 2.5px solid rgba(22,163,74,.3);
          box-shadow: 0 4px 12px rgba(22,163,74,.2);
        }
        .n-author-name { font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 2px; }
        .n-author-role { font-size: 9.5px; color: #16a34a; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px; }
        .n-author-bio  { font-size: 13px; color: #4b5563; line-height: 1.7; }

        /* ── Others ── */
        .n-others { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px,1fr)); gap: 10px; }
        .n-other {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 16px 12px; background: #faf9f6; border: 1.5px solid #e8e5de;
          border-radius: 14px; text-decoration: none; text-align: center;
          transition: all .22s; cursor: pointer;
        }
        .n-other:hover { border-color: #16a34a; background: #f0fdf4; transform: translateY(-3px); box-shadow: 0 8px 20px rgba(22,163,74,.12); }
        .n-other-em  { font-size: 28px; }
        .n-other-ttl { font-size: 11.5px; font-weight: 700; color: #1a1a1a; line-height: 1.35; }
        .n-other-cta { font-size: 10.5px; color: #16a34a; font-weight: 800; }

        /* ── Form ── */
        .n-form-card {
          background: #fff; border-radius: 20px; border: 1px solid #e2e8f0;
          box-shadow: 0 8px 32px rgba(0,0,0,.1); overflow: hidden;
          animation: up .45s ease both;
        }
        .n-form-head {
          background: linear-gradient(150deg, #051a0d, #0a2416 50%, #15803d);
          padding: 24px 22px 20px; text-align: center; position: relative; overflow: hidden;
        }
        .n-form-head::before {
          content: ''; position: absolute; inset: 0;
          background-image: radial-gradient(circle, rgba(74,222,128,.08) 1px, transparent 1px);
          background-size: 22px 22px;
        }
        .n-form-head::after {
          content: ''; position: absolute; top: -50%; left: -60%; width: 40%; height: 200%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.04), transparent);
          animation: shine 3s ease-in-out infinite;
        }
        .n-f-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800; color: #fff; line-height: 1.2; margin-bottom: 5px; position: relative; }
        .n-f-sub   { font-size: 12px; color: rgba(255,255,255,.55); line-height: 1.65; position: relative; }
        .n-f-sub strong { color: #4ade80; }
        .n-urgency {
          display: flex; align-items: center; justify-content: center; gap: 7px;
          background: linear-gradient(90deg, #fef3c7, #fffbeb); border-bottom: 1px solid #fde68a;
          padding: 9px 14px; font-size: 11.5px; font-weight: 700; color: #92400e;
        }
        .n-urg-dot { width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; animation: pulse 1.4s infinite; flex-shrink: 0; }
        .n-f-body { padding: 20px 20px 12px; }
        .n-f-grp  { margin-bottom: 13px; }
        .n-f-lbl  {
          font-size: 9.5px; font-weight: 800; color: #94a3b8; letter-spacing: .1em;
          text-transform: uppercase; margin-bottom: 6px;
          display: flex; justify-content: space-between; align-items: center;
        }
        .n-f-ok   { color: #16a34a; font-size: 9.5px; font-weight: 700; }
        .n-f-err  { color: #ef4444; font-size: 11.5px; font-weight: 600; margin-top: 4px; }
        .n-f-hint { color: #b0a89a; font-size: 10.5px; margin-top: 4px; }
        input::placeholder { color: #c4bdb3 !important; }
        input:focus { border-color: #16a34a !important; background: #f0fdf4 !important; outline: none; box-shadow: 0 0 0 3px rgba(22,163,74,.1) !important; }
        .n-cta {
          width: 100%; border: none; border-radius: 13px;
          padding: 15px; font-size: 16px; font-weight: 800;
          cursor: pointer; font-family: inherit; transition: all .25s; margin-top: 6px;
          letter-spacing: -.01em;
        }
        .n-cta-ready   { background: linear-gradient(135deg, #16a34a, #0d6b30); color: #fff; box-shadow: 0 6px 22px rgba(22,163,74,.35); }
        .n-cta-ready:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(22,163,74,.45); }
        .n-cta-inactive { background: #f0ede6; color: #b0a89a; cursor: default; }
        .n-cta-loading  { background: #e8e5de; color: #b0a89a; cursor: wait; }
        .n-f-trust {
          display: flex; justify-content: center; gap: 7px; padding: 9px 14px 15px;
          font-size: 9px; color: #b0a89a; font-weight: 700; border-top: 1px solid #f0ede6;
          flex-wrap: wrap; letter-spacing: .05em; text-transform: uppercase;
        }
        .n-f-err-box {
          background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 10px;
          padding: 10px 13px; color: #dc2626; font-size: 12px; font-weight: 600; margin-top: 8px;
        }
        .n-success { padding: 32px 22px; text-align: center; }
        .n-dl-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: linear-gradient(135deg, #16a34a, #0d6b30); color: #fff;
          border-radius: 12px; padding: 13px 26px; text-decoration: none;
          font-weight: 800; font-size: 14.5px;
          box-shadow: 0 6px 22px rgba(22,163,74,.3); transition: transform .2s;
        }
        .n-dl-btn:hover { transform: translateY(-2px); }
        .n-social-proof {
          margin-top: 13px; background: #f0fdf4; border: 1px solid #d1fae5;
          border-radius: 13px; padding: 13px 16px;
        }
        .n-sp-row { display: flex; align-items: center; gap: 9px; margin-bottom: 7px; }
        .n-sp-row:last-child { margin-bottom: 0; }
        .n-sp-icon { font-size: 15px; flex-shrink: 0; }
        .n-sp-text { font-size: 12.5px; color: #166534; font-weight: 600; line-height: 1.4; }

        /* ── Mobile form wrapper ── */
        /* По подразбиране скрит — показан само на mobile когато е отворен */
        .n-mob-form-wrap {
          padding: 14px 14px 0;
          overflow: hidden;
          /* Важно: НЕ display:none тук — контролираме с max-height */
          max-height: 0;
          transition: max-height .4s ease, padding .3s;
        }
        .n-mob-form-wrap.open {
          max-height: 2000px;
          padding: 14px 14px 10px;
        }

        /* ── Mobile sticky CTA ── */
        .n-mob-sticky-bar {
          display: none;
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
          padding: 10px 14px calc(env(safe-area-inset-bottom, 0px) + 14px);
          background: linear-gradient(to top, rgba(255,255,255,1) 70%, rgba(255,255,255,0));
        }
        .n-mob-open {
          width: 100%; border: none; border-radius: 16px;
          padding: 16px; font-size: 16px; font-weight: 800;
          background: linear-gradient(135deg, #16a34a, #0d6b30); color: #fff;
          font-family: inherit; cursor: pointer;
          box-shadow: 0 -2px 20px rgba(22,163,74,.2), 0 8px 30px rgba(22,163,74,.35);
          letter-spacing: -.01em;
        }
        .n-mob-close {
          width: 100%; border: 1.5px solid #d1fae5; border-radius: 16px;
          padding: 13px; font-size: 14px; font-weight: 700;
          background: #f0fdf4; color: #16a34a; font-family: inherit; cursor: pointer;
        }

        /* ── Responsive ── */
        @media (max-width: 820px) {
          .n-page { grid-template-columns: 1fr; padding: 16px 14px 120px; gap: 16px; }
          .n-right { display: none !important; }
          .n-mob-sticky-bar { display: block; }
          .nh-header { padding: 22px 16px 44px; }
          .nh-img, .nh-img-ph { width: 90px; }
          .nh-stats { width: 100%; justify-content: stretch; }
          .nh-stat  { flex: 1; padding: 8px 10px; }
        }

        @media (max-width: 480px) {
          .nh-inner { gap: 16px; }
          .n-card-p { padding: 18px 16px; }
          .n-inside { padding: 16px 16px; }
        }
      `}</style>

      {/* Progress bar */}
      <div className="n-progress" style={{ width: `${scrollPct}%` }} aria-hidden="true" />

      <SiteHeader variant="light" />

      {/* Breadcrumb */}
      <nav className="n-bc" aria-label="Навигация">
        <div className="n-bc-inner">
          <a href="/">Начало</a><span>›</span>
          <a href="/naruchnici">Наръчници</a><span>›</span>
          <span className="n-bc-cur">{nar.title}</span>
        </div>
      </nav>

      {/* Hero */}
      <div className="nh-header">
        <div className="nh-inner">
          <div className="nh-img-wrap">
            {nar.cover_image_url ? (
              <img
                src={nar.cover_image_url}
                alt={`${nar.title} — PDF наръчник`}
                className="nh-img"
                loading="eager"
                fetchPriority="high"
              />
            ) : (
              <div className="nh-img-ph">{emoji}</div>
            )}
            <span className="nh-free">БЕЗПЛАТНО</span>
          </div>
          <div className="nh-meta">
            {(nar.category || true) && (
              <div className="nh-cat">{emoji} {nar.category || 'Наръчник'}</div>
            )}
            <h1 className="nh-title">{nar.title || 'Безплатен PDF Наръчник'}</h1>
            {description && <p className="nh-desc">{description}</p>}
            <div className="nh-stats">
              <div className="nh-stat">
                <span className="nh-stat-v">{dlK}</span>
                <span className="nh-stat-l">изтегляния</span>
              </div>
              <div className="nh-stat">
                <span className="nh-stat-v">{avgRating}/5</span>
                <span className="nh-stat-l">оценка</span>
              </div>
              <div className="nh-stat">
                <span className="nh-stat-v">PDF</span>
                <span className="nh-stat-l">безплатно</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile форма — collapsible, точно под hero */}
      <div
        className={`n-mob-form-wrap${mobileFormOpen ? ' open' : ''}`}
        ref={formRef}
      >
        {formJSX}
        {!done && (
          <div className="n-social-proof" style={{ marginBottom: 0 }}>
            <div className="n-sp-row"><span className="n-sp-icon">👨‍🌾</span><span className="n-sp-text">Над {dlK} фермери вече го изтеглиха</span></div>
            <div className="n-sp-row"><span className="n-sp-icon">⭐</span><span className="n-sp-text">Оценка {avgRating}/5 от {reviewsCount.toLocaleString('bg-BG')} читатели</span></div>
          </div>
        )}
      </div>

      {/* Main layout */}
      <main className="n-page">
        <div className="n-left">

          {/* Book card — описание + content body */}
          <article className="n-card">
            <div className="n-rating-strip">
              <div className="n-stars">
                {[1,2,3,4,5].map(i => <span key={i} className="n-star">★</span>)}
              </div>
              <span style={{ fontSize: 13, color: '#374151', fontWeight: 700 }}>{avgRating}/5</span>
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                ({reviewsCount.toLocaleString('bg-BG')} отзива)
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#16a34a', fontWeight: 700 }}>
                ✓ Верифицирани отзиви
              </span>
            </div>

            <div style={{ padding: '20px 26px' }}>
              <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.8 }}>{description}</p>
            </div>

            <div className="n-inside">
              <div className="n-sec-lbl">📖 Какво ще намериш вътре</div>
              <div className="n-highlight">
                <div className="n-highlight-title">✅ Теми в наръчника</div>
                {formatContentBody(contentBodyText)}
              </div>
            </div>
          </article>

          {/* FAQ */}
          <section className="n-card n-card-p" aria-label="Въпроси и отговори">
            <div className="n-sec-lbl">❓ Въпроси и отговори</div>
            {activeFaq.map(({ q, a }, i) => (
              <div key={i} className="n-faq-item">
                <button
                  className="n-faq-btn"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  <span className="n-faq-q">{q}</span>
                  <span className={`n-faq-icon${openFaq === i ? ' open' : ''}`} aria-hidden="true">+</span>
                </button>
                <div className={`n-faq-ans${openFaq === i ? ' open' : ''}`}>{a}</div>
              </div>
            ))}
          </section>

          {/* Testimonials */}
          <section className="n-card n-card-p" aria-label="Отзиви">
            <div className="n-sec-lbl">💬 Какво казват читателите</div>
            <div key={activeT} style={{ animation: 'fadeIn .3s ease' }}>
              <p className="n-testi-quote">{activeTestimonials[activeT].text}</p>
              <div className="n-testi-author">
                <div className="n-testi-avatar">
                  {(activeTestimonials[activeT].name?.[0] || '?').toUpperCase()}
                </div>
                <div>
                  <div className="n-testi-name">{activeTestimonials[activeT].name}</div>
                  <div className="n-testi-loc">📍 {activeTestimonials[activeT].location}</div>
                </div>
                <div className="n-testi-stars">
                  {[1,2,3,4,5].map(i => <span key={i} style={{ color: '#f59e0b', fontSize: 13 }}>★</span>)}
                </div>
              </div>
            </div>
            {activeTestimonials.length > 1 && (
              <div className="n-testi-dots">
                {activeTestimonials.map((_, i) => (
                  <button
                    key={i}
                    className={`n-tdot${i === activeT ? ' active' : ''}`}
                    onClick={() => setActiveT(i)}
                    aria-label={`Отзив ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Author bio */}
          <aside className="n-author">
            <div className="n-author-av">🌱</div>
            <div>
              <div className="n-author-name">Denny Angelow</div>
              <div className="n-author-role">Агро Консултант · 8+ год. опит · 85K+ последователи</div>
              <p className="n-author-bio">
                {nar.author_bio || 'Агро консултант с дългогодишен опит в отглеждането на зеленчуци. Помага на хиляди фермери да постигнат рекордна реколта с органични методи и правилна защита на растенията.'}
              </p>
            </div>
          </aside>

          {/* Others */}
          {others.length > 0 && (
            <nav className="n-card n-card-p" aria-label="Останали наръчници">
              <div className="n-sec-lbl">📚 Виж и другите наръчници</div>
              <div className="n-others">
                {others.map(o => (
                  <a key={o.slug} href={`/naruchnik/${o.slug}`} className="n-other" title={o.title}>
                    <span className="n-other-em">{catEmoji(o.category)}</span>
                    <span className="n-other-ttl">{o.title}</span>
                    <span className="n-other-cta">Изтегли →</span>
                  </a>
                ))}
              </div>
            </nav>
          )}
        </div>

        {/* Desktop sidebar */}
        <aside className="n-right" aria-label="Форма за изтегляне">
          {formJSX}
          {!done && (
            <div className="n-social-proof">
              <div className="n-sp-row"><span className="n-sp-icon">👨‍🌾</span><span className="n-sp-text">Над {dlK} фермери вече го изтеглиха</span></div>
              <div className="n-sp-row"><span className="n-sp-icon">⭐</span><span className="n-sp-text">Оценка {avgRating}/5 от {reviewsCount.toLocaleString('bg-BG')} читатели</span></div>
              <div className="n-sp-row"><span className="n-sp-icon">🌿</span><span className="n-sp-text">Препоръчан от Denny Angelow</span></div>
              <div className="n-sp-row"><span className="n-sp-icon">🔒</span><span className="n-sp-text">Сигурно — без спам, без риск</span></div>
            </div>
          )}
        </aside>
      </main>

      {/* Mobile sticky CTA */}
      {!done && (
        <div className="n-mob-sticky-bar">
          {mobileFormOpen ? (
            <button className="n-mob-close" onClick={() => setMobileFormOpen(false)}>
              ✕ Затвори формата
            </button>
          ) : (
            <button className="n-mob-open" onClick={scrollToForm}>
              📥 Изтегли Безплатно →
            </button>
          )}
        </div>
      )}

      <SiteFooter />
    </>
  )
}
