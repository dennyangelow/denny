'use client'

import { useState, useEffect, useRef } from 'react'

// ============================================================
// AFFILIATE PRODUCTS DATA
// ============================================================
const affiliateProducts = [
  {
    id: 'kristalon',
    name: 'Кристалон Зелен 18-18-18',
    badge: '★ Топ продаван',
    tagline: 'Бърз растеж и по-голям добив',
    desc: 'NPK тор с микроелементи за домати, краставици и зеленчуци. 100% водоразтворим.',
    bullets: ['Увеличава добива', 'Съдържа микроелементи', 'За листно торене'],
    href: 'https://agroapteki.com/torove/npk-npk-torove/kristalon-zelen-specialen-18-18-18-kompleksen-tor/?tracking=6809eceee15ad',
    color: '#2d6a4f',
    emoji: '🌱',
  },
  {
    id: 'kaliteh',
    name: 'Калитех (Calitech)',
    badge: '★ Спира гниенето',
    tagline: 'Калциев биостимулатор',
    desc: 'Предпазва от върхово гниене при домати и пипер. По-твърди и по-качествени плодове.',
    bullets: ['Спира гниенето', 'Подобрява вкуса', 'За капково и листно'],
    href: 'https://agroapteki.com/torove/biostimulatori/kaliteh/?tracking=6809eceee15ad',
    color: '#1b4332',
    emoji: '🛡️',
  },
  {
    id: 'amalgerol',
    name: 'Амалгерол',
    badge: '★ Легендарен',
    tagline: 'Био-щит срещу стрес',
    desc: 'Алпийски билки + морски водорасли. Защита от суша, слана и хербициди.',
    bullets: ['Анти-стрес ефект', '100% биоразградим', 'Естествен прилепител'],
    href: 'https://agroapteki.com/torove/techni-torove/amalgerol-za-uskoryavane-rasteja-na-kulturite/?tracking=6809eceee15ad',
    color: '#40916c',
    emoji: '🌿',
  },
  {
    id: 'sineis',
    name: 'Синейс 480 СК',
    badge: '★ Био-защита',
    tagline: 'Против трипс и молец',
    desc: 'Базиран на спинозад. Само 3 дни карантинен срок. Работи дори при дъжд.',
    bullets: ['Срещу трипс', 'Само 3 дни карантина', 'За чисти храни'],
    href: 'https://agroapteki.com/preparati/insekticidi/sineis-480-sk/?tracking=6809eceee15ad',
    color: '#1d3557',
    emoji: '⚡',
  },
  {
    id: 'ridomil',
    name: 'Ридомил Голд Р ВГ',
    badge: '★ Спира маната',
    tagline: 'Фунгицид за 48 часа',
    desc: 'Прониква само за 30 мин. Спира манята дори след зараза. Не се отмива от дъжда.',
    bullets: ['Лечебно действие', 'Абсорбция 30 мин.', 'Предпазва новия прираст'],
    href: 'https://agroapteki.com/preparati/fungicidi/ridomil-gold/?tracking=6809eceee15ad',
    color: '#457b9d',
    emoji: '💊',
  },
  {
    id: 'turbo-root',
    name: 'Турбо Рут',
    badge: '★ При засаждане',
    tagline: 'Мощно вкореняване',
    desc: 'Стимулира финните корени. Хуминови киселини + желязо. 100% прихващане.',
    bullets: ['Бърз старт', 'Без шок при пресаждане', 'Увеличава приема на хранителни в-ва'],
    href: 'https://agroapteki.com/torove/biostimulatori/turbo-rut/?tracking=6809eceee15ad',
    color: '#6d4c3d',
    emoji: '🌳',
  },
]

