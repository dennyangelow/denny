'use client'

import React, { useState, useEffect } from 'react'
import { FadeIn } from '@/components/marketing/FadeIn'
import { LeadForm } from '@/components/marketing/LeadForm'
import { ProductCard } from '@/components/marketing/ProductCard'
import { PRODUCTS, ATLAS_PRODUCTS, AFFILIATE_CATEGORIES, TESTIMONIALS, CDN, AFF } from '@/lib/marketing-data'

interface CartItem { id: string; name: string; price: number; qty: number }
interface OrderForm { name: string; phone: string; email: string; address: string; city: string; notes: string; payment: string }

export default function HomePage() {
  const [cartVisible, setCartVisible] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderForm, setOrderForm] = useState<OrderForm>({ name: '', phone: '', email: '', address: '', city: '', notes: '', payment: 'cod' })
  const [orderLoading, setOrderLoading] = useState(false)
  const [orderDone, setOrderDone] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const addToCart = (product: typeof ATLAS_PRODUCTS[number]) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1 }]
    })
    setCartVisible(true)
  }

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const shipping = cartTotal >= 60 ? 0 : 5.99

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
    fetch('/api/analytics/affiliate-click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partner, product_slug: slug }) }).catch(() => {})
  }

  return (
    <>
      <style>{pageCSS}</style>

      {/* URGENCY BAR */}
      <div className="urgency-bar">
        🔥 <strong>Безплатна доставка</strong> при поръчка над 60 лв. &nbsp;·&nbsp; 📗 Над 6 000 изтеглени наръчника
      </div>

      {/* HEADER */}
      <header className={`site-header${scrolled ? ' site-header--scrolled' : ''}`}>
        <a href="#" className="header-logo" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: 26 }}>🍅</span>
          <div>
            <div className="logo-name">Denny Angelow</div>
            <div className="logo-sub">Агро Консултант</div>
          </div>
        </a>
        <nav className="header-nav">
          <a href="#produkti" className="nav-link">Продукти</a>
          <a href="#atlas" className="nav-link">Atlas Terra</a>
          <a href="#testimonials" className="nav-link">Отзиви</a>
          <a href="#kategorii" className="nav-link">Магазин</a>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setCartVisible(true)} className={`cart-button${cartCount > 0 ? ' cart-button--active' : ''}`}>
            🛒 {cartCount > 0 ? `(${cartCount})` : ''} Количка
          </button>
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(v => !v)} aria-label="Меню">
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {/* MOBILE NAV */}
      {mobileMenuOpen && (
        <div className="mobile-nav">
          {[['#produkti','Продукти'],['#atlas','Atlas Terra'],['#testimonials','Отзиви'],['#kategorii','Магазин']].map(([h,l]) => (
            <a key={h} href={h} className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>{l}</a>
          ))}
        </div>
      )}

      {/* HERO */}
      <section className="hero-section">
        <div className="hero-dots" />
        <div className="hero-blob hero-blob--tr" />
        <div className="hero-blob hero-blob--bl" />

        <div className="hero-inner">
          <div className="hero-left">
            <div className="trust-badge">
              <img
                src={`${CDN}/687aa8144659d_504368576_24540238958894103_5234342802938640767_n.jpg`}
                alt="Denny"
                style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.5)', flexShrink: 0 }}
              />
              <span>@dennyangelow · 85K+ последователи</span>
              <span className="live-dot" />
            </div>

            <h1 className="hero-title">
              Тайните на<br />
              <span className="shimmer-text">Едрите и Вкусни<br />Домати</span>
            </h1>

            <p className="hero-desc">
              Искаш едри, здрави и сочни домати — без болести, без гниене и без загубена реколта? Открий проверените методи и продукти.
            </p>

            <div className="hero-features">
              {[
                { i: '🛡️', t: 'Защита от болести' },
                { i: '🌿', t: 'Кои торове работят' },
                { i: '📅', t: 'Календар за третиране' },
                { i: '❌', t: 'Грешки убиващи реколтата' },
              ].map(f => (
                <span key={f.t} className="feature-chip"><span>{f.i}</span> {f.t}</span>
              ))}
            </div>

            <div className="lead-box">
              <p className="lead-tag">📗 БЕЗПЛАТЕН НАРЪЧНИК</p>
              <h2 className="lead-title">„Тайните на Едрите Домати" — изтегли сега</h2>
              <LeadForm />
            </div>
          </div>

          <div className="hero-right">
            <div className="profile-card hero-float-anim">
              <img
                src={`${CDN}/687aa8144659d_504368576_24540238958894103_5234342802938640767_n.jpg`}
                alt="Denny Angelow"
                style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '3px solid #86efac', marginBottom: 12 }}
              />
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 17, fontFamily: "'Cormorant Garamond', serif" }}>Denny Angelow</div>
              <div style={{ color: '#86efac', fontSize: 12, fontWeight: 700, marginBottom: 14, letterSpacing: '0.04em' }}>Агро консултант &amp; фермер</div>
              <blockquote style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13.5, fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>
                „С правилните продукти, здрави домати без излишен стрес."
              </blockquote>
            </div>
            <div className="mini-stats">
              {[{ n: '85K+', l: 'Последователи' }, { n: '6 000+', l: 'Наръчника' }, { n: '100%', l: 'Органично' }, { n: '8+', l: 'Продукта' }].map(s => (
                <div key={s.n} className="mini-stat">
                  <div className="mini-stat-num">{s.n}</div>
                  <div className="mini-stat-label">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <div className="trust-strip">
        {[
          { i: '🌱', t: 'Органични продукти' },
          { i: '🚚', t: 'Доставка до вратата' },
          { i: '📞', t: 'Лична консултация' },
          { i: '⭐', t: '5-звездни отзиви' },
          { i: '🔒', t: 'Сигурно плащане' },
        ].map(x => (
          <div key={x.t} className="trust-item">
            <span>{x.i}</span> <span>{x.t}</span>
          </div>
        ))}
      </div>

      {/* CATEGORIES */}
      <section id="kategorii" className="section-wrap">
        <FadeIn>
          <div className="section-header">
            <span className="section-tag">Магазин</span>
            <h2 className="section-title">Всичко за Твоята Градина</h2>
            <p className="section-desc">Избери категорията, която те интересува</p>
          </div>
        </FadeIn>
        <div className="categories-grid">
          {AFFILIATE_CATEGORIES.map((c, i) => (
            <FadeIn key={c.label} delay={i * 55}>
              <a
                href={c.link}
                target="_blank"
                rel="noopener noreferrer"
                className="category-card"
                onClick={() => trackAffiliate('agroapteki', c.label)}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = c.color + '55'
                  el.style.boxShadow = `0 8px 28px ${c.color}22`
                  el.style.background = c.color + '08'
                  el.style.transform = 'translateY(-3px)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = '#e5e7eb'
                  el.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)'
                  el.style.background = '#fff'
                  el.style.transform = ''
                }}
              >
                <span style={{ fontSize: 22, background: c.color + '18', width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c.icon}</span>
                <span style={{ flex: 1 }}>{c.label}</span>
                <span style={{ color: c.color, fontSize: 16, opacity: 0.7 }}>→</span>
              </a>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* AFFILIATE PRODUCTS */}
      <section id="produkti" className="section-wrap" style={{ paddingTop: 0 }}>
        <FadeIn>
          <div className="section-header">
            <span className="section-tag">Препоръчани продукти</span>
            <h2 className="section-title">Проверени от Практиката</h2>
            <p className="section-desc">Продуктите, които лично използвам и препоръчвам на всеки фермер</p>
          </div>
        </FadeIn>
        <div className="products-grid">
          {PRODUCTS.map((p, i) => <ProductCard key={p.id} p={p} idx={i} />)}
        </div>
      </section>

      {/* ATLAS TERRA */}
      <section id="atlas" className="atlas-section">
        <div className="atlas-blob" />
        <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative' }}>
          <FadeIn>
            <div className="section-header">
              <span style={{ background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '6px 18px', borderRadius: 30, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>🏭 ДИРЕКТНО ОТ ПРОИЗВОДИТЕЛЯ</span>
              <h2 className="section-title" style={{ marginTop: 18 }}>Atlas Terra — Поръчай Директно</h2>
              <p className="section-desc">Два продукта. Един резултат — здрава почва и мощен растеж.</p>
            </div>
          </FadeIn>

          <div className="atlas-grid">
            {ATLAS_PRODUCTS.map((p, i) => (
              <FadeIn key={p.id} delay={i * 120}>
                <div
                  className="atlas-card"
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-6px)'; el.style.boxShadow = '0 20px 60px rgba(22,163,74,0.15)'; el.style.borderColor = '#86efac' }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '0 8px 40px rgba(0,0,0,0.09)'; el.style.borderColor = '#d1fae5' }}
                >
                  <div style={{ position: 'relative' }}>
                    <img src={p.img} alt={p.name} style={{ width: '100%', height: 220, objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 55%)' }} />
                    <span style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(255,255,255,0.95)', color: '#16a34a', fontSize: 11, fontWeight: 800, padding: '5px 14px', borderRadius: 24 }}>⭐ {p.badge}</span>
                    <div style={{ position: 'absolute', bottom: 18, left: 20, right: 20 }}>
                      <div style={{ fontSize: 28, marginBottom: 4 }}>{p.emoji}</div>
                      <h3 style={{ color: '#fff', margin: 0, fontSize: 24, fontFamily: "'Cormorant Garamond', serif", fontWeight: 800 }}>{p.name}</h3>
                      <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13 }}>{p.subtitle}</div>
                    </div>
                  </div>
                  <div style={{ padding: '22px 24px 26px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <p style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.7, marginBottom: 16, fontStyle: 'italic' }}>„{p.desc}"</p>
                    <ul style={{ margin: '0 0 24px', padding: 0, listStyle: 'none', flex: 1 }}>
                      {p.features.map(f => (
                        <li key={f} style={{ fontSize: 13.5, color: '#374151', padding: '5px 0', display: 'flex', gap: 10, alignItems: 'flex-start', borderBottom: '1px solid #f3f4f6' }}>
                          <span style={{ background: '#16a34a', color: '#fff', width: 16, height: 16, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, flexShrink: 0, marginTop: 2 }}>✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: '#16a34a', fontFamily: "'Cormorant Garamond', serif", lineHeight: 1 }}>{p.priceLabel}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                          <span style={{ textDecoration: 'line-through', marginRight: 6 }}>{p.comparePrice.toFixed(2)} лв.</span>
                          <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: 6, fontWeight: 800, fontSize: 10 }}>-{Math.round((1 - p.price / p.comparePrice) * 100)}%</span>
                        </div>
                      </div>
                      <button onClick={() => addToCart(p)} className="add-to-cart-btn">🛒 Добави</button>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 14 }}>Или поръчай директно от производителя</p>
              <a
                href="https://atlasagro.eu/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackAffiliate('atlasagro', 'atlas-terra')}
                className="cta-link-btn"
              >
                🛒 Купи от AtlasAgro.eu
              </a>
              <div style={{ marginTop: 14, fontSize: 13, color: '#16a34a', fontWeight: 700 }}>🚚 Безплатна доставка над 60 лв.</div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* GINEGAR */}
      <section className="ginegar-section">
        <div className="ginegar-glow" />
        <div className="ginegar-dots" />
        <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <FadeIn>
            <div className="ginegar-inner">
              <div className="ginegar-text">
                <span style={{ background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '6px 16px', borderRadius: 30, letterSpacing: '0.08em', textTransform: 'uppercase' as const, display: 'inline-block', marginBottom: 18 }}>🏕️ ИЗРАЕЛСКА ТЕХНОЛОГИЯ</span>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#fff', fontSize: 'clamp(26px, 3.5vw, 40px)', margin: '0 0 16px', fontWeight: 800, lineHeight: 1.15 }}>
                  Ginegar — Премиум<br />Найлон за Оранжерии
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.8, marginBottom: 24 }}>
                  Световен стандарт за здравина, светлина и дълъг живот. GINEGAR не е най-евтиният избор —{' '}
                  <strong style={{ color: '#86efac' }}>той е изборът, който излиза най-изгоден с времето.</strong>
                </p>
                <ul style={{ margin: '0 0 32px', padding: 0, listStyle: 'none' }}>
                  {[
                    '9-слойна технология (всеки слой с функция)',
                    'UV защита и анти-капка ефект',
                    'Равномерно осветление на растенията',
                    'По-малко подмяна — по-ниска цена на сезон',
                  ].map(f => (
                    <li key={f} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, padding: '8px 0', display: 'flex', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.07)', alignItems: 'flex-start' }}>
                      <span style={{ background: '#16a34a', color: '#fff', width: 18, height: 18, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="https://oranjeriata.com/products/polietilen-za-oranjerii/izraelski-polietiolen-za-oranjerii/ginegar"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackAffiliate('oranjeriata', 'ginegar')}
                  className="ginegar-btn"
                >
                  👉 Разгледай фолиата на Ginegar
                </a>
              </div>
              <div className="ginegar-img-wrap">
                <div style={{ position: 'absolute', inset: -16, background: 'radial-gradient(circle, rgba(22,163,74,0.22), transparent 70%)', borderRadius: '50%' }} />
                <img
                  src={`${CDN}/6940e17e0d4a3_pe-film-supflor-ginegar.jpg`}
                  alt="Ginegar фолио"
                  style={{ width: '100%', maxWidth: 280, borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', position: 'relative' }}
                />
                <img
                  src={`${CDN}/694242e9c1baa_ginegar-logo-mk-group.600x600.png`}
                  alt="Ginegar logo"
                  style={{ width: 90, marginTop: 20, filter: 'brightness(0) invert(1)', opacity: 0.6 }}
                />
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className="section-wrap" style={{ background: '#fff' }}>
        <FadeIn>
          <div className="section-header">
            <span className="section-tag">Отзиви</span>
            <h2 className="section-title">Какво казват фермерите</h2>
            <p className="section-desc">Реални резултати от реални хора</p>
          </div>
        </FadeIn>
        <div className="testimonials-grid">
          {TESTIMONIALS.map((t, i) => (
            <FadeIn key={t.name} delay={i * 80}>
              <div className="testimonial-card">
                <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <span key={j} style={{ color: '#f59e0b', fontSize: 15 }}>★</span>
                  ))}
                </div>
                <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 16, fontStyle: 'italic', flex: 1 }}>„{t.text}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid #f3f4f6', paddingTop: 14 }}>
                  <span style={{ fontSize: 30, lineHeight: 1 }}>{t.avatar}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#111' }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>📍 {t.location}</div>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Denny quote */}
        <FadeIn>
          <div style={{ textAlign: 'center', padding: '36px 28px', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', borderRadius: 24, border: '1px solid #bbf7d0', maxWidth: 700, margin: '48px auto 0' }}>
            <img
              src={`${CDN}/687aa8144659d_504368576_24540238958894103_5234342802938640767_n.jpg`}
              alt="Denny Angelow"
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #16a34a', marginBottom: 18 }}
            />
            <blockquote style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(18px, 2.5vw, 24px)', color: '#1a1a1a', fontStyle: 'italic', lineHeight: 1.65, margin: '0 0 18px' }}>
              „С правилната грижа и нужните продукти можеш да отгледаш здрави и продуктивни растения, без излишни усилия."
            </blockquote>
            <div style={{ fontWeight: 800, color: '#16a34a', fontSize: 15 }}>Denny Angelow</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>@iammyoungmoney · Агро Консултант</div>
          </div>
        </FadeIn>
      </section>

      {/* SECOND CTA */}
      <section className="cta-section">
        <div className="cta-dots" />
        <div style={{ maxWidth: 520, margin: '0 auto', position: 'relative', textAlign: 'center' }}>
          <FadeIn>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📗</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#fff', fontSize: 'clamp(26px, 4vw, 40px)', margin: '0 0 12px', fontWeight: 800 }}>
              Изтегли Безплатния Наръчник
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 16, lineHeight: 1.7, marginBottom: 36 }}>
              Над 6 000 фермери вече го имат. Вземи и ти тайните за едри, здрави домати — напълно безплатно.
            </p>
            <LeadForm />
          </FadeIn>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="kontakt" className="site-footer">
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32, marginBottom: 40, textAlign: 'left' }}>
            <div>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🍅</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: '#fff', fontWeight: 700, marginBottom: 4 }}>Denny Angelow</div>
              <div style={{ fontSize: 11, color: '#86efac', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Агро Консултант</div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>Помагам на фермери да отглеждат по-здрави растения с проверени органични методи.</p>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 14 }}>Партньори</div>
              {[{ label: '🌿 AgroApteki.bg', href: `https://agroapteki.com/${AFF}` }, { label: '🏡 Oranjeriata.bg', href: 'https://oranjeriata.com/' }, { label: '🌱 AtlasAgro.eu', href: 'https://atlasagro.eu/' }].map(l => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener" className="footer-link" style={{ display: 'block', marginBottom: 8, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 14, fontWeight: 600, transition: 'color 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#86efac' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)' }}>
                  {l.label}
                </a>
              ))}
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 14 }}>Контакт</div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>📧 <a href="mailto:support@dennyangelow.com" style={{ color: '#86efac', fontWeight: 600, textDecoration: 'none' }}>support@dennyangelow.com</a></p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>Работим от пон–пет, 9:00–17:00 ч.</p>
            </div>
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 20 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
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
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700 }}>🛒 Количка</h3>
              <button onClick={() => setCartVisible(false)} style={{ background: '#f3f4f6', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {orderDone ? (
                <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                  <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
                  <h3 style={{ color: '#16a34a', fontFamily: "'Cormorant Garamond', serif", fontSize: 24, margin: '0 0 8px' }}>Поръчката е приета!</h3>
                  <p style={{ color: '#374151', marginBottom: 4 }}>Номер: <strong>{orderDone}</strong></p>
                  <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>Ще се свържем с теб до 24 часа.</p>
                  <button onClick={() => { setCartVisible(false); setOrderDone('') }} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px', cursor: 'pointer', fontWeight: 800, fontSize: 15 }}>Затвори</button>
                </div>
              ) : cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px 0', color: '#9ca3af' }}>
                  <div style={{ fontSize: 56, marginBottom: 12 }}>🛒</div>
                  <p style={{ fontSize: 16, fontWeight: 700 }}>Количката е празна</p>
                  <p style={{ fontSize: 13, marginTop: 6 }}>Добави продукти от секцията Atlas Terra</p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 20 }}>
                    {cart.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f3f4f6', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#111', marginBottom: 2 }}>{item.name}</div>
                          <div style={{ fontSize: 13, color: '#6b7280' }}>{item.price.toFixed(2)} лв. × {item.qty}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => setCart(p => p.map(i => i.id === item.id ? { ...i, qty: Math.max(0, i.qty - 1) } : i).filter(i => i.qty > 0))} style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                          <span style={{ fontWeight: 800, minWidth: 22, textAlign: 'center', fontSize: 15 }}>{item.qty}</span>
                          <button onClick={() => setCart(p => p.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i))} style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 14, minWidth: 70, textAlign: 'right', color: '#16a34a' }}>{(item.price * item.qty).toFixed(2)} лв.</div>
                      </div>
                    ))}

                    {/* Totals */}
                    <div style={{ padding: '14px 0', fontSize: 14, color: '#4b5563' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Продукти:</span><span>{cartTotal.toFixed(2)} лв.</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span>Доставка:</span>
                        <span style={{ color: shipping === 0 ? '#16a34a' : 'inherit', fontWeight: shipping === 0 ? 700 : 400 }}>{shipping === 0 ? '🎉 Безплатна!' : `${shipping.toFixed(2)} лв.`}</span>
                      </div>
                      {shipping > 0 && (
                        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#92400e', marginBottom: 10 }}>
                          Добави още <strong>{(60 - cartTotal).toFixed(2)} лв.</strong> за безплатна доставка
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 19, color: '#111', borderTop: '2px solid #e5e7eb', paddingTop: 12, marginTop: 4 }}>
                        <span>Общо:</span><span style={{ color: '#16a34a' }}>{(cartTotal + shipping).toFixed(2)} лв.</span>
                      </div>
                    </div>
                  </div>

                  {/* Order form */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>📦 Данни за доставка</div>
                    {([
                      { key: 'name', placeholder: 'Три имена *', type: 'text' },
                      { key: 'phone', placeholder: 'Телефон *', type: 'tel' },
                      { key: 'email', placeholder: 'Имейл (по желание)', type: 'email' },
                      { key: 'address', placeholder: 'Адрес *', type: 'text' },
                      { key: 'city', placeholder: 'Град *', type: 'text' },
                    ] as const).map(field => (
                      <input
                        key={field.key}
                        type={field.type}
                        placeholder={field.placeholder}
                        value={orderForm[field.key]}
                        onChange={e => setOrderForm(f => ({ ...f, [field.key]: e.target.value }))}
                        style={{ padding: '12px 16px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', color: '#111', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
                        onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#16a34a' }}
                        onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb' }}
                      />
                    ))}
                    <textarea
                      placeholder="Бележки (по желание)"
                      value={orderForm.notes}
                      onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      style={{ padding: '12px 16px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit', color: '#111', width: '100%', boxSizing: 'border-box' }}
                    />
                    <select
                      value={orderForm.payment}
                      onChange={e => setOrderForm(f => ({ ...f, payment: e.target.value }))}
                      style={{ padding: '12px 16px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, background: '#fff', color: '#111', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
                    >
                      <option value="cod">💵 Наложен платеж</option>
                      <option value="bank">🏦 Банков превод</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {!orderDone && cart.length > 0 && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', background: '#fafaf8' }}>
                <button
                  onClick={submitOrder}
                  disabled={orderLoading || !orderForm.name || !orderForm.phone || !orderForm.address || !orderForm.city}
                  style={{
                    width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                    background: (!orderForm.name || !orderForm.phone || !orderForm.address || !orderForm.city) ? '#d1d5db' : '#16a34a',
                    color: '#fff', fontWeight: 900, fontSize: 17, cursor: 'pointer',
                    transition: 'all 0.2s', boxShadow: '0 6px 20px rgba(22,163,74,0.3)', fontFamily: 'inherit',
                  }}
                >
                  {orderLoading ? 'Изпращане...' : `✅ Поръчай — ${(cartTotal + shipping).toFixed(2)} лв.`}
                </button>
                <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 10 }}>🔒 Сигурна поръчка · Плащане при доставка</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FLOATING CART BUTTON (mobile) */}
      {cartCount > 0 && !cartVisible && (
        <button onClick={() => setCartVisible(true)} className="float-cart-btn">
          🛒 {cartCount} · {(cartTotal + shipping).toFixed(2)} лв.
        </button>
      )}
    </>
  )
}

const pageCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;0,800;1,600;1,700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { font-family: 'DM Sans', -apple-system, sans-serif; background: #fafaf8; color: #1a1a1a; -webkit-font-smoothing: antialiased; }

  @keyframes fadeDown { from { opacity:0; transform:translateX(24px) } to { opacity:1; transform:translateX(0) } }
  @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
  @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
  @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(0.85)} }
  @keyframes slideRight { from{opacity:0;transform:translateX(-100%)} to{opacity:1;transform:translateX(0)} }

  .urgency-bar { background: linear-gradient(90deg,#dc2626,#b91c1c); padding: 10px 20px; text-align: center; font-size: 13px; color: #fff; font-weight: 600; letter-spacing: .015em; }

  .site-header { position: sticky; top: 0; z-index: 200; background: rgba(255,255,255,0.96); backdrop-filter: blur(16px); border-bottom: 1px solid #e5e7eb; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 64px; box-shadow: 0 1px 8px rgba(0,0,0,.04); transition: all .3s; gap: 16px; }
  .site-header--scrolled { box-shadow: 0 4px 24px rgba(0,0,0,.08); }
  .header-logo { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .logo-name { font-weight: 900; font-size: 16px; font-family: 'Cormorant Garamond', serif; color: #1a1a1a; line-height: 1; }
  .logo-sub { font-size: 10px; color: #16a34a; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .header-nav { display: flex; gap: 2px; align-items: center; }
  .nav-link { color: #374151; text-decoration: none; font-size: 14px; font-weight: 600; padding: 6px 12px; border-radius: 8px; transition: all .2s; white-space: nowrap; }
  .nav-link:hover { color: #16a34a; background: #f0fdf4; }
  .cart-button { background: #f0fdf4; color: #16a34a; border: 2px solid #16a34a; border-radius: 12px; padding: 8px 16px; cursor: pointer; font-weight: 800; font-size: 14px; display: flex; align-items: center; gap: 6px; transition: all .2s; font-family: inherit; white-space: nowrap; flex-shrink: 0; }
  .cart-button--active { background: #16a34a; color: #fff; }
  .cart-button:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(22,163,74,0.25); }
  .mobile-menu-btn { display: none; background: #f4f4f4; border: none; border-radius: 10px; width: 40px; height: 40px; font-size: 20px; cursor: pointer; align-items: center; justify-content: center; flex-shrink: 0; }
  .mobile-nav { position: sticky; top: 64px; z-index: 199; background: #fff; border-bottom: 1px solid #e5e7eb; padding: 12px 24px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); animation: slideRight .25s ease; }
  .mobile-nav-link { color: #374151; text-decoration: none; font-size: 15px; font-weight: 700; padding: 10px 14px; border-radius: 10px; display: block; }
  .mobile-nav-link:hover { background: #f0fdf4; color: #16a34a; }

  .hero-section { background: linear-gradient(145deg,#0c3a1c 0%,#14532d 30%,#166534 65%,#15803d 100%); position: relative; overflow: hidden; }
  .hero-dots { position: absolute; inset: 0; pointer-events: none; opacity: .1; background-image: radial-gradient(circle,rgba(255,255,255,.3) 1px,transparent 1px); background-size: 32px 32px; }
  .hero-blob { position: absolute; border-radius: 50%; pointer-events: none; }
  .hero-blob--tr { top: -140px; right: -140px; width: 520px; height: 520px; background: rgba(134,239,172,.06); }
  .hero-blob--bl { bottom: -80px; left: -100px; width: 360px; height: 360px; background: rgba(255,255,255,.03); }
  .hero-inner { max-width: 1100px; margin: 0 auto; padding: 72px 24px 80px; position: relative; z-index: 1; display: flex; flex-wrap: wrap; gap: 48px; align-items: center; justify-content: space-between; }
  .hero-left { flex: 1 1 400px; max-width: 560px; }
  .hero-right { flex: 0 0 272px; display: flex; flex-direction: column; gap: 16px; align-items: center; }
  .hero-float-anim { animation: float 4.5s ease-in-out infinite; }
  .trust-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,.11); border: 1px solid rgba(255,255,255,.18); border-radius: 30px; padding: 7px 16px; backdrop-filter: blur(12px); margin-bottom: 26px; }
  .trust-badge span { color: rgba(255,255,255,.92); font-size: 13px; font-weight: 600; }
  .live-dot { width: 7px; height: 7px; background: #86efac; border-radius: 50%; animation: pulse-dot 2s ease-in-out infinite; flex-shrink: 0; }
  .hero-title { font-family: 'Cormorant Garamond', serif; font-size: clamp(36px,5.5vw,62px); color: #fff; margin: 0 0 16px; line-height: 1.1; font-weight: 800; }
  .shimmer-text { background: linear-gradient(90deg,#86efac 0%,#fff 40%,#86efac 80%); background-size: 200%; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; animation: shimmer 3.5s ease infinite; }
  .hero-desc { color: rgba(255,255,255,.8); font-size: 17px; line-height: 1.75; margin-bottom: 24px; max-width: 460px; }
  .hero-features { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 32px; }
  .feature-chip { font-size: 13px; color: rgba(255,255,255,.88); background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.14); padding: 7px 14px; border-radius: 24px; display: flex; align-items: center; gap: 6px; backdrop-filter: blur(8px); }
  .lead-box { background: rgba(255,255,255,.08); backdrop-filter: blur(16px); border-radius: 24px; padding: 28px; border: 1px solid rgba(255,255,255,.16); max-width: 420px; }
  .lead-tag { color: #86efac; font-weight: 700; font-size: 11px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: .1em; }
  .lead-title { color: #fff; font-size: 17px; margin: 0 0 18px; font-family: 'Cormorant Garamond', serif; font-weight: 700; line-height: 1.3; }
  .profile-card { background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.18); border-radius: 20px; padding: 22px; text-align: center; backdrop-filter: blur(12px); width: 100%; max-width: 260px; }
  .mini-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; max-width: 260px; }
  .mini-stat { background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.14); border-radius: 14px; padding: 12px 10px; text-align: center; }
  .mini-stat-num { font-size: 19px; font-weight: 900; color: #86efac; font-family: 'Cormorant Garamond', serif; }
  .mini-stat-label { font-size: 10px; color: rgba(255,255,255,.65); font-weight: 600; margin-top: 2px; }

  .trust-strip { background: #fff; border-bottom: 1px solid #f0f0f0; padding: 14px 24px; display: flex; gap: 0; overflow-x: auto; scrollbar-width: none; }
  .trust-strip::-webkit-scrollbar { display: none; }
  .trust-item { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; color: #374151; padding: 0 24px; white-space: nowrap; border-right: 1px solid #e5e7eb; flex-shrink: 0; }
  .trust-item:last-child { border-right: none; }

  .section-wrap { padding: 72px 24px; max-width: 1100px; margin: 0 auto; }
  .section-header { text-align: center; margin-bottom: 44px; }
  .section-tag { font-size: 11px; font-weight: 800; letter-spacing: .1em; color: #16a34a; text-transform: uppercase; }
  .section-title { font-family: 'Cormorant Garamond', serif; font-size: clamp(28px,4vw,44px); margin: 10px 0 10px; font-weight: 800; line-height: 1.15; }
  .section-desc { color: #6b7280; font-size: 15px; max-width: 500px; margin: 0 auto; line-height: 1.6; }

  .categories-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .category-card { display: flex; align-items: center; gap: 14px; background: #fff; border-radius: 18px; padding: 18px 20px; border: 2px solid #e5e7eb; font-weight: 700; font-size: 14px; color: #1a1a1a; box-shadow: 0 2px 12px rgba(0,0,0,.04); text-decoration: none; transition: all .25s cubic-bezier(.4,0,.2,1); }

  .products-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }

  .atlas-section { background: linear-gradient(135deg,#f0fdf4 0%,#dcfce7 50%,#f0fdf4 100%); padding: 80px 24px; position: relative; overflow: hidden; }
  .atlas-blob { position: absolute; top: -80px; right: -60px; width: 320px; height: 320px; border-radius: 50%; background: rgba(22,163,74,.07); pointer-events: none; }
  .atlas-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px; margin-bottom: 44px; }
  .atlas-card { background: #fff; border-radius: 24px; overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,.09); border: 2px solid #d1fae5; display: flex; flex-direction: column; transition: all .3s ease; }
  .add-to-cart-btn { background: #16a34a; color: #fff; border: none; border-radius: 14px; padding: 12px 22px; cursor: pointer; font-weight: 800; font-size: 15px; box-shadow: 0 4px 16px rgba(22,163,74,.3); transition: all .2s; font-family: inherit; white-space: nowrap; }
  .add-to-cart-btn:hover { background: #15803d; transform: translateY(-1px); }
  .cta-link-btn { display: inline-flex; align-items: center; gap: 10px; background: #15803d; color: #fff; padding: 15px 36px; border-radius: 16px; text-decoration: none; font-weight: 800; font-size: 16px; box-shadow: 0 8px 28px rgba(22,163,74,.3); transition: all .25s; }
  .cta-link-btn:hover { background: #14532d; transform: translateY(-2px); }

  .ginegar-section { background: #0f1f14; padding: 80px 24px; position: relative; overflow: hidden; }
  .ginegar-glow { position: absolute; top: 0; right: 0; width: 600px; height: 100%; opacity: .12; pointer-events: none; background: radial-gradient(ellipse at top right,#22c55e,transparent 65%); }
  .ginegar-dots { position: absolute; inset: 0; pointer-events: none; opacity: .07; background-image: radial-gradient(circle,rgba(255,255,255,.25) 1px,transparent 1px); background-size: 36px 36px; }
  .ginegar-inner { display: flex; flex-wrap: wrap; gap: 52px; align-items: center; }
  .ginegar-text { flex: 1 1 380px; }
  .ginegar-img-wrap { flex: 0 0 260px; text-align: center; position: relative; display: inline-flex; flex-direction: column; align-items: center; }
  .ginegar-btn { display: inline-flex; align-items: center; gap: 8px; background: #16a34a; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 14px; font-weight: 800; font-size: 15px; box-shadow: 0 8px 24px rgba(22,163,74,.35); transition: all .25s; }
  .ginegar-btn:hover { background: #15803d; transform: translateY(-2px); }

  .testimonials-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .testimonial-card { background: #f9fafb; border-radius: 20px; padding: 24px; border: 1px solid #e5e7eb; transition: all .25s; display: flex; flex-direction: column; }
  .testimonial-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,.08); transform: translateY(-3px); background: #fff; }

  .cta-section { background: linear-gradient(145deg,#14532d 0%,#15803d 100%); padding: 72px 24px; position: relative; overflow: hidden; }
  .cta-dots { position: absolute; inset: 0; pointer-events: none; opacity: .1; background-image: radial-gradient(circle,rgba(255,255,255,.3) 1px,transparent 1px); background-size: 28px 28px; }

  .site-footer { background: #0f1f14; color: rgba(255,255,255,0.7); padding: 52px 24px 32px; }

  .cart-drawer { position: absolute; right: 0; top: 0; bottom: 0; width: 100%; max-width: 480px; background: #fff; animation: fadeDown 0.3s ease; display: flex; flex-direction: column; box-shadow: -8px 0 48px rgba(0,0,0,0.2); }

  .float-cart-btn { position: fixed; bottom: 24px; right: 24px; z-index: 999; background: linear-gradient(135deg,#16a34a,#15803d); color: #fff; border: none; border-radius: 18px; padding: 14px 22px; font-size: 15px; font-weight: 800; cursor: pointer; box-shadow: 0 8px 28px rgba(22,163,74,0.45); font-family: inherit; transition: all .25s; display: flex; align-items: center; gap: 8px; }
  .float-cart-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 36px rgba(22,163,74,0.5); }

  /* RESPONSIVE */
  @media(max-width:960px) {
    .products-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .testimonials-grid { grid-template-columns: repeat(2, 1fr); }
    .categories-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media(max-width:640px) {
    .products-grid, .atlas-grid, .categories-grid, .testimonials-grid { grid-template-columns: 1fr !important; }
    .hero-right { display: none; }
    .header-nav { display: none; }
    .mobile-menu-btn { display: flex; }
    .hero-inner { padding: 48px 20px 56px; }
    .hero-title { font-size: 38px; }
    .lead-box { max-width: 100%; }
    .section-wrap { padding: 52px 20px; }
    .atlas-section { padding: 60px 20px; }
    .ginegar-section { padding: 60px 20px; }
    .ginegar-img-wrap { flex: 1 1 100%; }
    .trust-strip { padding: 12px 20px; }
    .cart-drawer { max-width: 100%; }
    .float-cart-btn { bottom: 16px; right: 16px; padding: 12px 18px; font-size: 14px; }
    .urgency-bar { font-size: 12px; padding: 8px 16px; }
  }
  @media(max-width:480px) {
    .hero-title { font-size: 32px; }
    .categories-grid { grid-template-columns: 1fr; }
  }
`
