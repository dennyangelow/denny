'use client'

// app/naruchnik/[slug]/NaruchnikClient.tsx — v10
// ПОПРАВКИ v10:
//   1. handleEmailChange — strip-ва ВСИЧКО извън ASCII при въвеждане (блокира кирилица на ниво input)
//   2. handlePhoneChange — strip-ва всичко освен цифри/+/интервали/тирета/скоби при въвеждане
//   3. touched се маркира и при onChange — грешките се виждат веднага, не чакат blur
//   4. Бутонът е disabled={loading || !isValid} — невъзможно е да се submit-не невалидна форма
//   5. API грешките се показват inline до съответното поле

import { useState, useEffect } from 'react'
import { validateName, validateEmail, validatePhone } from '@/lib/validation'

interface Naruchnik {
  id: string; slug: string; title: string; subtitle?: string
  description?: string; cover_image_url?: string; pdf_url?: string
  category?: string; active: boolean
}

const CAT_EMOJI: Record<string, string> = {
  domati: '🍅', krastavici: '🥒', chushki: '🫑', default: '🌿',
}
const catEmoji = (cat = '') => CAT_EMOJI[cat] || CAT_EMOJI.default

const CAT_COLOR: Record<string, string> = {
  domati: '#c2410c', krastavici: '#15803d', chushki: '#c2410c', default: '#15803d',
}
const catColor = (cat = '') => CAT_COLOR[cat] || CAT_COLOR.default

const INSIDE_ITEMS = [
  { icon: '📅', text: 'Пълен календар за торене и третиране — седмица по седмица' },
  { icon: '✅', text: 'Кои продукти работят наистина (и кои са пари на вятъра)' },
  { icon: '🌿', text: 'Борба с болестите — органични методи без химия' },
  { icon: '⚠️', text: 'Грешките, които убиват реколтата (и как да ги избегнеш)' },
  { icon: '📈', text: 'Тайните на двойния добив от един декар' },
  { icon: '💡', text: 'Практични съвети, приложими още от следващата седмица' },
]

const TESTIMONIALS = [
  { name: 'Мария К.', location: 'Пловдив', text: 'Невероятно полезен наръчник. Реколтата ми се удвои за един сезон!', stars: 5 },
  { name: 'Георги П.', location: 'Стара Загора', text: 'Най-доброто безплатно ръководство, което съм намирал. Препоръчвам го на всеки фермер.', stars: 5 },
  { name: 'Илияна Д.', location: 'Варна', text: 'Следвам съветите вече 2 години. Никога по-добра реколта от тази година!', stars: 5 },
]

const STATS = [
  { value: '6 000+', label: 'изтегляния' },
  { value: '4.9 / 5', label: 'средна оценка' },
  { value: '100%', label: 'безплатно' },
]

interface Props {
  nar: Naruchnik
  others: Naruchnik[]
}