const atlasProducts = [
  {
    slug: 'atlas-terra',
    name: 'Atlas Terra',
    subtitle: 'Органичен подобрител на почвата',
    badge: 'ДИРЕКТНА ПОРЪЧКА',
    price: 28.90,
    comparePrice: 35.00,
    unit: 'кг',
    tagline: 'Фундамент за здрава и плодородна почва',
    desc: 'Съживява изтощената земя без агресивно гюбре. Богат на хуминови киселини.',
    bullets: [
      'Възстановява естественото плодородие',
      'Подобрява структурата на тежки почви',
      'Задържа влагата при засушаване',
      'Отключва блокираните микроелементи',
    ],
    emoji: '🌍',
  },
  {
    slug: 'atlas-terra-amino',
    name: 'Atlas Terra AMINO',
    subtitle: 'Висока концентрация аминокиселини',
    badge: 'ДИРЕКТНА ПОРЪЧКА',
    price: 32.90,
    comparePrice: 39.00,
    unit: 'л',
    tagline: 'Енергия за експлозивен растеж',
    desc: 'Действа моментално. Видими резултати само след 48 часа при всякакви условия.',
    bullets: [
      'Бърз и обилен цъфтеж',
      'Мощен анти-стрес ефект',
      'За листно и капково',
      'Резултат след 48 часа',
    ],
    emoji: '⚗️',
  },
]

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================
export default function DennyAngelowPage() {
  const [cart, setCart] = useState<Record<string, number>>({})
  const [showCart, setShowCart] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0)
  const cartTotal = Object.entries(cart).reduce((sum, [slug, qty]) => {
    const p = atlasProducts.find(p => p.slug === slug)
    return sum + (p ? p.price * qty : 0)
  }, 0)

  const updateCart = (slug: string, delta: number) => {
    setCart(prev => {
      const next = { ...prev, [slug]: Math.max(0, (prev[slug] || 0) + delta) }
      if (next[slug] === 0) delete next[slug]
      return next
    })
  }

  const trackAffiliateClick = async (partner: string, productSlug: string) => {
    try {
      await fetch('/api/analytics/affiliate-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partner, product_slug: productSlug }),
      })
    } catch {}
  }

  return (
    <div className="page-root">
      {/* ── NAV ── */}
      <nav className={`nav ${scrollY > 60 ? 'nav--scrolled' : ''}`}>
        <div className="nav-inner">
          <div className="nav-logo">
            <span className="logo-icon">🍅</span>
            <span className="logo-text">Denny Angelow</span>
          </div>
          <div className="nav-actions">
            <button className="btn-ghost" onClick={() => setShowLeadForm(true)}>
              Безплатен Наръчник
            </button>
            {cartCount > 0 && (
              <button className="btn-cart" onClick={() => setShowCart(true)}>
                <span>🛒</span>
                <span className="cart-badge">{cartCount}</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-orb hero-orb--1" />
          <div className="hero-orb hero-orb--2" />
          <div className="hero-grid" />
        </div>
        <div className="hero-content">
          <div className="hero-avatar">
            <img
              src="https://d1yei2z3i6k35z.cloudfront.net/4263526/687aa8144659d_504368576_24540238958894103_5234342802938640767_n.jpg"
              alt="Denny Angelow"
              className="avatar-img"
            />
            <div className="avatar-badge">85K+ последователи</div>
          </div>
          <div className="hero-text">
            <p className="hero-eyebrow">@iammyoungmoney · Агро консултант</p>
            <h1 className="hero-title">
              Едри, здрави и сочни<br />
              <span className="hero-accent">домати без загубена реколта</span>
            </h1>
            <p className="hero-subtitle">
              С правилната грижа и нужните продукти можеш да отгледаш
              здрави растения без излишни усилия. Над <strong>6 000 фермери</strong> вече
              използват моите препоръки.
            </p>
            <div className="hero-cta-group">
              <button className="btn-primary btn-lg" onClick={() => setShowLeadForm(true)}>
                📗 Вземи Безплатния Наръчник
              </button>
              <a href="#atlas-terra" className="btn-secondary btn-lg">
                🛒 Поръчай Atlas Terra
              </a>
            </div>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">85K+</span>
                <span className="stat-label">Последователи</span>
              </div>
              <div className="stat-divider" />
              <div className="stat">
                <span className="stat-num">6 000+</span>
                <span className="stat-label">Наръчника</span>
              </div>
              <div className="stat-divider" />
              <div className="stat">
                <span className="stat-num">100%</span>
                <span className="stat-label">Органични</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM SECTION ── */}
      <section className="problem-section">
        <div className="container">
          <div className="problem-grid">
            {[
              { emoji: '😰', text: 'Доматите гният по върха преди да узреят?' },
              { emoji: '🦠', text: 'Мана и болести унищожават реколтата?' },
              { emoji: '🌵', text: 'Почвата е изтощена и растенията са слаби?' },
              { emoji: '💸', text: 'Пръскаш пари за торове без резултат?' },
            ].map((p, i) => (
              <div key={i} className="problem-card">
                <span className="problem-emoji">{p.emoji}</span>
                <span className="problem-text">{p.text}</span>
              </div>
            ))}
          </div>
          <div className="problem-answer">
            <p>Имам решение за всеки от тези проблеми — проверени продукти, реални резултати.</p>
          </div>
        </div>
      </section>

      {/* ── AFFILIATE PRODUCTS ── */}
      <section className="section affiliate-section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Проверени продукти</span>
            <h2 className="section-title">Торове, защита и биостимулатори</h2>
            <p className="section-sub">Продукти от проверени партньори — кликни за повече информация</p>
          </div>
          <div className="products-grid">
            {affiliateProducts.map(p => (
              <a
                key={p.id}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="product-card affiliate-card"
                onClick={() => trackAffiliateClick('agroapteki', p.id)}
              >
                <div className="product-card-header" style={{ background: p.color }}>
                  <span className="product-emoji">{p.emoji}</span>
                  <span className="product-badge">{p.badge}</span>
                </div>
                <div className="product-card-body">
                  <h3 className="product-name">{p.name}</h3>
                  <p className="product-tagline">{p.tagline}</p>
                  <p className="product-desc">{p.desc}</p>
                  <ul className="product-bullets">
                    {p.bullets.map((b, i) => <li key={i}>✓ {b}</li>)}
                  </ul>
                  <span className="product-cta-link">Прочети повече →</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── ATLAS TERRA — DIRECT ORDER ── */}
      <section className="section atlas-section" id="atlas-terra">
        <div className="container">
          <div className="section-header">
            <span className="section-tag atlas-tag">★ Директна поръчка</span>
            <h2 className="section-title">Atlas Terra — поръчай директно</h2>
            <p className="section-sub">
              Само тези два продукта се поръчват директно. Доставка до 2-3 работни дни.
              Наложен платеж.
            </p>
          </div>

          <div className="atlas-combo-banner">
            💡 Комбинирай двата продукта за професионални резултати!
            <br />
            <small>Atlas Terra (почва) + AMINO (растеж) = пълна защита на градината</small>
          </div>

          <div className="atlas-grid">
            {atlasProducts.map(p => (
              <div key={p.slug} className="atlas-card">
                <div className="atlas-card-badge">{p.badge}</div>
                <div className="atlas-card-icon">{p.emoji}</div>
                <div className="atlas-card-info">
                  <h3 className="atlas-name">{p.name}</h3>
                  <p className="atlas-subtitle">{p.subtitle}</p>
                  <p className="atlas-tagline">{p.tagline}</p>
                  <p className="atlas-desc">{p.desc}</p>
                  <ul className="atlas-bullets">
                    {p.bullets.map((b, i) => <li key={i}>✓ {b}</li>)}
                  </ul>
                  <div className="atlas-pricing">
                    <span className="atlas-price">{p.price.toFixed(2)} лв.</span>
                    <span className="atlas-compare">{p.comparePrice?.toFixed(2)} лв.</span>
                    <span className="atlas-unit">/ {p.unit}</span>
                  </div>
                  <div className="atlas-qty-row">
                    <button
                      className="qty-btn"
                      onClick={() => updateCart(p.slug, -1)}
                      disabled={!cart[p.slug]}
                    >−</button>
                    <span className="qty-display">{cart[p.slug] || 0}</span>
                    <button className="qty-btn" onClick={() => updateCart(p.slug, 1)}>+</button>
                    <button
                      className="btn-add-cart"
                      onClick={() => {
                        if (!cart[p.slug]) updateCart(p.slug, 1)
                        setShowCart(true)
                      }}
                    >
                      🛒 Добави
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {cartCount > 0 && (
            <div className="floating-cart-cta">
              <span>{cartCount} продукт(а) в количката — {cartTotal.toFixed(2)} лв.</span>
              <button className="btn-primary" onClick={() => setShowOrderForm(true)}>
                Поръчай сега →
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── GREENHOUSE SECTION ── */}
      <section className="section greenhouse-section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Партньор — Ginegar Israel</span>
            <h2 className="section-title">Израелски Премиум Найлон за Оранжерии</h2>
            <p className="section-sub">Световен стандарт за здравина, светлина и дълъг живот</p>
          </div>
          <div className="greenhouse-card">
            <div className="greenhouse-content">
              <div className="greenhouse-features">
                {[
                  { icon: '🔬', title: 'Многослойна технология', desc: 'Реално 9-слойно фолио — всеки слой с различна функция' },
                  { icon: '☀️', title: 'По-добра светлина', desc: 'Равномерно осветяване — по-здрави и продуктивни растения' },
                  { icon: '💪', title: 'Издръжливо с години', desc: 'Не се сменя всяка година — реална икономия дългосрочно' },
                  { icon: '🌡️', title: 'Термичен ефект', desc: 'По-добър контрол на температурата и влагата' },
                ].map((f, i) => (
                  <div key={i} className="gh-feature">
                    <span className="gh-icon">{f.icon}</span>
                    <div>
                      <strong>{f.title}</strong>
                      <p>{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <a
                href="https://oranjeriata.com/products/polietilen-za-oranjerii/izraelski-polietiolen-za-oranjerii/ginegar"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary btn-lg"
                onClick={() => trackAffiliateClick('oranjeriata', 'ginegar')}
              >
                Разгледай фолиата на Ginegar →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS / TRUST ── */}
      <section className="section trust-section">
        <div className="container">
          <div className="trust-grid">
            {[
              { num: '85K+', label: 'последователи', sub: 'Facebook, Instagram, TikTok' },
              { num: '6 000+', label: 'наръчника изтеглени', sub: 'реални фермери' },
              { num: '2+', label: 'години опит', sub: 'агро консултации' },
              { num: '100%', label: 'проверени продукти', sub: 'лично тествани' },
            ].map((t, i) => (
              <div key={i} className="trust-card">
                <span className="trust-num">{t.num}</span>
                <span className="trust-label">{t.label}</span>
                <span className="trust-sub">{t.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LEAD MAGNET SECTION ── */}
      <section className="section lead-section">
        <div className="container">
          <div className="lead-box">
            <div className="lead-text">
              <h2>📗 Вземи безплатния наръчник</h2>
              <p>"Тайните на Едрите и Вкусни Домати"</p>
              <ul>
                <li>✓ Как да предпазиш от болести и вредители</li>
                <li>✓ Кои торове работят наистина</li>
                <li>✓ Календар за третиране</li>
                <li>✓ Грешките, които убиват реколтата</li>
              </ul>
            </div>
            <div className="lead-form-area">
              {leadSubmitted ? (
                <div className="lead-success">
                  <span className="success-icon">✅</span>
                  <strong>Провери имейла си!</strong>
                  <p>Изпратихме наръчника на посочения адрес.</p>
                </div>
              ) : (
                <LeadForm onSuccess={() => setLeadSubmitted(true)} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <span className="logo-icon">🍅</span>
              <span className="logo-text">Denny Angelow</span>
              <p>Агро консултант и афилиейт маркетинг.</p>
              <p>support@dennyangelow.com</p>
            </div>
            <div className="footer-links">
              <strong>Продукти</strong>
              <a href="#atlas-terra">Atlas Terra</a>
              <a href="#atlas-terra">Atlas Terra AMINO</a>
              <a href="https://agroapteki.com/?tracking=6809eceee15ad" target="_blank" rel="noopener noreferrer">AgroApteki</a>
            </div>
            <div className="footer-links">
              <strong>Информация</strong>
              <a href="/naruchnik-super-domati">Безплатен Наръчник</a>
              <a href="/politika-poveritelnost">Политика за поверителност</a>
              <a href="/usloviya">Условия за ползване</a>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2025-2026 Denny Angelow · Всички права запазени</p>
          </div>
        </div>
      </footer>

      {/* ── MODALS ── */}
      {showLeadForm && (
        <Modal onClose={() => setShowLeadForm(false)}>
          <div className="modal-lead">
            <h2>📗 Безплатен Наръчник</h2>
            <p>"Тайните на Едрите и Вкусни Домати"</p>
            {leadSubmitted ? (
              <div className="lead-success">
                <span>✅</span>
                <strong>Провери имейла си!</strong>
              </div>
            ) : (
              <LeadForm onSuccess={() => { setLeadSubmitted(true); setTimeout(() => setShowLeadForm(false), 2000) }} />
            )}
          </div>
        </Modal>
      )}

      {showCart && (
        <Modal onClose={() => setShowCart(false)}>
          <CartView
            cart={cart}
            products={atlasProducts}
            cartTotal={cartTotal}
            updateCart={updateCart}
            onCheckout={() => { setShowCart(false); setShowOrderForm(true) }}
          />
        </Modal>
      )}

      {showOrderForm && (
        <Modal onClose={() => setShowOrderForm(false)}>
          <OrderForm
            cart={cart}
            products={atlasProducts}
            cartTotal={cartTotal}
            onSuccess={() => { setShowOrderForm(false); setCart({}) }}
          />
        </Modal>
      )}

      <style>{pageStyles}</style>
    </div>
  )
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function LeadForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      const params = new URLSearchParams(window.location.search)
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          source: 'naruchnik',
          utm_source: params.get('utm_source'),
          utm_campaign: params.get('utm_campaign'),
        }),
      })
      onSuccess()
    } catch {}
    setLoading(false)
  }

  return (
    <form className="lead-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Твоето име (по желание)"
        value={name}
        onChange={e => setName(e.target.value)}
        className="form-input"
      />
      <input
        type="email"
        placeholder="Твоят имейл адрес *"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        className="form-input"
      />
      <button type="submit" className="btn-primary btn-lg w-full" disabled={loading}>
        {loading ? 'Изпращане...' : '📗 Изпрати ми Наръчника БЕЗПЛАТНО'}
      </button>
      <p className="form-note">Без спам. Само полезна информация. Можеш да се отпишеш по всяко време.</p>
    </form>
  )
}

function CartView({ cart, products, cartTotal, updateCart, onCheckout }: any) {
  const shipping = cartTotal >= 60 ? 0 : 5.99
  return (
    <div className="cart-view">
      <h2>🛒 Твоята количка</h2>
      {Object.keys(cart).length === 0 ? (
        <p className="cart-empty">Количката е празна</p>
      ) : (
        <>
          {Object.entries(cart).map(([slug, qty]: any) => {
            const p = products.find((p: any) => p.slug === slug)
            if (!p) return null
            return (
              <div key={slug} className="cart-item">
                <div className="cart-item-info">
                  <strong>{p.name}</strong>
                  <span>{p.price.toFixed(2)} лв. / {p.unit}</span>
                </div>
                <div className="cart-item-qty">
                  <button className="qty-btn" onClick={() => updateCart(slug, -1)}>−</button>
                  <span>{qty}</span>
                  <button className="qty-btn" onClick={() => updateCart(slug, 1)}>+</button>
                </div>
                <span className="cart-item-total">{(p.price * qty).toFixed(2)} лв.</span>
              </div>
            )
          })}
          <div className="cart-summary">
            <div className="cart-row">
              <span>Продукти:</span>
              <span>{cartTotal.toFixed(2)} лв.</span>
            </div>
            <div className="cart-row">
              <span>Доставка:</span>
              <span>{shipping === 0 ? '🎉 БЕЗПЛАТНА' : `${shipping.toFixed(2)} лв.`}</span>
            </div>
            {shipping > 0 && (
              <div className="cart-free-ship">
                Добави {(60 - cartTotal).toFixed(2)} лв. за безплатна доставка
              </div>
            )}
            <div className="cart-row cart-total">
              <strong>Общо:</strong>
              <strong>{(cartTotal + shipping).toFixed(2)} лв.</strong>
            </div>
          </div>
          <button className="btn-primary btn-lg w-full" onClick={onCheckout}>
            Продължи към поръчката →
          </button>
        </>
      )}
    </div>
  )
}

function OrderForm({ cart, products, cartTotal, onSuccess }: any) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    customer_city: '',
    customer_notes: '',
    payment_method: 'cod',
  })

  const shipping = cartTotal >= 60 ? 0 : 5.99
  const total = cartTotal + shipping

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const params = new URLSearchParams(window.location.search)
      const items = Object.entries(cart).map(([slug, qty]: any) => {
        const p = products.find((p: any) => p.slug === slug)
        return { product_slug: slug, product_name: p.name, quantity: qty, unit_price: p.price, total_price: p.price * qty }
      })
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          items,
          subtotal: cartTotal,
          shipping,
          total,
          utm_source: params.get('utm_source'),
          utm_campaign: params.get('utm_campaign'),
        }),
      })
      const data = await res.json()
      if (data.order_number) {
        setOrderNumber(data.order_number)
        setSuccess(true)
        setTimeout(onSuccess, 4000)
      }
    } catch {}
    setLoading(false)
  }

  if (success) {
    return (
      <div className="order-success">
        <div className="success-icon-large">✅</div>
        <h2>Поръчката е получена!</h2>
        <p className="order-num">Номер: <strong>{orderNumber}</strong></p>
        <p>Ще се свържем с теб до 24 часа за потвърждение.</p>
        <p>Доставка: 2-3 работни дни · Наложен платеж</p>
      </div>
    )
  }

  return (
    <form className="order-form" onSubmit={handleSubmit}>
      <h2>📋 Детайли за доставка</h2>

      <div className="order-summary-mini">
        {Object.entries(cart).map(([slug, qty]: any) => {
          const p = products.find((p: any) => p.slug === slug)
          return p ? <div key={slug} className="order-mini-row"><span>{p.name} × {qty}</span><span>{(p.price * qty).toFixed(2)} лв.</span></div> : null
        })}
        <div className="order-mini-row order-mini-total">
          <strong>Общо с доставка:</strong>
          <strong>{total.toFixed(2)} лв.</strong>
        </div>
      </div>

      <div className="form-grid-2">
        <div className="form-field">
          <label>Три имена *</label>
          <input className="form-input" value={form.customer_name} onChange={e => set('customer_name', e.target.value)} required placeholder="Иван Петров" />
        </div>
        <div className="form-field">
          <label>Телефон *</label>
          <input className="form-input" value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} required placeholder="08X XXX XXXX" />
        </div>
      </div>
      <div className="form-field">
        <label>Имейл (по желание)</label>
        <input className="form-input" type="email" value={form.customer_email} onChange={e => set('customer_email', e.target.value)} placeholder="за потвърждение" />
      </div>
      <div className="form-field">
        <label>Адрес за доставка *</label>
        <input className="form-input" value={form.customer_address} onChange={e => set('customer_address', e.target.value)} required placeholder="ул. Примерна 1" />
      </div>
      <div className="form-field">
        <label>Град *</label>
        <input className="form-input" value={form.customer_city} onChange={e => set('customer_city', e.target.value)} required placeholder="София" />
      </div>
      <div className="form-field">
        <label>Начин на плащане</label>
        <select className="form-input" value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
          <option value="cod">💵 Наложен платеж (препоръчано)</option>
          <option value="bank">🏦 Банков превод</option>
        </select>
      </div>
      <div className="form-field">
        <label>Бележка (по желание)</label>
        <textarea className="form-input" value={form.customer_notes} onChange={e => set('customer_notes', e.target.value)} placeholder="Удобно за доставка..." rows={2} />
      </div>

      <button type="submit" className="btn-primary btn-lg w-full" disabled={loading}>
        {loading ? 'Изпращане...' : `✅ Потвърди поръчката — ${total.toFixed(2)} лв.`}
      </button>
      <p className="form-note">Ще се свържем с теб в рамките на 24 часа. Доставка 2-3 работни дни.</p>
    </form>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = '' }
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-scroll">{children}</div>
      </div>
    </div>
  )
}

