'use client'

import './homepage.css'
import React, { useState, useEffect } from 'react'
import { FadeIn } from '@/components/marketing/FadeIn'
import { CDN, AFF } from '@/lib/marketing-data'

// ──────────────────────────────────────────────────────────────────────────────
// ТИПОВЕ
// ──────────────────────────────────────────────────────────────────────────────
interface CartItem { id: string; name: string; price: number; qty: number }
interface OrderForm {
  name: string; phone: string; email: string
  address: string; city: string; notes: string; payment: string
}
interface SiteSettings {
  hero_title: string
  hero_subtitle: string
  hero_warning: string
  shipping_price: number
  free_shipping_above: number
  site_email: string
  site_phone: string
  whatsapp_number: string
  urgency_bar_text: string
  trust_strip_items: string   // JSON масив — може да се редактира от settings
  social_proof_items: string  // JSON масив
  footer_about_text: string
  cta_title: string
  cta_subtitle: string
}
interface Handbook {
  slug: string; title: string; subtitle: string
  emoji: string; color: string; bg: string; badge: string
}
interface AtlasProduct {
  id: string; name: string; subtitle: string; desc: string
  badge: string; emoji: string; img: string
  price: number; comparePrice: number; priceLabel: string
  features: string[]
}
interface AffiliateProduct {
  id: string; slug: string; name: string; subtitle: string
  description: string; bullets: string[]; image_url: string
  affiliate_url: string; partner: string; emoji: string
  // Нови колони за визуализация
  badge_text: string      // горе вляво — напр. "Най-използван"
  tag_text: string        // горе вдясно — напр. "Фермерски фаворит"
  color: string           // основен цвят на картата — напр. "#16a34a"
  badge_color: string     // цвят на badge-а — напр. "#dc2626"
  category_label: string  // надпис над заглавието — напр. "NPK ТОР С МИКРОЕЛЕМЕНТИ"
}
interface CategoryLink {
  id: string; slug: string; label: string; href: string
  emoji: string; partner: string | null; color?: string
}
interface Testimonial {
  id: string; name: string; location: string; text: string; stars: number; avatar: string
}
interface FaqItem {
  id: string; question: string; answer: string; sort_order: number
}

// ──────────────────────────────────────────────────────────────────────────────
// DEFAULTS (fallback докато DB зарежда)
// ──────────────────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: SiteSettings = {
  hero_title: 'Искаш едри, здрави и сочни домати?',
  hero_subtitle: 'Без болести, без гниене и без загубена реколта. С правилната грижа и нужните продукти можеш да отгледаш здрави и продуктивни растения, без излишни усилия.',
  hero_warning: 'Не рискувай да изхвърлиш продукцията си, само защото нямаш нужната информация навреме.',
  shipping_price: 5.99,
  free_shipping_above: 60,
  site_email: 'support@dennyangelow.com',
  site_phone: '+359 876238623',
  whatsapp_number: '359876238623',
  urgency_bar_text: '🎁 **2 безплатни наръчника** — Домати & Краставици · 🚚 **Безплатна доставка** над 60 лв. · 💵 Само наложен платеж',
  trust_strip_items: JSON.stringify([
    { icon: '🌱', text: 'Органични продукти' },
    { icon: '🚚', text: 'Еконт · Спиди до вратата' },
    { icon: '💵', text: 'Само наложен платеж' },
    { icon: '📞', text: 'Лична консултация' },
    { icon: '⭐', text: '5-звездни отзиви' },
  ]),
  social_proof_items: JSON.stringify([
    { number: '6 000+', label: 'изтеглени' },
    { number: '85K', label: 'последователи' },
    { number: '100%', label: 'органично' },
  ]),
  footer_about_text: 'Помагам на фермери да отглеждат по-здрави растения с проверени органични методи.',
  cta_title: 'Изтегли И Двата Наръчника Напълно Безплатно',
  cta_subtitle: 'Над 6 000 фермери вече ги изтеглиха. Вземи **и двата безплатно** — тайните за едри домати и рекордни краставици.',
}

const DEFAULT_HANDBOOKS: Handbook[] = [
  { slug: 'super-domati', title: 'Тайните на Едрите Домати', subtitle: 'Над 6 000 изтеглени', emoji: '🍅', color: '#dc2626', bg: 'linear-gradient(135deg,#dc2626,#b91c1c)', badge: 'Домати' },
  { slug: 'krastavici-visoki-dobivy', title: 'Краставици за Високи Добиви', subtitle: 'Новост', emoji: '🥒', color: '#16a34a', bg: 'linear-gradient(135deg,#16a34a,#166534)', badge: 'Краставици' },
]

const CAT_COLORS: Record<string, string> = {
  agroapteki: '#16a34a', oranjeriata: '#0369a1',
  atlasagro: '#7c3aed', default: '#374151',
}