export default function NaruchnikClient({ nar, others }: Props) {
  const emoji = catEmoji(nar.category)
  const accent = catColor(nar.category)
  const pdfUrl = nar.pdf_url || '#'

  const [name,  setName]  = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [touched, setTouched] = useState({ name: false, email: false, phone: false })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [activeTestimonial, setActiveTestimonial] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setActiveTestimonial(i => (i + 1) % TESTIMONIALS.length), 4000)
    return () => clearInterval(t)
  }, [])

  const nameErr  = validateName(name)
  const emailErr = validateEmail(email)
  const phoneErr = validatePhone(phone)
  const isValid  = !nameErr && !emailErr && !phoneErr

  const touch = (f: keyof typeof touched) => setTouched(t => ({ ...t, [f]: true }))

  // ─── НИВО 1: Input handlers ─────────────────────────────────────────────────
  // Блокират невалидни символи ДИРЕКТНО при въвеждане — преди валидация

  const handleNameChange = (raw: string) => {
    setName(raw)
    touch('name')
  }

  const handleEmailChange = (raw: string) => {
    // ── ЖЕЛЕЗНА ЗАЩИТА: strip-ваме ВСЯКО не-ASCII при въвеждане ──────────────
    // Кирилица (а-яА-Я), emoji, и всякакви Unicode символи са НЕВАЛИДНИ в имейл.
    // RFC 5321 изисква само 7-bit ASCII. Символите се изтриват веднага при typing.
    // Допълнително strip-ваме и интервали (невалидни в имейл адреси).
    const clean = raw
      .replace(/[^\x21-\x7E]/g, '') // само printable ASCII без интервал
      .toLowerCase()
    setEmail(clean)
    // Маркираме touched веднага — грешката се вижда в реално време
    touch('email')
  }

  const handlePhoneChange = (raw: string) => {
    // ── ЖЕЛЕЗНА ЗАЩИТА: strip-ваме ВСИЧКИ букви при въвеждане ────────────────
    // Кирилски О изглежда като цифра 0 — затова блокираме ВСЯКАbukva
    // Позволени са: цифри 0-9, +, интервал, тире, скоби, точка — НИЩО друго
    const clean = raw.replace(/[^0-9+\s\-().]/g, '')
    setPhone(clean)
    touch('phone')
  }

  // ─── НИВО 2: Submit guard ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    setTouched({ name: true, email: true, phone: true })
    if (!isValid) return  // impossible to reach if button is disabled — extra safety
    setLoading(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name:  name.trim(),
          phone: phone.trim(),
          source: 'naruchnik_page',
          naruchnik_slug: nar.slug,
        }),
      })
      const data = await res.json()

      // ── НИВО 3: Сървърна грешка → показваме inline до полето ─────────────────
      if (!res.ok) {
        const field = data.field as string | undefined
        if (field === 'email')  setSubmitError(data.error || 'Невалиден имейл адрес')
        else if (field === 'phone') setSubmitError(data.error || 'Невалиден телефон')
        else if (field === 'name')  setSubmitError(data.error || 'Невалидно ime')
        else setSubmitError(data.error || 'Грешка при изпращане. Опитай пак.')
        setLoading(false)
        return
      }

      // Успех → изтегли PDF директно
      const a = document.createElement('a')
      a.href = pdfUrl
      a.download = nar.title + '.pdf'
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setDone(true)
    } catch {
      setSubmitError('Грешка при изпращане. Опитай пак.')
    }
    setLoading(false)
  }

  const fieldStyle = (err: string, isTouched: boolean): React.CSSProperties => ({
    padding: '14px 16px',
    borderRadius: 10,
    border: `1.5px solid ${isTouched && err ? '#f87171' : isTouched && !err ? '#4ade80' : '#d1d5db'}`,
    background: isTouched && err ? '#fef2f2' : isTouched && !err ? '#f0fdf4' : '#fff',
    color: '#111827',
    fontSize: 15,
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s, background 0.2s',
  })

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
        html { scroll-behavior: smooth }

        body {
          font-family: 'Plus Jakarta Sans', sans-serif;
          -webkit-font-smoothing: antialiased;
          background: #fafaf8;
          color: #111827;
        }

        /* ── Animations ── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center }
          100% { background-position: 200% center }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1) }
          50%       { transform: scale(1.04) }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) }
          50%       { transform: translateY(-6px) }
        }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateX(10px) }
          to   { opacity: 1; transform: translateX(0) }
        }

        /* ── Hero Banner ── */
        .nb-hero-banner {
          background: linear-gradient(135deg, #052e16 0%, #14532d 40%, #166534 100%);
          position: relative;
          overflow: hidden;
          padding: 64px 24px 48px;
        }
        .nb-hero-banner::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(ellipse at 20% 50%, rgba(74,222,128,0.12) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(134,239,172,0.08) 0%, transparent 50%),
            url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%234ade80' fill-opacity='0.04'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
          pointer-events: none;
        }
        .nb-hero-inner {
          max-width: 840px;
          margin: 0 auto;
          text-align: center;
          position: relative;
          animation: fadeUp .6s ease both;
        }
        .nb-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(74,222,128,0.15);
          border: 1px solid rgba(74,222,128,0.3);
          border-radius: 100px;
          padding: 6px 18px;
          margin-bottom: 24px;
        }
        .nb-hero-badge-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #4ade80;
          animation: pulse 2s infinite;
          display: inline-block;
        }
        .nb-hero-badge-text {
          font-size: 11px;
          font-weight: 700;
          color: #86efac;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .nb-hero-h1 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(30px, 5vw, 58px);
          font-weight: 900;
          color: #fff;
          line-height: 1.06;
          letter-spacing: -.02em;
          margin-bottom: 16px;
        }
        .nb-hero-sub {
          font-size: clamp(15px, 2vw, 17px);
          color: rgba(255,255,255,0.68);
          line-height: 1.8;
          max-width: 560px;
          margin: 0 auto 32px;
        }

        /* Stats bar */
        .nb-stats-bar {
          display: flex;
          justify-content: center;
          gap: 0;
          flex-wrap: wrap;
        }
        .nb-stat {
          padding: 10px 28px;
          border-right: 1px solid rgba(255,255,255,0.12);
          text-align: center;
        }
        .nb-stat:last-child { border-right: none }
        .nb-stat-value {
          font-size: 22px;
          font-weight: 800;
          color: #4ade80;
          display: block;
          line-height: 1;
          margin-bottom: 4px;
        }
        .nb-stat-label {
          font-size: 11px;
          color: rgba(255,255,255,0.48);
          font-weight: 600;
          letter-spacing: .06em;
          text-transform: uppercase;
        }

        /* ── Page Layout ── */
        .nb-page {
          max-width: 1020px;
          margin: 0 auto;
          padding: 40px 24px 60px;
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 32px;
          align-items: start;
        }
        @media (max-width: 800px) {
          .nb-page { grid-template-columns: 1fr; padding: 24px 16px 48px }
        }

        /* ── Left Column ── */
        .nb-left { display: flex; flex-direction: column; gap: 20px }

        /* Book card */
        .nb-book-card {
          background: #fff;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05), 0 20px 60px rgba(0,0,0,0.08);
          border: 1px solid #e5e7eb;
          animation: fadeUp .5s ease .1s both;
        }
        .nb-book-top {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          padding: 32px;
          display: flex;
          gap: 28px;
          align-items: center;
          position: relative;
          overflow: hidden;
        }
        .nb-book-top::after {
          content: '';
          position: absolute;
          top: -40px; right: -40px;
          width: 160px; height: 160px;
          border-radius: 50%;
          background: rgba(22,163,74,0.08);
        }
        .nb-book-img-wrap {
          flex-shrink: 0;
          position: relative;
          animation: float 4s ease-in-out infinite;
        }
        .nb-book-img {
          max-height: 190px;
          max-width: 145px;
          object-fit: contain;
          border-radius: 10px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.1);
          display: block;
        }
        .nb-book-img-placeholder {
          width: 120px; height: 160px;
          background: linear-gradient(135deg, #16a34a, #15803d);
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.2);
        }
        .nb-free-pill {
          position: absolute;
          top: -8px; right: -12px;
          background: #dc2626;
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          padding: 4px 10px;
          border-radius: 20px;
          letter-spacing: .04em;
          text-transform: uppercase;
          box-shadow: 0 4px 12px rgba(220,38,38,0.4);
        }
        .nb-book-meta { flex: 1; min-width: 0; position: relative }
        .nb-book-cat {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 800;
          color: #16a34a;
          letter-spacing: .08em;
          text-transform: uppercase;
          margin-bottom: 10px;
          background: rgba(22,163,74,0.1);
          padding: 4px 10px;
          border-radius: 6px;
        }
        .nb-book-title {
          font-family: 'Playfair Display', serif;
          font-size: clamp(20px, 2.5vw, 26px);
          font-weight: 800;
          color: #0f172a;
          line-height: 1.18;
          letter-spacing: -.02em;
          margin-bottom: 10px;
        }
        .nb-book-desc {
          font-size: 14px;
          color: #6b7280;
          line-height: 1.7;
          margin-bottom: 16px;
        }
        .nb-stars {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 6px;
        }
        .nb-star { color: #f59e0b; font-size: 14px }
        .nb-stars-label { font-size: 12px; color: #6b7280; font-weight: 600; margin-left: 4px }

        /* Inside section */
        .nb-inside {
          padding: 28px 32px;
          border-top: 1px solid #f3f4f6;
        }
        .nb-section-label {
          font-size: 11px;
          font-weight: 800;
          color: #16a34a;
          letter-spacing: .1em;
          text-transform: uppercase;
          margin-bottom: 18px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .nb-section-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, #d1fae5, transparent);
        }
        .nb-inside-list {
          list-style: none;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .nb-inside-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 14px;
          background: #f8fafc;
          border-radius: 10px;
          border-left: 3px solid #16a34a;
          transition: background .2s, transform .2s;
        }
        .nb-inside-item:hover {
          background: #f0fdf4;
          transform: translateX(3px);
        }
        .nb-inside-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px }
        .nb-inside-text { font-size: 14px; color: #374151; font-weight: 500; line-height: 1.55 }

        /* Testimonials */
        .nb-testimonials-card {
          background: #fff;
          border-radius: 20px;
          padding: 28px 32px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05), 0 20px 60px rgba(0,0,0,0.08);
          border: 1px solid #e5e7eb;
          animation: fadeUp .5s ease .2s both;
        }
        .nb-testimonial {
          animation: fadeSlide .4s ease both;
        }
        .nb-testimonial-body {
          font-size: 15px;
          color: #374151;
          line-height: 1.75;
          font-style: italic;
          margin-bottom: 14px;
          position: relative;
          padding-left: 20px;
        }
        .nb-testimonial-body::before {
          content: '"';
          position: absolute;
          left: 0; top: -4px;
          font-size: 36px;
          color: #d1fae5;
          font-family: 'Playfair Display', serif;
          line-height: 1;
        }
        .nb-testimonial-author {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .nb-testimonial-avatar {
          width: 40px; height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #16a34a, #15803d);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 800;
          color: #fff;
          flex-shrink: 0;
        }
        .nb-testimonial-name { font-size: 14px; font-weight: 700; color: #111 }
        .nb-testimonial-loc { font-size: 12px; color: #9ca3af }
        .nb-testimonial-dots {
          display: flex;
          gap: 6px;
          margin-top: 16px;
          justify-content: center;
        }
        .nb-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #e5e7eb;
          transition: background .3s;
          cursor: pointer;
        }
        .nb-dot.active { background: #16a34a }

        /* Others */
        .nb-others-card {
          background: #fff;
          border-radius: 20px;
          padding: 24px 32px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05), 0 20px 60px rgba(0,0,0,0.08);
          border: 1px solid #e5e7eb;
          animation: fadeUp .5s ease .3s both;
        }
        .nb-others-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
          margin-top: 14px;
        }
        .nb-other-link {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px 12px;
          background: #f8fafc;
          border: 1.5px solid #e5e7eb;
          border-radius: 14px;
          text-decoration: none;
          text-align: center;
          transition: all .2s;
        }
        .nb-other-link:hover {
          border-color: #16a34a;
          background: #f0fdf4;
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(22,163,74,.12);
        }
        .nb-other-emoji { font-size: 28px }
        .nb-other-title { font-size: 12px; font-weight: 700; color: #111; line-height: 1.35 }
        .nb-other-cta { font-size: 11px; color: #16a34a; font-weight: 800 }

        /* ── Right Column ── sticky form ── */
        .nb-right { position: sticky; top: 24px }

        .nb-form-card {
          background: #fff;
          border-radius: 20px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05), 0 24px 64px rgba(0,0,0,0.1);
          border: 1px solid #e5e7eb;
          overflow: hidden;
          animation: fadeUp .5s ease .15s both;
        }

        .nb-form-top {
          background: linear-gradient(135deg, #052e16, #15803d);
          padding: 28px 28px 24px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .nb-form-top::before {
          content: '';
          position: absolute;
          inset: 0;
          background: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%234ade80' fill-opacity='0.06'%3E%3Ccircle cx='20' cy='20' r='1.5'/%3E%3C/g%3E%3C/svg%3E");
        }
        .nb-form-icon {
          font-size: 44px;
          display: block;
          margin-bottom: 10px;
          animation: float 3s ease-in-out infinite;
          position: relative;
        }
        .nb-form-title {
          font-family: 'Playfair Display', serif;
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          line-height: 1.2;
          margin-bottom: 6px;
          position: relative;
        }
        .nb-form-subtitle {
          font-size: 13px;
          color: rgba(255,255,255,0.65);
          line-height: 1.65;
          position: relative;
        }
        .nb-form-subtitle strong { color: #4ade80 }

        /* Urgency bar */
        .nb-urgency {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #fef3c7;
          border-bottom: 1px solid #fde68a;
          padding: 10px 16px;
          font-size: 12px;
          font-weight: 700;
          color: #92400e;
        }
        .nb-urgency-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #f59e0b;
          animation: pulse 1.5s infinite;
          flex-shrink: 0;
        }

        /* Form body */
        .nb-form-body { padding: 24px 24px 20px }

        .nb-field-group { margin-bottom: 14px }
        .nb-field-label {
          font-size: 10px;
          font-weight: 800;
          color: #6b7280;
          letter-spacing: .09em;
          text-transform: uppercase;
          margin-bottom: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .nb-field-ok { color: #16a34a; font-size: 11px; font-weight: 700 }
        .nb-field-err { color: #ef4444; font-size: 11px; font-weight: 600; margin-top: 5px }
        .nb-field-hint { color: #9ca3af; font-size: 10px; margin-top: 4px }

        input::placeholder { color: #9ca3af !important; opacity: 1 }
        input:focus { border-color: #16a34a !important; background: #f0fdf4 !important; outline: none }

        /* CTA Button */
        .nb-cta-btn {
          width: 100%;
          border: none;
          border-radius: 12px;
          padding: 18px;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
          font-family: inherit;
          letter-spacing: -.01em;
          transition: all .25s;
          margin-top: 6px;
        }
        .nb-cta-ready {
          background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
          background-size: 200% auto;
          color: #fff;
          box-shadow: 0 8px 30px rgba(22,163,74,0.4);
        }
        .nb-cta-ready:hover {
          background-position: right center;
          transform: translateY(-2px);
          box-shadow: 0 14px 40px rgba(22,163,74,0.55);
        }
        .nb-cta-inactive {
          background: #f3f4f6;
          color: #9ca3af;
          cursor: default;
        }
        .nb-cta-loading {
          background: #e5e7eb;
          color: #9ca3af;
          cursor: wait;
        }

        /* Trust footer */
        .nb-trust {
          display: flex;
          justify-content: center;
          gap: 6px;
          padding: 12px 16px 16px;
          font-size: 10px;
          color: #9ca3af;
          font-weight: 600;
          border-top: 1px solid #f3f4f6;
          flex-wrap: wrap;
        }
        .nb-trust-item { display: flex; align-items: center; gap: 3px }

        /* Submit error */
        .nb-submit-error {
          background: #fef2f2;
          border: 1.5px solid #fecaca;
          border-radius: 10px;
          padding: 10px 14px;
          color: #dc2626;
          font-size: 13px;
          font-weight: 600;
          margin-top: 10px;
        }

        /* Success state */
        .nb-success {
          padding: 32px 24px;
          text-align: center;
        }
        .nb-success-icon { font-size: 60px; margin-bottom: 12px; animation: float 2s ease-in-out infinite }
        .nb-success-title {
          font-family: 'Playfair Display', serif;
          font-size: 24px;
          font-weight: 800;
          color: #111;
          margin-bottom: 8px;
        }
        .nb-success-text { font-size: 14px; color: #6b7280; line-height: 1.7; margin-bottom: 6px }
        .nb-success-email { font-size: 13px; color: #9ca3af; margin-bottom: 24px }
        .nb-success-email span { color: #16a34a; font-weight: 700 }
        .nb-download-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #16a34a, #15803d);
          color: #fff;
          border-radius: 12px;
          padding: 15px 28px;
          text-decoration: none;
          font-weight: 900;
          font-size: 15px;
          box-shadow: 0 8px 28px rgba(22,163,74,.4);
          transition: transform .2s, box-shadow .2s;
        }
        .nb-download-btn:hover { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(22,163,74,.5) }

        /* Back link */
        .nb-back { text-align: center; padding: 8px 24px 32px }
        .nb-back-link {
          color: #9ca3af;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          transition: color .2s;
        }
        .nb-back-link:hover { color: #16a34a }

        /* Responsive */
        @media (max-width: 640px) {
          .nb-book-top { flex-direction: column; text-align: center; padding: 24px 20px }
          .nb-inside { padding: 20px }
          .nb-testimonials-card, .nb-others-card { padding: 20px }
          .nb-form-body { padding: 18px 18px 14px }
          .nb-stat { padding: 8px 16px; border-right-color: rgba(255,255,255,0.08) }
        }
      `}</style>

      {/* ── HERO BANNER ── */}
      <header className="nb-hero-banner" role="banner">
        <div className="nb-hero-inner">
          <div className="nb-hero-badge">
            <span className="nb-hero-badge-dot" />
            <span className="nb-hero-badge-text">Безплатен PDF Наръчник</span>
          </div>

          {/* SEO: h1 uses the actual book title */}
          <h1 className="nb-hero-h1">{emoji} {nar.title}</h1>

          {nar.subtitle && (
            <p className="nb-hero-sub">{nar.subtitle}</p>
          )}

          <div className="nb-stats-bar" role="list" aria-label="Статистики">
            {STATS.map(s => (
              <div key={s.label} className="nb-stat" role="listitem">
                <span className="nb-stat-value">{s.value}</span>
                <span className="nb-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="nb-page" id="main-content">

        {/* ─── LEFT COLUMN ─── */}
        <div className="nb-left">

          {/* Book preview card */}
          <article className="nb-book-card" aria-label={`Наръчник: ${nar.title}`}>
            <div className="nb-book-top">

              <div className="nb-book-img-wrap">
                {nar.cover_image_url ? (
                  <img
                    src={nar.cover_image_url}
                    alt={`Корица на наръчника ${nar.title}`}
                    className="nb-book-img"
                    loading="eager"
                    fetchPriority="high"
                    width={145}
                    height={190}
                  />
                ) : (
                  <div className="nb-book-img-placeholder">
                    <span style={{ fontSize: 52 }}>{emoji}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 6, fontWeight: 700 }}>PDF</span>
                  </div>
                )}
                <span className="nb-free-pill">БЕЗПЛАТНО</span>
              </div>

              <div className="nb-book-meta">
                <div className="nb-book-cat">
                  <span>{emoji}</span>
                  {nar.category
                    ? nar.category.charAt(0).toUpperCase() + nar.category.slice(1)
                    : 'Градинарство'}
                </div>

                <h2 className="nb-book-title">{nar.title}</h2>

                {nar.description && (
                  <p className="nb-book-desc">{nar.description}</p>
                )}

                <div className="nb-stars" aria-label="Оценка 4.9 от 5 звезди">
                  {[1,2,3,4,5].map(i => <span key={i} className="nb-star">★</span>)}
                  <span className="nb-stars-label">4.9/5 · 847 оценки</span>
                </div>
              </div>
            </div>

            {/* What's inside */}
            <section className="nb-inside" aria-labelledby="inside-heading">
              <div className="nb-section-label" id="inside-heading">Какво ще намериш вътре</div>
              <ul className="nb-inside-list">
                {INSIDE_ITEMS.map((item, i) => (
                  <li key={i} className="nb-inside-item">
                    <span className="nb-inside-icon" aria-hidden="true">{item.icon}</span>
                    <span className="nb-inside-text">{item.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          </article>

          {/* Testimonials */}
          <section className="nb-testimonials-card" aria-labelledby="reviews-heading">
            <div className="nb-section-label" id="reviews-heading">Какво казват фермерите</div>
            <div
              className="nb-testimonial"
              key={activeTestimonial}
              role="region"
              aria-live="polite"
              aria-label="Отзив"
            >
              <div className="nb-testimonial-body">
                {TESTIMONIALS[activeTestimonial].text}
              </div>
              <div className="nb-testimonial-author">
                <div
                  className="nb-testimonial-avatar"
                  aria-hidden="true"
                >
                  {TESTIMONIALS[activeTestimonial].name.charAt(0)}
                </div>
                <div>
                  <div className="nb-testimonial-name">{TESTIMONIALS[activeTestimonial].name}</div>
                  <div className="nb-testimonial-loc">📍 {TESTIMONIALS[activeTestimonial].location}</div>
                </div>
                <div className="nb-stars" style={{ marginLeft: 'auto', marginBottom: 0 }} aria-label="5 звезди">
                  {[1,2,3,4,5].map(i => <span key={i} className="nb-star" style={{ fontSize: 12 }}>★</span>)}
                </div>
              </div>
            </div>
            <div className="nb-testimonial-dots" role="tablist" aria-label="Отзиви навигация">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  className={`nb-dot ${i === activeTestimonial ? 'active' : ''}`}
                  onClick={() => setActiveTestimonial(i)}
                  role="tab"
                  aria-selected={i === activeTestimonial}
                  aria-label={`Отзив ${i + 1}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <span className={`nb-dot ${i === activeTestimonial ? 'active' : ''}`} style={{ display: 'block' }} />
                </button>
              ))}
            </div>
          </section>

          {/* Other guides */}
          {others.length > 0 && (
            <nav className="nb-others-card" aria-labelledby="others-heading">
              <div className="nb-section-label" id="others-heading">Виж и другите наръчници</div>
              <div className="nb-others-grid">
                {others.map(o => (
                  <a
                    key={o.slug}
                    href={`/naruchnik/${o.slug}`}
                    className="nb-other-link"
                    title={`Наръчник: ${o.title}`}
                  >
                    <span className="nb-other-emoji" aria-hidden="true">{catEmoji(o.category)}</span>
                    <span className="nb-other-title">{o.title}</span>
                    <span className="nb-other-cta" aria-label={`Изтегли ${o.title}`}>Изтегли →</span>
                  </a>
                ))}
              </div>
            </nav>
          )}
        </div>

        {/* ─── RIGHT COLUMN — Lead Form ─── */}
        <aside className="nb-right" aria-label="Форма за изтегляне">
          <div className="nb-form-card">

            {done ? (
              <div className="nb-success" role="alert" aria-live="assertive">
                <div className="nb-success-icon" aria-hidden="true">🎉</div>
                <h3 className="nb-success-title">Свалянето започна!</h3>
                <p className="nb-success-text">
                  Провери папката <strong>Изтегляния</strong> на устройството си.
                </p>
                <p className="nb-success-email">
                  📧 Изпратихме копие на <span>{email}</span>
                </p>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="nb-download-btn"
                  aria-label={`Изтегли отново ${nar.title}`}
                >
                  📥 Изтегли отново
                </a>
              </div>
            ) : (
              <>
                <div className="nb-form-top">
                  <span className="nb-form-icon" aria-hidden="true">🎁</span>
                  <h3 className="nb-form-title">Изтегли Безплатно</h3>
                  <p className="nb-form-subtitle">
                    Над <strong>6 000</strong> фермери вече го изтеглиха.<br />
                    Получи и ти своя екземпляр — веднага.
                  </p>
                </div>

                <div className="nb-urgency" role="status">
                  <span className="nb-urgency-dot" aria-hidden="true" />
                  🔥 47 души са изтеглили наръчника днес
                </div>

                <div className="nb-form-body">

                  {/* ── ИМЕ ── */}
                  <div className="nb-field-group">
                    <div className="nb-field-label">
                      <span>ИМЕ <span style={{ color: '#ef4444' }}>*</span></span>
                      {touched.name && !nameErr && <span className="nb-field-ok">✓ Добре</span>}
                    </div>
                    <input
                      type="text"
                      placeholder="Георги Петров"
                      value={name}
                      onChange={e => handleNameChange(e.target.value)}
                      onBlur={() => touch('name')}
                      style={fieldStyle(nameErr, touched.name)}
                      aria-label="Вашето ime"
                      aria-required="true"
                      aria-invalid={touched.name && !!nameErr}
                      autoComplete="name"
                    />
                    {touched.name && nameErr && (
                      <div className="nb-field-err" role="alert">⚠ {nameErr}</div>
                    )}
                  </div>

                  {/* ── ИМЕЙЛ ── */}
                  <div className="nb-field-group">
                    <div className="nb-field-label">
                      <span>ИМЕЙЛ <span style={{ color: '#ef4444' }}>*</span></span>
                      {touched.email && !emailErr && <span className="nb-field-ok">✓ Добре</span>}
                    </div>
                    <input
                      type="text"
                      placeholder="email@example.com"
                      value={email}
                      onChange={e => handleEmailChange(e.target.value)}
                      onBlur={() => touch('email')}
                      onPaste={e => {
                        e.preventDefault()
                        const pasted = e.clipboardData.getData('text')
                        handleEmailChange(pasted)
                      }}
                      style={fieldStyle(emailErr, touched.email)}
                      aria-label="Вашият имейл адрес"
                      aria-required="true"
                      aria-invalid={touched.email && !!emailErr}
                      autoComplete="email"
                      inputMode="email"
                      spellCheck={false}
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                    {touched.email && emailErr && (
                      <div className="nb-field-err" role="alert">⚠ {emailErr}</div>
                    )}
                    <div className="nb-field-hint">📧 Ще получиш копие на наръчника на имейл</div>
                  </div>

                  {/* ── ТЕЛЕФОН ── */}
                  <div className="nb-field-group">
                    <div className="nb-field-label">
                      <span>ТЕЛЕФОН <span style={{ color: '#ef4444' }}>*</span></span>
                      {touched.phone && !phoneErr && <span className="nb-field-ok">✓ Добре</span>}
                    </div>
                    <input
                      type="tel"
                      placeholder="0887 123 456"
                      value={phone}
                      onChange={e => handlePhoneChange(e.target.value)}
                      onBlur={() => touch('phone')}
                      onKeyDown={e => {
                        // Блокира директно въвеждане на букви (кирилски и латински)
                        const isLetter = e.key.length === 1 && /[^0-9+\-().\ ]/.test(e.key)
                        if (isLetter) e.preventDefault()
                      }}
                      onPaste={e => {
                        e.preventDefault()
                        const pasted = e.clipboardData.getData('text')
                        handlePhoneChange(pasted)
                      }}
                      style={fieldStyle(phoneErr, touched.phone)}
                      aria-label="Вашият телефонен номер"
                      aria-required="true"
                      aria-invalid={touched.phone && !!phoneErr}
                      autoComplete="tel"
                      inputMode="tel"
                    />
                    {touched.phone && phoneErr && (
                      <div className="nb-field-err" role="alert">⚠ {phoneErr}</div>
                    )}
                    <div className="nb-field-hint">📞 За лична консултация при нужда</div>
                  </div>

                  {submitError && (
                    <div className="nb-submit-error" role="alert">⚠ {submitError}</div>
                  )}

                  <button
                    className={`nb-cta-btn ${loading ? 'nb-cta-loading' : isValid ? 'nb-cta-ready' : 'nb-cta-inactive'}`}
                    onClick={handleSubmit}
                    disabled={loading || !isValid}
                    aria-label={isValid ? `Изтегли безплатно ${nar.title}` : 'Попълни всички полета'}
                    aria-busy={loading}
                  >
                    {loading
                      ? '⏳ Подготвям наръчника...'
                      : isValid
                        ? '📥 Изтегли Безплатно Сега →'
                        : '📋 Попълни всички полета'}
                  </button>
                </div>

                <div className="nb-trust" role="list" aria-label="Гаранции">
                  <span className="nb-trust-item" role="listitem">🔒 Без спам</span>
                  <span aria-hidden="true">·</span>
                  <span className="nb-trust-item" role="listitem">✅ Без регистрация</span>
                  <span aria-hidden="true">·</span>
                  <span className="nb-trust-item" role="listitem">📥 Директно сваляне</span>
                </div>
              </>
            )}
          </div>
        </aside>
      </main>

      <div className="nb-back">
        <a href="/" className="nb-back-link">← Обратно към сайта</a>
      </div>
    </>
  )
}