// ============================================================
// STYLES
// ============================================================
const pageStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,700;1,300&family=DM+Sans:wght@300;400;500;600&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --green-deep: #1a3d2b;
    --green-mid: #2d6a4f;
    --green-bright: #40916c;
    --green-light: #d8f3dc;
    --amber: #f4a261;
    --amber-dark: #e76f51;
    --gold: #e9c46a;
    --cream: #fefae0;
    --dark: #1a1a1a;
    --text-muted: #6b7280;
    --border: rgba(0,0,0,0.08);
    --radius: 12px;
    --shadow: 0 4px 24px rgba(0,0,0,0.08);
    --font-display: 'Fraunces', Georgia, serif;
    --font-body: 'DM Sans', system-ui, sans-serif;
  }

  .page-root { font-family: var(--font-body); color: var(--dark); background: #fff; }

  /* NAV */
  .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 16px 0; transition: all .3s; }
  .nav--scrolled { background: rgba(255,255,255,0.95); backdrop-filter: blur(12px); box-shadow: 0 1px 24px rgba(0,0,0,0.08); padding: 12px 0; }
  .nav-inner { max-width: 1100px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; }
  .nav-logo { display: flex; align-items: center; gap: 10px; }
  .logo-icon { font-size: 24px; }
  .logo-text { font-family: var(--font-display); font-size: 20px; font-weight: 700; color: var(--green-deep); }
  .nav-actions { display: flex; align-items: center; gap: 12px; }
  .btn-ghost { background: none; border: 1.5px solid var(--green-mid); color: var(--green-mid); padding: 8px 18px; border-radius: 8px; cursor: pointer; font-family: var(--font-body); font-size: 14px; font-weight: 500; transition: all .2s; }
  .btn-ghost:hover { background: var(--green-mid); color: #fff; }
  .btn-cart { position: relative; background: var(--green-mid); color: #fff; border: none; border-radius: 8px; padding: 8px 14px; cursor: pointer; font-size: 18px; }
  .cart-badge { position: absolute; top: -6px; right: -6px; background: var(--amber-dark); color: #fff; border-radius: 50%; width: 20px; height: 20px; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }

  /* HERO */
  .hero { min-height: 100vh; display: flex; align-items: center; padding: 100px 24px 60px; position: relative; overflow: hidden; background: linear-gradient(160deg, #f0fdf4 0%, #fff 50%, #fffbf0 100%); }
  .hero-bg { position: absolute; inset: 0; pointer-events: none; }
  .hero-orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: .4; }
  .hero-orb--1 { width: 600px; height: 600px; background: var(--green-light); top: -100px; right: -100px; }
  .hero-orb--2 { width: 400px; height: 400px; background: var(--gold); bottom: -100px; left: -100px; opacity: .2; }
  .hero-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(45,106,79,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(45,106,79,0.04) 1px, transparent 1px); background-size: 48px 48px; }
  .hero-content { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: auto 1fr; gap: 60px; align-items: center; position: relative; }
  .hero-avatar { display: flex; flex-direction: column; align-items: center; gap: 16px; }
  .avatar-img { width: 200px; height: 200px; border-radius: 50%; object-fit: cover; border: 4px solid var(--green-bright); box-shadow: 0 8px 40px rgba(45,106,79,.2); }
  .avatar-badge { background: var(--green-mid); color: #fff; padding: 6px 16px; border-radius: 99px; font-size: 13px; font-weight: 500; white-space: nowrap; }
  .hero-eyebrow { color: var(--green-bright); font-size: 14px; font-weight: 500; letter-spacing: .05em; text-transform: uppercase; margin-bottom: 12px; }
  .hero-title { font-family: var(--font-display); font-size: clamp(36px, 5vw, 58px); font-weight: 700; line-height: 1.1; color: var(--green-deep); margin-bottom: 20px; }
  .hero-accent { color: var(--amber-dark); font-style: italic; }
  .hero-subtitle { font-size: 18px; color: #374151; line-height: 1.6; margin-bottom: 32px; max-width: 560px; }
  .hero-cta-group { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 40px; }
  .hero-stats { display: flex; align-items: center; gap: 24px; }
  .stat { display: flex; flex-direction: column; }
  .stat-num { font-family: var(--font-display); font-size: 28px; font-weight: 700; color: var(--green-deep); }
  .stat-label { font-size: 13px; color: var(--text-muted); }
  .stat-divider { width: 1px; height: 40px; background: var(--border); }

  /* BUTTONS */
  .btn-primary { background: var(--green-mid); color: #fff; border: none; border-radius: 10px; padding: 14px 28px; font-family: var(--font-body); font-size: 16px; font-weight: 600; cursor: pointer; transition: all .2s; }
  .btn-primary:hover { background: var(--green-deep); transform: translateY(-1px); }
  .btn-primary:disabled { opacity: .6; cursor: not-allowed; transform: none; }
  .btn-secondary { background: #fff; color: var(--green-deep); border: 2px solid var(--green-mid); border-radius: 10px; padding: 12px 26px; font-family: var(--font-body); font-size: 16px; font-weight: 600; cursor: pointer; transition: all .2s; text-decoration: none; display: inline-block; }
  .btn-secondary:hover { background: var(--green-light); }
  .btn-lg { padding: 16px 32px; font-size: 17px; }
  .w-full { width: 100%; }

  /* CONTAINER */
  .container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
  .section { padding: 80px 0; }
  .section-header { text-align: center; margin-bottom: 48px; }
  .section-tag { background: var(--green-light); color: var(--green-deep); padding: 6px 16px; border-radius: 99px; font-size: 13px; font-weight: 600; display: inline-block; margin-bottom: 16px; }
  .atlas-tag { background: #fef3c7; color: #92400e; }
  .section-title { font-family: var(--font-display); font-size: clamp(28px, 4vw, 42px); font-weight: 700; color: var(--green-deep); margin-bottom: 16px; }
  .section-sub { font-size: 17px; color: var(--text-muted); max-width: 600px; margin: 0 auto; }

  /* PROBLEM */
  .problem-section { background: var(--green-deep); padding: 60px 24px; }
  .problem-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .problem-card { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); border-radius: var(--radius); padding: 20px; display: flex; align-items: center; gap: 14px; }
  .problem-emoji { font-size: 28px; flex-shrink: 0; }
  .problem-text { color: rgba(255,255,255,.9); font-size: 15px; line-height: 1.4; }
  .problem-answer { text-align: center; }
  .problem-answer p { color: rgba(255,255,255,.7); font-size: 17px; }

  /* AFFILIATE PRODUCTS */
  .affiliate-section { background: #f9fafb; }
  .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
  .product-card { border-radius: 16px; overflow: hidden; border: 1px solid var(--border); background: #fff; text-decoration: none; color: inherit; transition: all .2s; display: flex; flex-direction: column; }
  .product-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,0.1); }
  .product-card-header { padding: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
  .product-emoji { font-size: 40px; }
  .product-badge { background: rgba(255,255,255,.2); color: #fff; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 600; border: 1px solid rgba(255,255,255,.3); }
  .product-card-body { padding: 20px; flex: 1; display: flex; flex-direction: column; }
  .product-name { font-family: var(--font-display); font-size: 20px; font-weight: 700; color: var(--green-deep); margin-bottom: 6px; }
  .product-tagline { font-size: 13px; font-weight: 600; color: var(--green-bright); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 10px; }
  .product-desc { font-size: 14px; color: #6b7280; line-height: 1.5; margin-bottom: 14px; }
  .product-bullets { list-style: none; margin-bottom: 16px; }
  .product-bullets li { font-size: 14px; color: var(--green-deep); padding: 4px 0; }
  .product-cta-link { color: var(--green-mid); font-weight: 600; font-size: 15px; margin-top: auto; }

  /* ATLAS TERRA */
  .atlas-section { background: linear-gradient(160deg, #fffbf0 0%, #fff 100%); }
  .atlas-combo-banner { background: linear-gradient(135deg, var(--green-mid), var(--green-bright)); color: #fff; text-align: center; padding: 20px 28px; border-radius: 14px; margin-bottom: 40px; font-size: 16px; line-height: 1.7; }
  .atlas-combo-banner small { opacity: .85; font-size: 14px; }
  .atlas-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 28px; }
  .atlas-card { background: #fff; border: 2px solid var(--gold); border-radius: 20px; padding: 32px; position: relative; box-shadow: 0 8px 32px rgba(233, 196, 106, .15); }
  .atlas-card-badge { position: absolute; top: 20px; right: 20px; background: var(--amber); color: #7c3a00; padding: 6px 14px; border-radius: 99px; font-size: 12px; font-weight: 700; }
  .atlas-card-icon { font-size: 48px; margin-bottom: 20px; }
  .atlas-name { font-family: var(--font-display); font-size: 26px; font-weight: 700; color: var(--green-deep); margin-bottom: 6px; }
  .atlas-subtitle { font-size: 14px; color: var(--green-bright); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 10px; }
  .atlas-tagline { font-size: 13px; color: var(--text-muted); font-style: italic; margin-bottom: 14px; }
  .atlas-desc { font-size: 15px; color: #374151; line-height: 1.6; margin-bottom: 16px; }
  .atlas-bullets { list-style: none; margin-bottom: 24px; }
  .atlas-bullets li { font-size: 15px; color: var(--green-deep); padding: 5px 0; font-weight: 500; }
  .atlas-pricing { display: flex; align-items: baseline; gap: 10px; margin-bottom: 20px; }
  .atlas-price { font-family: var(--font-display); font-size: 32px; font-weight: 700; color: var(--green-deep); }
  .atlas-compare { font-size: 18px; color: #9ca3af; text-decoration: line-through; }
  .atlas-unit { font-size: 15px; color: var(--text-muted); }
  .atlas-qty-row { display: flex; align-items: center; gap: 12px; }
  .qty-btn { width: 36px; height: 36px; border: 2px solid var(--green-mid); background: #fff; color: var(--green-mid); border-radius: 8px; font-size: 20px; cursor: pointer; transition: all .2s; display: flex; align-items: center; justify-content: center; }
  .qty-btn:hover:not(:disabled) { background: var(--green-mid); color: #fff; }
  .qty-btn:disabled { opacity: .3; cursor: default; }
  .qty-display { font-size: 20px; font-weight: 700; min-width: 32px; text-align: center; }
  .btn-add-cart { flex: 1; background: var(--green-mid); color: #fff; border: none; border-radius: 10px; padding: 10px 20px; font-family: var(--font-body); font-size: 15px; font-weight: 600; cursor: pointer; transition: all .2s; }
  .btn-add-cart:hover { background: var(--green-deep); }

  .floating-cart-cta { position: sticky; bottom: 24px; background: var(--green-deep); color: #fff; border-radius: 16px; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 32px; box-shadow: 0 8px 32px rgba(26,61,43,.3); }

  /* GREENHOUSE */
  .greenhouse-section { background: var(--green-deep); }
  .greenhouse-section .section-tag { background: rgba(255,255,255,.1); color: rgba(255,255,255,.8); }
  .greenhouse-section .section-title { color: #fff; }
  .greenhouse-section .section-sub { color: rgba(255,255,255,.6); }
  .greenhouse-card { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: 20px; padding: 40px; }
  .greenhouse-features { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px; margin-bottom: 32px; }
  .gh-feature { display: flex; gap: 16px; }
  .gh-icon { font-size: 28px; flex-shrink: 0; }
  .gh-feature strong { display: block; color: #fff; font-size: 15px; margin-bottom: 6px; }
  .gh-feature p { color: rgba(255,255,255,.6); font-size: 14px; line-height: 1.5; }

  /* TRUST */
  .trust-section { background: var(--cream); }
  .trust-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; }
  .trust-card { text-align: center; padding: 32px 20px; background: #fff; border-radius: 16px; border: 1px solid var(--border); }
  .trust-num { display: block; font-family: var(--font-display); font-size: 44px; font-weight: 700; color: var(--green-mid); margin-bottom: 8px; }
  .trust-label { display: block; font-size: 16px; font-weight: 600; color: var(--green-deep); margin-bottom: 6px; }
  .trust-sub { display: block; font-size: 13px; color: var(--text-muted); }

  /* LEAD SECTION */
  .lead-section { background: linear-gradient(135deg, var(--green-deep) 0%, var(--green-mid) 100%); }
  .lead-box { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; }
  .lead-text h2 { font-family: var(--font-display); font-size: 32px; color: #fff; margin-bottom: 12px; }
  .lead-text p { color: rgba(255,255,255,.7); font-size: 16px; margin-bottom: 20px; font-style: italic; }
  .lead-text ul { list-style: none; }
  .lead-text li { color: rgba(255,255,255,.85); padding: 6px 0; font-size: 15px; }
  .lead-form { display: flex; flex-direction: column; gap: 14px; }
  .form-input { width: 100%; padding: 14px 16px; border: 1.5px solid rgba(255,255,255,.2); border-radius: 10px; background: rgba(255,255,255,.1); color: #fff; font-family: var(--font-body); font-size: 15px; transition: border-color .2s; }
  .form-input::placeholder { color: rgba(255,255,255,.5); }
  .form-input:focus { outline: none; border-color: rgba(255,255,255,.5); background: rgba(255,255,255,.15); }
  select.form-input option { background: var(--green-deep); color: #fff; }
  textarea.form-input { resize: vertical; }
  .form-note { font-size: 12px; color: rgba(255,255,255,.5); text-align: center; }
  .lead-success { text-align: center; padding: 40px; }
  .lead-success span { font-size: 48px; display: block; margin-bottom: 16px; }
  .lead-success strong { display: block; font-size: 20px; color: #fff; margin-bottom: 8px; }
  .lead-success p { color: rgba(255,255,255,.7); }

  /* MODAL */
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.5); backdrop-filter: blur(6px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .modal-box { background: #fff; border-radius: 20px; max-width: 600px; width: 100%; max-height: 90vh; position: relative; }
  .modal-scroll { overflow-y: auto; max-height: 90vh; padding: 40px; border-radius: 20px; }
  .modal-close { position: absolute; top: 16px; right: 16px; background: #f3f4f6; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; z-index: 1; }
  .modal-lead h2 { font-family: var(--font-display); font-size: 28px; color: var(--green-deep); margin-bottom: 8px; }
  .modal-lead p { color: var(--text-muted); margin-bottom: 24px; font-style: italic; }
  .modal-lead .form-input { border-color: var(--border); background: #f9fafb; color: var(--dark); }
  .modal-lead .form-input::placeholder { color: #9ca3af; }
  .modal-lead .form-input:focus { border-color: var(--green-mid); background: #fff; }

  /* CART */
  .cart-view h2 { font-family: var(--font-display); font-size: 24px; color: var(--green-deep); margin-bottom: 24px; }
  .cart-empty { color: var(--text-muted); text-align: center; padding: 32px 0; }
  .cart-item { display: flex; align-items: center; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--border); }
  .cart-item-info { flex: 1; }
  .cart-item-info strong { display: block; font-size: 15px; color: var(--dark); }
  .cart-item-info span { font-size: 13px; color: var(--text-muted); }
  .cart-item-qty { display: flex; align-items: center; gap: 10px; }
  .cart-item-total { font-weight: 700; font-size: 16px; min-width: 70px; text-align: right; }
  .cart-summary { margin: 20px 0; }
  .cart-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 15px; }
  .cart-total { border-top: 2px solid var(--border); padding-top: 12px; font-size: 18px; }
  .cart-free-ship { text-align: center; font-size: 13px; color: var(--green-bright); background: var(--green-light); border-radius: 8px; padding: 8px 16px; margin: 8px 0; }

  /* ORDER FORM */
  .order-form h2 { font-family: var(--font-display); font-size: 24px; color: var(--green-deep); margin-bottom: 20px; }
  .order-summary-mini { background: #f9fafb; border-radius: 10px; padding: 16px; margin-bottom: 24px; }
  .order-mini-row { display: flex; justify-content: space-between; font-size: 14px; padding: 4px 0; }
  .order-mini-total { border-top: 1px solid var(--border); padding-top: 8px; margin-top: 8px; font-size: 16px; }
  .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .form-field { margin-bottom: 16px; }
  .form-field label { display: block; font-size: 13px; font-weight: 600; color: var(--green-deep); margin-bottom: 6px; }
  .order-form .form-input { border-color: var(--border); background: #f9fafb; color: var(--dark); }
  .order-form .form-input::placeholder { color: #9ca3af; }
  .order-form .form-input:focus { outline: none; border-color: var(--green-mid); background: #fff; }

  .order-success { text-align: center; padding: 48px 32px; }
  .success-icon-large { font-size: 64px; display: block; margin-bottom: 24px; }
  .order-success h2 { font-family: var(--font-display); font-size: 28px; color: var(--green-deep); margin-bottom: 16px; }
  .order-num { font-size: 18px; margin-bottom: 16px; }
  .order-success p { color: var(--text-muted); margin: 8px 0; }

  /* FOOTER */
  .footer { background: var(--green-deep); padding: 60px 24px 32px; }
  .footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 48px; margin-bottom: 48px; }
  .footer-brand .logo-text { color: #fff; font-size: 22px; display: block; margin-bottom: 16px; }
  .footer-brand p { color: rgba(255,255,255,.5); font-size: 14px; margin: 6px 0; }
  .footer-links { display: flex; flex-direction: column; gap: 10px; }
  .footer-links strong { color: rgba(255,255,255,.5); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 4px; }
  .footer-links a { color: rgba(255,255,255,.7); text-decoration: none; font-size: 14px; transition: color .2s; }
  .footer-links a:hover { color: #fff; }
  .footer-bottom { border-top: 1px solid rgba(255,255,255,.1); padding-top: 24px; text-align: center; }
  .footer-bottom p { color: rgba(255,255,255,.4); font-size: 13px; }

  /* RESPONSIVE */
  @media (max-width: 768px) {
    .hero-content { grid-template-columns: 1fr; text-align: center; }
    .hero-avatar { margin-bottom: 24px; }
    .hero-cta-group { justify-content: center; }
    .hero-stats { justify-content: center; }
    .lead-box { grid-template-columns: 1fr; }
    .footer-grid { grid-template-columns: 1fr; gap: 32px; }
    .atlas-grid { grid-template-columns: 1fr; }
    .form-grid-2 { grid-template-columns: 1fr; }
    .floating-cart-cta { flex-direction: column; text-align: center; }
  }
`