// ──────────────────────────────────────────────────────────────────────────────
// HELPER — parse bold markdown (**text**)
// ──────────────────────────────────────────────────────────────────────────────
function parseBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  return parts.map((p, i) =>
    i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// КОМПОНЕНТ
// ──────────────────────────────────────────────────────────────────────────────
export default function HomePage() {
  // Cart
  const [cartVisible, setCartVisible] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderForm, setOrderForm] = useState<OrderForm>({ name: '', phone: '', email: '', address: '', city: '', notes: '', payment: 'cod' })
  const [orderLoading, setOrderLoading] = useState(false)
  const [orderDone, setOrderDone] = useState('')

  // UI
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  // Handbook form
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [hbName, setHbName] = useState('')
  const [hbEmail, setHbEmail] = useState('')
  const [hbPhone, setHbPhone] = useState('')
  const [hbLoading, setHbLoading] = useState(false)
  const [hbError, setHbError] = useState('')
  const [hbDone, setHbDone] = useState<{ pdfUrl: string; title: string } | null>(null)

  // DB данни
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)
  const [handbooks, setHandbooks] = useState<Handbook[]>(DEFAULT_HANDBOOKS)
  const [atlasProducts, setAtlasProducts] = useState<AtlasProduct[]>([])
  const [affiliateProducts, setAffiliateProducts] = useState<AffiliateProduct[]>([])
  const [categoryLinks, setCategoryLinks] = useState<CategoryLink[]>([])
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [faq, setFaq] = useState<FaqItem[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)

  // ── Scroll ──
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ── Зареди всичко от DB ──
  useEffect(() => {
    Promise.all([
      fetch('/api/site-data', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/naruchnici', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([siteData, narData]) => {
      // Settings
      if (siteData.settings) {
        const s: Record<string, string> = {}
        siteData.settings.forEach((row: { key: string; value: string }) => { s[row.key] = row.value })
        setSettings(prev => ({
          ...prev,
          hero_title: s.hero_title || prev.hero_title,
          hero_subtitle: s.hero_subtitle || prev.hero_subtitle,
          hero_warning: s.hero_warning || prev.hero_warning,
          shipping_price: s.shipping_price ? parseFloat(s.shipping_price) : prev.shipping_price,
          free_shipping_above: s.free_shipping_above ? parseFloat(s.free_shipping_above) : prev.free_shipping_above,
          site_email: s.site_email || prev.site_email,
          site_phone: s.site_phone || prev.site_phone,
          whatsapp_number: s.whatsapp_number || prev.whatsapp_number,
          urgency_bar_text: s.urgency_bar_text || prev.urgency_bar_text,
          trust_strip_items: s.trust_strip_items || prev.trust_strip_items,
          social_proof_items: s.social_proof_items || prev.social_proof_items,
          footer_about_text: s.footer_about_text || prev.footer_about_text,
          cta_title: s.cta_title || prev.cta_title,
          cta_subtitle: s.cta_subtitle || prev.cta_subtitle,
        }))
      }

      // Atlas products (от products таблицата)
      if (siteData.atlasProducts?.length) {
        setAtlasProducts(siteData.atlasProducts.map((p: any) => ({
          id: p.slug,
          name: p.name,
          subtitle: p.subtitle || '',
          desc: p.description || '',
          badge: p.badge || 'Хит',
          emoji: p.emoji || '🌿',
          img: p.image_url || '',
          price: parseFloat(p.price),
          comparePrice: parseFloat(p.compare_price || p.price),
          priceLabel: parseFloat(p.price).toFixed(2) + ' лв.',
          features: p.features || [],
        })))
      }

      // Affiliate products
      if (siteData.affiliateProducts?.length) {
        setAffiliateProducts(siteData.affiliateProducts)
      }

      // Category links
      if (siteData.categoryLinks?.length) {
        setCategoryLinks(siteData.categoryLinks)
      }

      // Testimonials
      if (siteData.testimonials?.length) {
        setTestimonials(siteData.testimonials)
      }

      // FAQ
      if (siteData.faq?.length) {
        setFaq(siteData.faq)
      }

      // Наръчници
      if (narData.naruchnici?.length) {
        setHandbooks(narData.naruchnici.map((n: any) => ({
          slug: n.slug,
          title: n.title,
          subtitle: n.subtitle || '',
          emoji: n.emoji || (n.category === 'domati' ? '🍅' : n.category === 'krastavici' ? '🥒' : '🌿'),
          color: n.color || (n.category === 'domati' ? '#dc2626' : '#16a34a'),
          bg: n.bg || (n.category === 'domati' ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'linear-gradient(135deg,#16a34a,#166534)'),
          badge: n.badge || n.category,
        })))
      }

      setDataLoaded(true)
    }).catch(() => setDataLoaded(true))
  }, [])

  // ── Cart helpers ──
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const shipping = cartTotal >= settings.free_shipping_above ? 0 : settings.shipping_price

  const addToCart = (product: { id: string; name: string; price: number }) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1 }]
    })
    setCartVisible(true)
  }

  const submitOrder = async () => {
    if (!orderForm.name || !orderForm.phone || !orderForm.address || !orderForm.city) return
    setOrderLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: orderForm.name, customer_phone: orderForm.phone,
          customer_email: orderForm.email, customer_address: orderForm.address,
          customer_city: orderForm.city, customer_notes: orderForm.notes,
          payment_method: orderForm.payment,
          items: cart.map(i => ({ product_name: i.name, quantity: i.qty, unit_price: i.price, total_price: i.price * i.qty })),
          subtotal: cartTotal, shipping, total: cartTotal + shipping,
        }),
      })
      const data = await res.json()
      if (data.order_number) { setOrderDone(data.order_number); setCart([]) }
    } catch {}
    setOrderLoading(false)
  }

  const trackAffiliate = (partner: string, slug: string) => {
    fetch('/api/analytics/affiliate-click', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner, product_slug: slug }),
    }).catch(() => {})
  }

  const submitHandbook = async (slug: string) => {
    if (!hbEmail || !hbEmail.includes('@')) { setHbError('Моля въведи валиден имейл'); return }
    setHbLoading(true); setHbError('')
    try {
      await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: hbEmail.trim(), name: hbName.trim() || null, phone: hbPhone.trim() || null, source: 'naruchnik', naruchnik_slug: slug }),
      })
      const res = await fetch(`/api/naruchnici?slug=${encodeURIComponent(slug)}`)
      const data = await res.json()
      const nar = (data.naruchnici || [])[0]
      if (nar?.pdf_url) {
        setHbDone({ pdfUrl: nar.pdf_url, title: nar.title })
        const a = document.createElement('a')
        a.href = nar.pdf_url; a.download = nar.title + '.pdf'; a.target = '_blank'
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
      } else { setHbError('Проблем при зареждане на файла. Опитай пак.') }
    } catch { setHbError('Грешка. Опитай пак.') }
    setHbLoading(false)
  }

  // ── Parse JSON settings safely ──
  const trustItems: { icon: string; text: string }[] = (() => {
    try { return JSON.parse(settings.trust_strip_items) } catch { return [] }
  })()
  const socialItems: { number: string; label: string }[] = (() => {
    try { return JSON.parse(settings.social_proof_items) } catch { return [] }
  })()

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style suppressHydrationWarning>{`
        .hb-input::placeholder { color: rgba(255,255,255,0.45); }
        .hb-input { color: #fff !important; }
        .hb-input:focus { border-color: #86efac !important; outline: none; }
      `}</style>

      {/* URGENCY BAR */}
      <div className="urgency-bar">
        {parseBold(settings.urgency_bar_text)}
      </div>

      {/* HEADER */}
      <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
        <a href="#" className="header-logo">
          <span style={{ fontSize: 24 }}>🍅</span>
          <div>
            <div className="logo-name">Denny Angelow</div>
            <div className="logo-sub">Агро Консултант</div>
          </div>
        </a>
        <nav className="header-nav">
          <a href="#produkti" className="nav-link">Продукти</a>
          <a href="#atlas" className="nav-link">Atlas Terra</a>
          <a href="#ginegar" className="nav-link">Ginegar</a>
          <a href="#testimonials" className="nav-link">Отзиви</a>
          <a href="#faq" className="nav-link">Въпроси</a>
        </nav>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => setCartVisible(true)} className={`cart-btn${cartCount > 0 ? ' cart-btn--active' : ''}`}>
            🛒 {cartCount > 0 ? `(${cartCount}) ` : ''}Количка
          </button>
          <button className="mob-btn" onClick={() => setMobileMenuOpen(v => !v)}>
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="mob-nav">
          {[['#produkti','Продукти'],['#atlas','Atlas Terra'],['#testimonials','Отзиви'],['#faq','Въпроси']].map(([h,l]) => (
            <a key={h} href={h} className="mob-nav-link" onClick={() => setMobileMenuOpen(false)}>{l}</a>
          ))}
        </div>
      )}

      {/* ══ HERO ══ */}
      <section className="hero">
        <div className="hero-dots" />
        <div className="hero-blob hero-blob--tr" />
        <div className="hero-blob hero-blob--bl" />

        <div className="hero-inner">
          <div className="hero-left">
            <div className="trust-badge">
              <img src={`${CDN}/687aa8144659d_504368576_24540238958894103_5234342802938640767_n.jpg`} alt="Denny" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.5)', flexShrink: 0 }} />
              <span>@dennyangelow · {socialItems.find(s => s.label === 'последователи')?.number || '85K'}+ последователи · 8+ год. практика</span>
              <span className="live-dot" />
            </div>

            <h1 className="hero-title">
              {settings.hero_title}
            </h1>

            <div className="about-strip">
              <div className="about-item">🎁 <strong>2 безплатни наръчника</strong> — изтегли веднага, без регистрация</div>
              <div className="about-item">👨‍🌾 Фермер с <strong>8+ години</strong> практически опит · <strong>{socialItems.find(s => s.label === 'последователи')?.number || '85K'}</strong> последователи</div>
              <div className="about-item">🌿 <strong>100% органични</strong> методи — без химия, без загубена реколта</div>
            </div>

            <div className="hero-chips">
              {[['🛡️','Защита от болести'],['🌿','Кои торове работят'],['📅','Календар за третиране'],['🎁','Всичко безплатно']].map(([i,t]) => (
                <span key={t} className="chip"><span>{i}</span>{t}</span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
              {socialItems.map(({ number, label }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ color: '#86efac', fontWeight: 900, fontSize: 20, fontFamily: "'Cormorant Garamond', serif", lineHeight: 1 }}>{number}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Наръчници панел ── */}
          <div className="hero-right">
            <div className="handbooks-panel">
              <div className="handbooks-panel-header">
                <div className="handbooks-panel-icon">🎁</div>
                <div>
                  <div className="handbooks-panel-title">Безплатни Наръчници</div>
                  <div className="handbooks-panel-sub">Избери · Попълни имейл · Изтегли веднага</div>
                </div>
              </div>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '0 0 14px' }} />

              {hbDone ? (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <div style={{ fontSize: 42, marginBottom: 8 }}>✅</div>
                  <div style={{ color: '#86efac', fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Наръчникът се сваля!</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 14 }}>Изпратихме и потвърждение на {hbEmail}</div>
                  <a href={hbDone.pdfUrl} target="_blank" rel="noopener noreferrer" download
                    style={{ display: 'inline-block', background: '#16a34a', color: '#fff', borderRadius: 12, padding: '12px 22px', textDecoration: 'none', fontWeight: 800, fontSize: 14, marginBottom: 12 }}>
                    📥 Изтегли пак
                  </a>
                  <button onClick={() => { setHbDone(null); setSelectedSlug(null); setHbEmail(''); setHbName(''); setHbPhone('') }}
                    style={{ display: 'block', margin: '0 auto', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
                    ← Избери друг наръчник
                  </button>
                </div>
              ) : selectedSlug ? (
                <div>
                  {(() => { const hb = handbooks.find(h => h.slug === selectedSlug); return hb ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
                      <span style={{ fontSize: 24 }}>{hb.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{hb.title}</div>
                      </div>
                      <button onClick={() => setSelectedSlug(null)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 8, width: 26, height: 26, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    </div>
                  ) : null })()}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    <input type="text" className="hb-input" placeholder="Твоето име (по желание)" value={hbName} onChange={e => setHbName(e.target.value)}
                      style={{ padding: '11px 14px', borderRadius: 11, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
                      onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#86efac' }}
                      onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)' }} />
                    <input type="email" className="hb-input" placeholder="Имейл адрес *" value={hbEmail} onChange={e => { setHbEmail(e.target.value); setHbError('') }}
                      style={{ padding: '11px 14px', borderRadius: 11, border: `1.5px solid ${hbError ? '#f87171' : 'rgba(255,255,255,0.2)'}`, background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
                      onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#86efac' }}
                      onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = hbError ? '#f87171' : 'rgba(255,255,255,0.2)' }} />
                    <input type="tel" className="hb-input" placeholder="Телефон (по желание)" value={hbPhone} onChange={e => setHbPhone(e.target.value)}
                      style={{ padding: '11px 14px', borderRadius: 11, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
                      onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#86efac' }}
                      onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)' }} />
                    {hbError && <div style={{ color: '#f87171', fontSize: 12, fontWeight: 600 }}>⚠️ {hbError}</div>}
                    <button onClick={() => submitHandbook(selectedSlug)} disabled={hbLoading}
                      style={{ background: hbLoading ? '#4b5563' : 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 900, cursor: hbLoading ? 'wait' : 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', boxShadow: '0 6px 20px rgba(22,163,74,0.4)' }}>
                      {hbLoading ? '⏳ Зарежда...' : '📥 Изтегли Безплатно'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {handbooks.map((hb) => (
                    <button key={hb.slug} onClick={() => setSelectedSlug(hb.slug)} className="hb-card"
                      style={{ '--hb-color': hb.color, cursor: 'pointer', border: 'none', textAlign: 'left', width: '100%' } as React.CSSProperties}>
                      <div className="hb-card-emoji">{hb.emoji}</div>
                      <div className="hb-card-body">
                        <div className="hb-card-title">{hb.title}</div>
                        <div className="hb-card-sub">{hb.subtitle}</div>
                      </div>
                      <div className="hb-card-arrow">↓</div>
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
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <div className="trust-strip">
        {trustItems.map(({ icon, text }) => (
          <div key={text} className="trust-item"><span>{icon}</span><span>{text}</span></div>
        ))}
      </div>

      {/* CATEGORIES */}
      {categoryLinks.length > 0 && (
        <section id="kategorii" className="section-wrap">
          <FadeIn>
            <div className="section-head">
              <span className="s-tag">Магазин</span>
              <h2 className="s-title">Всичко за Твоята Градина</h2>
              <p className="s-desc">Избери категорията, която те интересува</p>
            </div>
          </FadeIn>
          <div className="categories-grid">
            {categoryLinks.map((c, i) => {
              const color = CAT_COLORS[c.partner || 'default'] || CAT_COLORS.default
              return (
                <FadeIn key={c.slug} delay={i * 55}>
                  <a href={c.href} target="_blank" rel="noopener noreferrer" className="cat-card"
                    onClick={() => c.partner && trackAffiliate(c.partner, c.slug)}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = color + '55'; el.style.boxShadow = `0 8px 28px ${color}22`; el.style.background = color + '08'; el.style.transform = 'translateY(-3px)' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#e5e7eb'; el.style.boxShadow = ''; el.style.background = '#fff'; el.style.transform = '' }}>
                    <span style={{ fontSize: 20, background: color + '18', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c.emoji}</span>
                    <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{c.label}</span>
                    <span style={{ color, fontSize: 16, opacity: 0.7 }}>→</span>
                  </a>
                </FadeIn>
              )
            })}
          </div>
        </section>
      )}

      {/* AFFILIATE PRODUCTS */}
      {affiliateProducts.length > 0 && (
        <section id="produkti" className="section-wrap" style={{ paddingTop: 0 }}>
          <FadeIn>
            <div className="section-head">
              <span className="s-tag">Препоръчани продукти</span>
              <h2 className="s-title">Проверени от Практиката</h2>
              <p className="s-desc">Продуктите, които лично използвам и препоръчвам</p>
            </div>
          </FadeIn>
          <div className="products-grid">
            {affiliateProducts.filter(p => p.partner === 'agroapteki').map((p, i) => {
              const cardColor = p.color || CAT_COLORS[p.partner] || '#16a34a'
              const badgeColor = p.badge_color || cardColor
              return (
                <FadeIn key={p.id} delay={i * 60}>
                  <div style={{
                    background: '#fff', borderRadius: 18, overflow: 'hidden',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1.5px solid #f0f0f0',
                    display: 'flex', flexDirection: 'column', height: '100%',
                    transition: 'all 0.22s',
                  }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-4px)'; el.style.boxShadow = `0 12px 40px ${cardColor}25`; el.style.borderColor = cardColor + '55' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '0 4px 24px rgba(0,0,0,0.08)'; el.style.borderColor = '#f0f0f0' }}>

                    {/* ── Изображение + badges ── */}
                    <div style={{ position: 'relative', background: '#f8f9fa', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 20px 0' }}>
                      {/* Badge горе вляво */}
                      {p.badge_text && (
                        <div style={{ position: 'absolute', top: 14, left: 14, background: badgeColor, color: '#fff', fontSize: 12, fontWeight: 800, padding: '5px 12px', borderRadius: 30, zIndex: 2, letterSpacing: '-0.01em' }}>
                          {p.badge_text}
                        </div>
                      )}
                      {/* Tag горе вдясно */}
                      {p.tag_text && (
                        <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.95)', color: '#374151', fontSize: 11.5, fontWeight: 700, padding: '5px 11px', borderRadius: 30, zIndex: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {p.emoji && <span style={{ fontSize: 13 }}>{p.emoji}</span>}
                          {p.tag_text}
                        </div>
                      )}
                      <img src={p.image_url} alt={p.name}
                        style={{ width: '100%', maxHeight: 180, objectFit: 'contain', display: 'block' }}
                        onError={e => { const img = e.currentTarget as HTMLImageElement; img.style.display = 'none'; const w = img.parentElement; if (w) { w.innerHTML = `<span style="font-size:72px">${p.emoji || '🌿'}</span>` } }} />
                    </div>

                    {/* ── Съдържание ── */}
                    <div style={{ padding: '18px 22px 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      {/* Category label */}
                      {p.category_label && (
                        <div style={{ fontSize: 11, fontWeight: 800, color: cardColor, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {p.emoji && <span style={{ fontSize: 13 }}>{p.emoji}</span>}
                          {p.category_label}
                        </div>
                      )}

                      <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 800, color: '#111', margin: '0 0 10px', lineHeight: 1.2 }}>
                        {p.name}
                      </h3>

                      <p style={{ fontSize: 13.5, color: '#6b7280', lineHeight: 1.65, marginBottom: 14, fontStyle: 'italic', flex: 0 }}>
                        „{p.description}"
                      </p>

                      {/* Bullets */}
                      {p.bullets?.length > 0 && (
                        <ul style={{ margin: '0 0 20px', padding: 0, listStyle: 'none', flex: 1 }}>
                          {p.bullets.slice(0, 3).map((b, j) => (
                            <li key={j} style={{ fontSize: 13, color: '#374151', padding: '5px 0', display: 'flex', gap: 9, alignItems: 'flex-start', borderBottom: '1px solid #f5f5f5' }}>
                              <span style={{ background: cardColor, color: '#fff', width: 16, height: 16, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>✓</span>
                              {b}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* CTA бутон */}
                      <a href={p.affiliate_url} target="_blank" rel="noopener noreferrer"
                        onClick={() => trackAffiliate(p.partner, p.slug)}
                        style={{ display: 'block', textAlign: 'center', background: cardColor, color: '#fff', padding: '13px 20px', borderRadius: 12, textDecoration: 'none', fontWeight: 800, fontSize: 14.5, marginTop: 'auto', transition: 'filter 0.15s', letterSpacing: '-0.01em' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = '' }}>
                        Прочети повече →
                      </a>
                    </div>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </section>
      )}

      {/* ATLAS TERRA */}
      {atlasProducts.length > 0 && (
        <section id="atlas" className="atlas-section">
          <div className="atlas-blob" />
          <div style={{ maxWidth: 1060, margin: '0 auto', position: 'relative' }}>
            <FadeIn>
              <div className="section-head">
                <span style={{ background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '6px 18px', borderRadius: 30, letterSpacing: '0.08em', textTransform: 'uppercase' }}>🏭 ДИРЕКТНО ОТ ПРОИЗВОДИТЕЛЯ</span>
                <h2 className="s-title" style={{ marginTop: 18 }}>Atlas Terra — Поръчай Директно</h2>
                <p className="s-desc">Три продукта. Едно решение — здрава почва, мощен растеж и максимален добив.</p>
              </div>
            </FadeIn>
            <div className="atlas-grid">
              {atlasProducts.map((p, i) => (
                <FadeIn key={p.id} delay={i * 100}>
                  <div className="atlas-card"
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-6px)'; el.style.boxShadow = '0 20px 60px rgba(22,163,74,0.15)'; el.style.borderColor = '#86efac' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '0 8px 40px rgba(0,0,0,0.09)'; el.style.borderColor = '#d1fae5' }}>
                    <div style={{ position: 'relative', minHeight: 200, background: '#e8f5e9' }}>
                      <img src={p.img} alt={p.name} style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }}
                        onError={e => { const img = e.currentTarget as HTMLImageElement; img.style.display = 'none'; const w = img.parentElement; if (w) { w.style.display = 'flex'; w.style.alignItems = 'center'; w.style.justifyContent = 'center'; w.style.fontSize = '56px'; w.style.background = 'linear-gradient(135deg,#dcfce7,#bbf7d0)'; w.innerHTML = `<span>${p.emoji}</span>` } }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%)', pointerEvents: 'none' }} />
                      <span style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.95)', color: '#16a34a', fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20 }}>⭐ {p.badge}</span>
                      <div style={{ position: 'absolute', bottom: 16, left: 18, right: 18 }}>
                        <div style={{ fontSize: 24, marginBottom: 3 }}>{p.emoji}</div>
                        <h3 style={{ color: '#fff', margin: 0, fontSize: 22, fontFamily: "'Cormorant Garamond', serif", fontWeight: 800 }}>{p.name}</h3>
                        <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12 }}>{p.subtitle}</div>
                      </div>
                    </div>
                    <div style={{ padding: '20px 22px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <p style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.7, marginBottom: 14, fontStyle: 'italic' }}>„{p.desc}"</p>
                      <ul style={{ margin: '0 0 20px', padding: 0, listStyle: 'none', flex: 1 }}>
                        {p.features.map((f: string) => (
                          <li key={f} style={{ fontSize: 13, color: '#374151', padding: '4px 0', display: 'flex', gap: 9, alignItems: 'flex-start', borderBottom: '1px solid #f3f4f6' }}>
                            <span style={{ background: '#16a34a', color: '#fff', width: 15, height: 15, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, flexShrink: 0, marginTop: 2 }}>✓</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 26, fontWeight: 900, color: '#16a34a', fontFamily: "'Cormorant Garamond', serif", lineHeight: 1 }}>{p.priceLabel}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                            <span style={{ textDecoration: 'line-through', marginRight: 5 }}>{p.comparePrice.toFixed(2)} лв.</span>
                            <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 5, fontWeight: 800, fontSize: 10 }}>-{Math.round((1 - p.price / p.comparePrice) * 100)}%</span>
                          </div>
                        </div>
                        <button onClick={() => addToCart(p)} className="add-btn">🛒 Добави</button>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
            <FadeIn>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <p style={{ color: '#6b7280', marginBottom: 14, fontSize: 14 }}>При поръчка на ATLAS TERRA, поръчваш директно от ПРОИЗВОДИТЕЛЯ.</p>
                <div style={{ marginTop: 12, fontSize: 13, color: '#16a34a', fontWeight: 700 }}>
                  🚚 Безплатна доставка над {settings.free_shipping_above} лв. · Еконт &amp; Спиди
                </div>
              </div>
            </FadeIn>
          </div>
        </section>
      )}

      {/* СПЕЦИАЛЕН ПРОДУКТ — първият с partner != 'agroapteki' */}
      {(() => {
        const gp = affiliateProducts.find(p => p.partner !== 'agroapteki')
        if (!gp) return null
        return (
          <section id="ginegar" className="ginegar-section">
            <div className="ginegar-glow" />
            <div className="ginegar-dots" />
            <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 1 }}>
              <FadeIn>
                <div className="ginegar-inner">
                  <div className="ginegar-text">
                    <span style={{ background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '6px 16px', borderRadius: 30, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'inline-block', marginBottom: 16 }}>🏕️ ИЗРАЕЛСКА ТЕХНОЛОГИЯ</span>
                    <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#fff', fontSize: 'clamp(26px, 3.5vw, 38px)', margin: '0 0 14px', fontWeight: 800, lineHeight: 1.15 }}>{gp.name}</h2>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.8, marginBottom: 22 }}>{gp.description}</p>
                    <ul style={{ margin: '0 0 28px', padding: 0, listStyle: 'none' }}>
                      {gp.bullets.map(f => (
                        <li key={f} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, padding: '7px 0', display: 'flex', gap: 11, borderBottom: '1px solid rgba(255,255,255,0.07)', alignItems: 'flex-start' }}>
                          <span style={{ background: '#16a34a', color: '#fff', width: 17, height: 17, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <a href={gp.affiliate_url} target="_blank" rel="noopener noreferrer" onClick={() => trackAffiliate(gp.partner, gp.slug)} className="ginegar-btn">
                      👉 Разгледай фолиата на Ginegar
                    </a>
                  </div>
                  <div className="ginegar-img-wrap">
                    <div style={{ position: 'absolute', inset: -16, background: 'radial-gradient(circle, rgba(22,163,74,0.22), transparent 70%)', borderRadius: '50%' }} />
                    <img src={gp.image_url} alt={gp.name} style={{ width: '100%', maxWidth: 260, borderRadius: 18, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', position: 'relative' }} />
                  </div>
                </div>
              </FadeIn>
            </div>
          </section>
        )
      })()}

      {/* GINEGAR */}
      <section className="ginegar-section">
        <div className="ginegar-glow" />
        <div className="ginegar-dots" />
        <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <FadeIn>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 56, alignItems: 'center' }}>
              <div style={{ flex: '1 1 380px' }}>
                <span style={{ background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '6px 16px', borderRadius: 30, letterSpacing: '0.08em', textTransform: 'uppercase' }}>🏕️ ИЗРАЕЛСКА ТЕХНОЛОГИЯ</span>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#fff', fontSize: 'clamp(26px, 3.5vw, 38px)', margin: '18px 0 14px', fontWeight: 800, lineHeight: 1.15 }}>
                  Ginegar — Премиум<br />Найлон за Оранжерии
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 1.75, marginBottom: 24 }}>
                  Световен стандарт за здравина, светлина и дълъг живот. GINEGAR не е най-евтиният избор — той е изборът, <strong style={{ color: '#86efac' }}>който излиза най-изгоден с времето.</strong>
                </p>
                <ul style={{ margin: '0 0 32px', padding: 0, listStyle: 'none' }}>
                  {['9-слойна технология (всеки слой с функция)', 'UV защита и анти-капка ефект', 'Равномерно осветление на растенията', 'По-малко подмяна — по-ниска цена на сезон'].map(f => (
                    <li key={f} style={{ color: 'rgba(255,255,255,0.78)', fontSize: 14, padding: '7px 0', display: 'flex', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ background: '#16a34a', color: '#fff', width: 18, height: 18, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="https://oranjeriata.com/products/polietilen-za-oranjerii/izraelski-polietiolen-za-oranjerii/ginegar" target="_blank" rel="noopener noreferrer" onClick={() => trackAffiliate('oranjeriata', 'ginegar')} className="ginegar-btn">
                  👉 Разгледай фолиата на Ginegar
                </a>
              </div>
              <div style={{ flex: '0 0 260px', textAlign: 'center' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <div style={{ position: 'absolute', inset: -12, background: 'radial-gradient(circle, rgba(22,163,74,0.25), transparent 70%)', borderRadius: '50%' }} />
                  <img src={`${CDN}/6940e17e0d4a3_pe-film-supflor-ginegar.jpg`} alt="Ginegar фолио" style={{ width: '100%', maxWidth: 260, borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', position: 'relative' }} />
                </div>
                <img src={`${CDN}/694242e9c1baa_ginegar-logo-mk-group.600x600.png`} alt="Ginegar logo" style={{ width: 90, marginTop: 20, filter: 'brightness(0) invert(1)', opacity: 0.65 }} />
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* TESTIMONIALS */}
      {testimonials.length > 0 && (
        <section id="testimonials" className="section-wrap" style={{ background: '#fff' }}>
          <FadeIn>
            <div className="section-head">
              <span className="s-tag">Отзиви</span>
              <h2 className="s-title">Какво казват фермерите</h2>
              <p className="s-desc">Реални резултати от реални хора — без филтри</p>
            </div>
          </FadeIn>
          <div className="testimonials-grid">
            {testimonials.map((t, i) => (
              <FadeIn key={t.id} delay={i * 80}>
                <div className="testimonial-card">
                  <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>
                    {Array.from({ length: t.stars }).map((_, j) => <span key={j} style={{ color: '#f59e0b', fontSize: 14 }}>★</span>)}
                  </div>
                  <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 14, fontStyle: 'italic', flex: 1 }}>„{t.text}"</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                    <span style={{ fontSize: 26, lineHeight: 1 }}>{t.avatar}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#111' }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>📍 {t.location}</div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      {faq.length > 0 && (
        <section id="faq" className="section-wrap" style={{ background: '#fafaf8' }}>
          <FadeIn>
            <div className="section-head">
              <span className="s-tag">Въпроси &amp; Отговори</span>
              <h2 className="s-title">Често Задавани Въпроси</h2>
              <p className="s-desc">Всичко за Atlas Terra, Ginegar и органичното земеделие</p>
            </div>
          </FadeIn>
          <div className="faq-list">
            {faq.map((item, i) => (
              <FadeIn key={item.id} delay={i * 35}>
                <div className={`faq-item${openFaq === i ? ' faq-open' : ''}`} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <div className="faq-q"><span>{item.question}</span><span className="faq-icon">{openFaq === i ? '−' : '+'}</span></div>
                  {openFaq === i && <div className="faq-a">{item.answer}</div>}
                </div>
              </FadeIn>
            ))}
          </div>
        </section>
      )}

      {/* SECOND CTA */}
      <section className="cta-section">
        <div className="cta-dots" />
        <div style={{ maxWidth: 520, margin: '0 auto', position: 'relative', textAlign: 'center' }}>
          <FadeIn>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 14, fontSize: 40 }}>
              <span>🍅</span><span>🥒</span>
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#fff', fontSize: 'clamp(26px, 4vw, 38px)', margin: '0 0 12px', fontWeight: 800 }}>
              {settings.cta_title}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
              {parseBold(settings.cta_subtitle)}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360, margin: '0 auto' }}>
              {handbooks.map(hb => (
                <a key={hb.slug} href={`/naruchnik/${hb.slug}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, background: hb.color, color: '#fff', padding: '14px 22px', borderRadius: 14, textDecoration: 'none', fontWeight: 800, fontSize: 15, boxShadow: `0 6px 24px ${hb.color}55`, transition: 'all .2s' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = `0 10px 32px ${hb.color}66` }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = `0 6px 24px ${hb.color}55` }}>
                  <span style={{ fontSize: 22 }}>{hb.emoji}</span>
                  <span style={{ flex: 1 }}>{hb.title}</span>
                  <span style={{ fontSize: 18, opacity: 0.8 }}>↓</span>
                </a>
              ))}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 18 }}>🔒 Без спам · Без регистрация · Директно сваляне</p>
          </FadeIn>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="site-footer">
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 28, marginBottom: 36, textAlign: 'left' }}>
            <div>
              <div style={{ fontSize: 26, marginBottom: 8 }}>🍅</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, color: '#fff', fontWeight: 700, marginBottom: 4 }}>Denny Angelow</div>
              <div style={{ fontSize: 10, color: '#86efac', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Агро Консултант</div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{settings.footer_about_text}</p>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Наръчници</div>
              {handbooks.map(hb => (
                <a key={hb.slug} href={`/naruchnik/${hb.slug}`} style={{ display: 'block', marginBottom: 7, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 13.5, fontWeight: 600, transition: 'color 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#86efac' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)' }}>
                  {hb.emoji} {hb.title}
                </a>
              ))}
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Партньори</div>
              {[
                { label: '🌿 AgroApteki.bg', href: `https://agroapteki.com/${AFF}` },
                { label: '🏡 Oranjeriata.bg', href: 'https://oranjeriata.com/' },
                { label: '🌱 AtlasAgro.eu', href: 'https://atlasagro.eu/' },
              ].map(l => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener" style={{ display: 'block', marginBottom: 7, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 13.5, fontWeight: 600, transition: 'color 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#86efac' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)' }}>
                  {l.label}
                </a>
              ))}
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Контакт</div>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
                📧 <a href={`mailto:${settings.site_email}`} style={{ color: '#86efac', fontWeight: 600, textDecoration: 'none' }}>{settings.site_email}</a>
              </p>
              {settings.site_phone && (
                <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
                  📞 <a href={`tel:${settings.site_phone}`} style={{ color: '#86efac', fontWeight: 600, textDecoration: 'none' }}>{settings.site_phone}</a>
                </p>
              )}
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>Пон–Пет, 9:00–17:00 ч.</p>
            </div>
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 18 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>© 2025–2026 Denny Angelow · Всички права запазени</div>
            <a href="/admin" style={{ color: 'rgba(255,255,255,0.15)', textDecoration: 'none', fontSize: 11 }}>Admin</a>
          </div>
        </div>
      </footer>

      {/* CART DRAWER */}
      {cartVisible && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <div onClick={() => setCartVisible(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} />
          <div className="cart-drawer">
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 700 }}>🛒 Количка</h3>
              <button onClick={() => setCartVisible(false)} style={{ background: '#f3f4f6', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280', width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px' }}>
              {orderDone ? (
                <div style={{ textAlign: 'center', padding: '44px 16px' }}>
                  <div style={{ fontSize: 52, marginBottom: 14 }}>🎉</div>
                  <h3 style={{ color: '#16a34a', fontFamily: "'Cormorant Garamond', serif", fontSize: 22, margin: '0 0 8px' }}>Поръчката е приета!</h3>
                  <p style={{ color: '#374151', marginBottom: 4 }}>Номер: <strong>{orderDone}</strong></p>
                  <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 22 }}>Ще се свържем с теб до 24 часа.</p>
                  <button onClick={() => { setCartVisible(false); setOrderDone('') }} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 26px', cursor: 'pointer', fontWeight: 800, fontSize: 15, fontFamily: 'inherit' }}>Затвори</button>
                </div>
              ) : cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '56px 0', color: '#9ca3af' }}>
                  <div style={{ fontSize: 52, marginBottom: 10 }}>🛒</div>
                  <p style={{ fontSize: 16, fontWeight: 700 }}>Количката е празна</p>
                  <p style={{ fontSize: 13, marginTop: 5 }}>Добави продукти от секцията Atlas Terra</p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 18 }}>
                    {cart.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13.5, color: '#111', marginBottom: 2 }}>{item.name}</div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>{item.price.toFixed(2)} лв. × {item.qty}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <button onClick={() => setCart(p => p.map(i => i.id === item.id ? { ...i, qty: Math.max(0, i.qty - 1) } : i).filter(i => i.qty > 0))} style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                          <span style={{ fontWeight: 800, minWidth: 20, textAlign: 'center', fontSize: 14 }}>{item.qty}</span>
                          <button onClick={() => setCart(p => p.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i))} style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 13.5, minWidth: 65, textAlign: 'right', color: '#16a34a' }}>{(item.price * item.qty).toFixed(2)} лв.</div>
                      </div>
                    ))}
                    <div style={{ padding: '12px 0', fontSize: 14, color: '#4b5563' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}><span>Продукти:</span><span>{cartTotal.toFixed(2)} лв.</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span>Доставка:</span>
                        <span style={{ color: shipping === 0 ? '#16a34a' : 'inherit', fontWeight: shipping === 0 ? 700 : 400 }}>{shipping === 0 ? '🎉 Безплатна!' : `${shipping.toFixed(2)} лв.`}</span>
                      </div>
                      {shipping > 0 && <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '7px 11px', fontSize: 12, color: '#92400e', marginBottom: 8 }}>Добави още <strong>{(settings.free_shipping_above - cartTotal).toFixed(2)} лв.</strong> за безплатна доставка</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 18, color: '#111', borderTop: '2px solid #e5e7eb', paddingTop: 11, marginTop: 4 }}>
                        <span>Общо:</span><span style={{ color: '#16a34a' }}>{(cartTotal + shipping).toFixed(2)} лв.</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📦 Данни за доставка</div>
                    {([{ key: 'name', placeholder: 'Три имена *', type: 'text' }, { key: 'phone', placeholder: 'Телефон *', type: 'tel' }, { key: 'email', placeholder: 'Имейл (по желание)', type: 'email' }, { key: 'address', placeholder: 'Адрес *', type: 'text' }, { key: 'city', placeholder: 'Град *', type: 'text' }] as const).map(field => (
                      <input key={field.key} type={field.type} placeholder={field.placeholder} value={orderForm[field.key]} onChange={e => setOrderForm(f => ({ ...f, [field.key]: e.target.value }))}
                        style={{ padding: '11px 14px', borderRadius: 11, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', color: '#111', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', background: '#fff' }}
                        onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#16a34a' }}
                        onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb' }} />
                    ))}
                    <textarea placeholder="Бележки (по желание)" value={orderForm.notes} onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                      style={{ padding: '11px 14px', borderRadius: 11, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit', color: '#111', width: '100%', boxSizing: 'border-box', background: '#fff' }} />
                    <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 11, padding: '11px 14px', fontSize: 14, color: '#166534', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                      💵 Плащане: Наложен платеж (при доставка)
                    </div>
                  </div>
                </>
              )}
            </div>
            {!orderDone && cart.length > 0 && (
              <div style={{ padding: '14px 22px', borderTop: '1px solid #e5e7eb', background: '#fafaf8' }}>
                <button onClick={submitOrder} disabled={orderLoading || !orderForm.name || !orderForm.phone || !orderForm.address || !orderForm.city}
                  style={{ width: '100%', padding: '15px', borderRadius: 14, border: 'none', background: (!orderForm.name || !orderForm.phone || !orderForm.address || !orderForm.city) ? '#d1d5db' : '#16a34a', color: '#fff', fontWeight: 900, fontSize: 16, cursor: (!orderForm.name || !orderForm.phone || !orderForm.address || !orderForm.city) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', fontFamily: 'inherit' }}>
                  {orderLoading ? 'Изпращане...' : `✅ Поръчай — ${(cartTotal + shipping).toFixed(2)} лв.`}
                </button>
                <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 9 }}>🔒 Сигурна поръчка · Плащане при доставка</p>
              </div>
            )}
          </div>
        </div>
      )}

      {cartCount > 0 && !cartVisible && (
        <button onClick={() => setCartVisible(true)} className="float-cart">
          🛒 {cartCount} · {(cartTotal + shipping).toFixed(2)} лв.
        </button>
      )}
    </>
  )
}
