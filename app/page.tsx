'use client'
// app/page.tsx — Главна маркетинг страница v3

import { useState, useEffect } from 'react'

const AFFILIATE_BASE = 'https://agroapteki.com'
const TRACKING = '?tracking=6809eceee15ad'

const affiliateProducts = [
  {
    id: 'kristalon',
    name: 'Кристалон Зелен 18-18-18',
    subtitle: '⭐ Един от най-използваните торове от фермерите',
    description: 'Водоразтворимият NPK тор с микроелементи, който стимулира бърз растеж, силна коренова система и по-голям добив. Осигурява идеално съотношение на азот, фосфор и калий.',
    bullets: ['100% водоразтворим', 'Съдържа микроелементи', 'Подходящ за листно торене и фертигация', 'Увеличава добива и качеството на плодовете'],
    href: `${AFFILIATE_BASE}/torove/npk-npk-torove/kristalon-zelen-specialen-18-18-18-kompleksen-tor/${TRACKING}`,
    emoji: '💎',
    partner: 'agroapteki',
    slug: 'kristalon',
  },
  {
    id: 'kaliteh',
    name: 'Калитех',
    subtitle: '⭐ Предпазва доматите от върхово гниене',
    description: 'Мощен калциев биостимулатор, който доставя лесно усвоим калций и предотвратява върхово гниене при доматите. Помага за по-здрави и по-качествени плодове.',
    bullets: ['Предпазва от върхово гниене', 'Подобрява качеството и цвета на плодовете', 'Увеличава добива и съдържанието на захари', 'Повишава устойчивостта към суша и стрес'],
    href: `${AFFILIATE_BASE}/torove/biostimulatori/kaliteh/${TRACKING}`,
    emoji: '🛡️',
    partner: 'agroapteki',
    slug: 'kaliteh',
  },
  {
    id: 'amalgerol',
    name: 'Амалгерол',
    subtitle: '⭐ Легендарният стимулатор за всяка култура',
    description: '100% природен продукт, съчетаващ силата на алпийски билки и морски водорасли. Действа като щит срещу стреса при градушки, суша или студ.',
    bullets: ['Мощен анти-стрес ефект (слана, суша, хербициди)', 'Ускорява разграждането на растителните остатъци', 'Подобрява приема на азот и структурата на почвата', '100% биоразградим, сертифициран за био земеделие'],
    href: `${AFFILIATE_BASE}/torove/techni-torove/amalgerol-za-uskoryavane-rasteja-na-kulturite/${TRACKING}`,
    emoji: '🌿',
    partner: 'agroapteki',
    slug: 'amalgerol',
  },
]

const ownProducts = [
  {
    slug: 'atlas-terra',
    name: 'Atlas Terra',
    subtitle: 'Органичен подобрител на почвата',
    badge: '⭐ Фундамент за здрава почва',
    price: 28.90,
    compare: 35.00,
    unit: 'кг',
    emoji: '🌱',
    description: 'Вашият инструмент за „съживяване" на земята без агресивно гюбре. Богат на хуминови киселини и органично вещество, трансформира структурата на почвата.',
    bullets: [
      'Възстановява естественото плодородие',
      'Подобрява структурата на тежки и песъчливи почви',
      'Задържа влагата по-дълго при засушаване',
      'Отключва блокираните микроелементи в земята',
      '100% органичен състав — безопасно за почвата',
    ],
  },
  {
    slug: 'atlas-terra-amino',
    name: 'Atlas Terra AMINO',
    subtitle: 'Аминокиселини за експлозивен растеж',
    badge: '⚡ Видими резултати за 48 часа',
    price: 32.90,
    compare: 39.00,
    unit: 'л',
    emoji: '⚡',
    description: '„Бързата храна" за вашите домати, краставици и зеленчуци. Действа моментално при стресови ситуации — жега, студ, след пресаждане.',
    bullets: [
      'Висока концентрация на свободни аминокиселини',
      'Предизвиква бърз и обилен цъфтеж',
      'Мощен анти-стрес ефект (жега, студ, градушка)',
      'Подходящ за листно пръскане и капково поливане',
      'Видими резултати само след 48 часа',
    ],
  },
]

export default function HomePage() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cart, setCart] = useState<{ slug: string; name: string; price: number; qty: number }[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [orderForm, setOrderForm] = useState({
    customer_name: '', customer_phone: '', customer_email: '',
    customer_address: '', customer_city: '', customer_notes: '',
    payment_method: 'cod',
  })
  const [orderDone, setOrderDone] = useState('')
  const [orderLoading, setOrderLoading] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const addToCart = (p: typeof ownProducts[0]) => {
    setCart(prev => {
      const ex = prev.find(c => c.slug === p.slug)
      if (ex) return prev.map(c => c.slug === p.slug ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { slug: p.slug, name: p.name, price: p.price, qty: 1 }]
    })
  }

  const removeFromCart = (slug: string) => setCart(prev => prev.filter(c => c.slug !== slug))
  const changeQty = (slug: string, delta: number) => {
    setCart(prev => prev.map(c => c.slug === slug ? { ...c, qty: Math.max(1, c.qty + delta) } : c))
  }

  const totalQty = cart.reduce((s, c) => s + c.qty, 0)
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0)
  const shipping = subtotal >= 60 ? 0 : 5.99
  const total = subtotal + shipping

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, source: 'naruchnik' }),
      })
      setSubmitted(true)
    } catch { /* silent */ }
    setLoading(false)
  }

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cart.length === 0) return
    setOrderLoading(true)
    try {
      const items = cart.map(c => ({
        product_name: c.name, quantity: c.qty,
        unit_price: c.price, total_price: c.price * c.qty,
      }))
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orderForm, items, subtotal, shipping, total }),
      })
      const data = await res.json()
      if (data.order_number) {
        setOrderDone(data.order_number)
        setCart([])
        setCartOpen(false)
      }
    } catch { /* silent */ }
    setOrderLoading(false)
  }

  const trackAffiliate = (partner: string, slug: string) => {
    fetch('/api/analytics/affiliate-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner, product_slug: slug }),
    }).catch(() => {})
  }

  return (
    <div style={{ fontFamily: "'Sora', system-ui, sans-serif", color: '#111', margin: 0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'Sora', system-ui, sans-serif; }

        .nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 24px; height: 60px;
          transition: background .3s, box-shadow .3s;
        }
        .nav.scrolled {
          background: rgba(15,31,22,.96);
          backdrop-filter: blur(12px);
          box-shadow: 0 1px 20px rgba(0,0,0,.3);
        }
        .nav-logo { color: #fff; font-size: 16px; font-weight: 700; text-decoration: none; letter-spacing: -.02em; display: flex; align-items: center; gap: 8px; }
        .nav-links { display: flex; gap: 4px; }
        .nav-link { color: rgba(255,255,255,.8); text-decoration: none; font-size: 14px; font-weight: 500; padding: 6px 12px; border-radius: 8px; transition: all .2s; }
        .nav-link:hover { color: #fff; background: rgba(255,255,255,.1); }
        .nav-cart {
          background: #40916c; color: #fff; border: none; border-radius: 10px;
          padding: 8px 16px; font-size: 14px; font-weight: 600; cursor: pointer;
          font-family: inherit; display: flex; align-items: center; gap: 6px; transition: background .2s;
        }
        .nav-cart:hover { background: #52b788; }
        .cart-badge {
          background: #4ade80; color: #0f1f16; width: 20px; height: 20px;
          border-radius: 50%; font-size: 11px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        @media (max-width: 640px) { .nav-links { display: none; } }

        .hero {
          background: linear-gradient(150deg, #0f1f16 0%, #1b4332 45%, #2d6a4f 80%, #40916c 100%);
          min-height: 100vh; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 100px 20px 80px; text-align: center; position: relative; overflow: hidden;
        }
        .hero::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 60% 40%, rgba(74,222,128,.08) 0%, transparent 60%),
                      radial-gradient(ellipse at 20% 70%, rgba(45,106,79,.15) 0%, transparent 50%);
          pointer-events: none;
        }
        .hero-tag {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(74,222,128,.15); border: 1px solid rgba(74,222,128,.3);
          color: #4ade80; border-radius: 99px; padding: 6px 16px; font-size: 13px; font-weight: 600;
          margin-bottom: 28px; letter-spacing: .02em;
        }
        .hero-title {
          color: #fff; font-size: clamp(32px, 6vw, 64px);
          font-weight: 800; line-height: 1.1; margin-bottom: 20px;
          letter-spacing: -.03em;
        }
        .hero-title em { color: #4ade80; font-style: normal; }
        .hero-sub {
          color: rgba(255,255,255,.7); font-size: clamp(16px, 2.5vw, 20px);
          line-height: 1.65; margin-bottom: 16px; max-width: 560px;
        }
        .hero-warning {
          color: rgba(255,220,100,.8); font-size: 15px; font-style: italic;
          margin-bottom: 40px; max-width: 480px; line-height: 1.5;
        }
        .btn-primary {
          background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
          color: #0f1f16; padding: 18px 40px; border-radius: 14px;
          text-decoration: none; font-weight: 700; font-size: 18px;
          display: inline-flex; align-items: center; gap: 10px;
          box-shadow: 0 8px 32px rgba(74,222,128,.35);
          transition: all .25s; border: none; cursor: pointer; font-family: inherit;
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(74,222,128,.45); }
        .btn-green {
          background: #2d6a4f; color: #fff; border: none; border-radius: 10px;
          padding: 13px 24px; font-size: 15px; font-weight: 600; cursor: pointer;
          font-family: inherit; transition: all .2s; width: 100%;
        }
        .btn-green:hover { background: #40916c; }
        .hero-scroll {
          position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
          color: rgba(255,255,255,.4); font-size: 13px; display: flex; flex-direction: column;
          align-items: center; gap: 6px; animation: bounce 2s infinite;
        }
        @keyframes bounce { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(6px); } }

        .quick-links { background: #fff; padding: 32px 20px; border-bottom: 1px solid #f0f0f0; }
        .quick-grid { max-width: 900px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
        .quick-link {
          display: flex; align-items: center; gap: 10px;
          background: #f8fafb; border: 1px solid #e5e7eb;
          border-radius: 12px; padding: 14px 18px; text-decoration: none;
          color: #1a2e20; font-weight: 600; font-size: 14px; transition: all .2s;
        }
        .quick-link:hover { background: #f0fdf4; border-color: #86efac; transform: translateY(-1px); }

        .section { padding: 80px 20px; max-width: 960px; margin: 0 auto; }
        .section-title { font-size: clamp(24px,4vw,38px); font-weight: 800; letter-spacing: -.03em; }
        .section-sub { color: #6b7280; font-size: 16px; margin-top: 8px; }

        .lead-section { background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 80px 20px; }
        .lead-card {
          max-width: 500px; margin: 0 auto;
          background: #fff; border-radius: 24px; padding: 40px;
          box-shadow: 0 4px 40px rgba(45,106,79,.12);
          border: 1px solid #bbf7d0;
        }
        .lead-icon { font-size: 52px; text-align: center; margin-bottom: 16px; }
        .lead-title { font-size: 26px; font-weight: 800; text-align: center; letter-spacing: -.02em; margin-bottom: 6px; }
        .lead-desc { color: #6b7280; text-align: center; font-size: 15px; line-height: 1.6; margin-bottom: 28px; }
        .form-field { display: flex; flex-direction: column; gap: 10px; }
        input, textarea, select {
          width: 100%; padding: 13px 16px; border: 1.5px solid #e5e7eb;
          border-radius: 10px; font-family: inherit; font-size: 15px;
          transition: border-color .2s; outline: none; color: #111; background: #fafafa;
        }
        input:focus, textarea:focus, select:focus { border-color: #2d6a4f; background: #fff; }
        .lead-privacy { font-size: 12px; color: #9ca3af; text-align: center; margin-top: 4px; }
        .success-card { background: #f0fdf4; border: 2px solid #86efac; border-radius: 16px; padding: 36px; text-align: center; }

        .products-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin-top: 40px; }
        .product-card {
          background: #fff; border: 1.5px solid #e5e7eb; border-radius: 20px;
          padding: 28px; transition: all .25s; position: relative; overflow: hidden;
        }
        .product-card:hover { box-shadow: 0 8px 40px rgba(45,106,79,.15); border-color: #86efac; transform: translateY(-3px); }
        .product-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #2d6a4f, #40916c); }
        .product-badge { display: inline-flex; align-items: center; gap: 6px; background: #f0fdf4; color: #166534; border-radius: 8px; padding: 4px 10px; font-size: 12px; font-weight: 600; margin-bottom: 14px; }
        .product-name { font-size: 20px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 4px; }
        .product-sub { color: #6b7280; font-size: 14px; margin-bottom: 10px; }
        .product-desc { color: #374151; font-size: 14px; line-height: 1.6; margin-bottom: 14px; }
        .product-bullets { list-style: none; padding: 0; margin-bottom: 20px; display: flex; flex-direction: column; gap: 5px; }
        .product-bullets li { font-size: 13px; color: #374151; display: flex; align-items: flex-start; gap: 8px; }
        .product-bullets li::before { content: '✓'; color: #2d6a4f; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
        .product-price { display: flex; align-items: baseline; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
        .price-main { font-size: 30px; font-weight: 800; color: #1b4332; }
        .price-old { font-size: 16px; color: #9ca3af; text-decoration: line-through; }
        .price-unit { font-size: 13px; color: #9ca3af; }
        .price-save { background: #fef3c7; color: #92400e; border-radius: 6px; padding: 2px 8px; font-size: 12px; font-weight: 700; }

        .cart-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 200; backdrop-filter: blur(4px); }
        .cart-sidebar {
          position: fixed; right: 0; top: 0; bottom: 0; width: 100%; max-width: 440px;
          background: #fff; z-index: 201; overflow-y: auto;
          box-shadow: -8px 0 40px rgba(0,0,0,.2); display: flex; flex-direction: column;
        }
        .cart-head { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid #f0f0f0; position: sticky; top: 0; background: #fff; }
        .cart-head h3 { font-size: 18px; font-weight: 700; }
        .cart-close { background: #f4f4f4; border: none; border-radius: 8px; width: 36px; height: 36px; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; }
        .cart-body { flex: 1; padding: 20px 24px; }
        .cart-item { display: flex; align-items: center; gap: 12px; padding: 14px 0; border-bottom: 1px solid #f5f5f5; }
        .cart-item-name { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
        .cart-item-price { font-size: 13px; color: #6b7280; }
        .qty-control { display: flex; align-items: center; gap: 8px; }
        .qty-btn { background: #f4f4f4; border: none; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; transition: background .2s; }
        .qty-btn:hover { background: #e5e7eb; }
        .qty-num { font-size: 14px; font-weight: 600; min-width: 20px; text-align: center; }
        .cart-remove { background: none; border: none; cursor: pointer; color: #ef4444; font-size: 18px; padding: 4px; }
        .cart-foot { padding: 20px 24px; border-top: 1px solid #f0f0f0; background: #fafafa; }
        .cart-line { display: flex; justify-content: space-between; font-size: 14px; color: #6b7280; margin-bottom: 6px; }
        .cart-total-line { display: flex; justify-content: space-between; font-size: 20px; font-weight: 800; color: #1b4332; padding-top: 10px; border-top: 2px solid #e5e7eb; margin-top: 4px; }

        .order-section { background: #f8fafb; padding: 20px; border-radius: 14px; margin-top: 16px; }
        .order-section h4 { font-size: 15px; font-weight: 700; margin-bottom: 14px; }
        .order-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (max-width: 400px) { .order-grid { grid-template-columns: 1fr; } }

        .aff-section { background: #f8fafb; padding: 80px 20px; }
        .aff-grid { max-width: 960px; margin: 40px auto 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
        .aff-card {
          border: 1.5px solid #e5e7eb; border-radius: 20px; padding: 28px;
          transition: all .25s; position: relative; overflow: hidden;
          text-decoration: none; color: inherit; display: flex; flex-direction: column;
          background: #fff;
        }
        .aff-card:hover { box-shadow: 0 8px 40px rgba(0,0,0,.1); border-color: #2d6a4f; transform: translateY(-3px); }
        .aff-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #1b4332, #40916c); }
        .aff-emoji { font-size: 40px; margin-bottom: 12px; }
        .aff-badge { font-size: 12px; color: #6b7280; font-style: italic; margin-bottom: 8px; }
        .aff-name { font-size: 18px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 8px; }
        .aff-desc { font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 14px; }
        .aff-bullets { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 5px; flex: 1; margin-bottom: 20px; }
        .aff-bullets li { font-size: 13px; color: #374151; display: flex; gap: 8px; }
        .aff-bullets li::before { content: '✔'; color: #2d6a4f; font-weight: 700; flex-shrink: 0; }
        .aff-cta { display: flex; align-items: center; justify-content: center; gap: 8px; background: #1b4332; color: #fff; border-radius: 10px; padding: 12px; font-size: 14px; font-weight: 600; text-decoration: none; transition: background .2s; }
        .aff-cta:hover { background: #2d6a4f; }

        .partner-links { background: #0f1f16; padding: 48px 20px; }
        .partner-title { color: rgba(255,255,255,.5); text-align: center; font-size: 13px; margin-bottom: 20px; letter-spacing: .06em; text-transform: uppercase; }
        .partner-grid { max-width: 800px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
        .partner-link {
          display: flex; align-items: center; gap: 10px;
          background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
          color: rgba(255,255,255,.85); text-decoration: none;
          border-radius: 12px; padding: 14px 18px; font-size: 14px; font-weight: 500; transition: all .2s;
        }
        .partner-link:hover { background: rgba(255,255,255,.1); border-color: rgba(74,222,128,.4); color: #fff; }

        .footer { background: #070f09; color: rgba(255,255,255,.4); padding: 36px 20px; text-align: center; font-size: 14px; }
        .footer a { color: rgba(255,255,255,.2); text-decoration: none; }
        .footer p + p { margin-top: 8px; }

        .combo-cta {
          background: linear-gradient(135deg, #0f1f16, #1b4332); border-radius: 20px; padding: 40px;
          text-align: center; max-width: 700px; margin: 56px auto 0; border: 1px solid rgba(74,222,128,.2);
        }
        .combo-cta h3 { color: #fff; font-size: 22px; font-weight: 800; margin-bottom: 8px; }
        .combo-cta p { color: rgba(255,255,255,.65); font-size: 15px; margin-bottom: 24px; line-height: 1.6; }

        .text-center { text-align: center; }
      `}</style>

      {/* NAVBAR */}
      <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
        <a href="#" className="nav-logo">🍅 Denny Angelow</a>
        <div className="nav-links">
          <a href="#naruchnik" className="nav-link">📗 Наръчник</a>
          <a href="#products" className="nav-link">🛒 Продукти</a>
          <a href="#affiliate" className="nav-link">🌿 Препоръки</a>
        </div>
        {cart.length > 0 && (
          <button className="nav-cart" onClick={() => setCartOpen(true)}>
            🛒 Количка
            <span className="cart-badge">{totalQty}</span>
          </button>
        )}
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-tag">🍅 За градинари и фермери</div>
        <h1 className="hero-title">
          Искаш <em>едри, здрави</em><br />и сочни домати?
        </h1>
        <p className="hero-sub">
          Без болести, без гниене и без загубена реколта.
          С правилната грижа и нужните продукти можеш да отгледаш{' '}
          <strong style={{ color: '#fff' }}>здрави и продуктивни растения</strong>, без излишни усилия.
        </p>
        <p className="hero-warning">
          ⚠️ Не рискувай да изхвърлиш продукцията си,<br />
          само защото нямаш нужната информация навреме.
        </p>
        <a href="#naruchnik" className="btn-primary">
          📗 Изтегли наръчника безплатно
        </a>
        <div className="hero-scroll">
          <span>Виж повече</span>
          <span>↓</span>
        </div>
      </section>

      {/* QUICK LINKS */}
      <div className="quick-links">
        <div className="quick-grid">
          {[
            { href: `${AFFILIATE_BASE}/torove/${TRACKING}`, label: '🌱 Торове и Био Стимулатори', partner: 'agroapteki', slug: 'torove' },
            { href: `${AFFILIATE_BASE}/polivni-sistemi/${TRACKING}`, label: '💧 Поливни Системи', partner: 'agroapteki', slug: 'polivni' },
            { href: `${AFFILIATE_BASE}/preparati/${TRACKING}`, label: '🛡️ Защита от Болести', partner: 'agroapteki', slug: 'preparati' },
            { href: `${AFFILIATE_BASE}/semena/${TRACKING}`, label: '🌾 Качествени Семена', partner: 'agroapteki', slug: 'semena' },
            { href: 'https://oranjeriata.com/products/aksesoari-za-otglejdane-na-rasteniya/netukan-tekstil---agril', label: '🏕️ Найлон за Оранжерия', partner: 'oranjeriata', slug: 'agril' },
          ].map(l => (
            <a key={l.slug} className="quick-link" href={l.href} target="_blank" rel="noreferrer" onClick={() => trackAffiliate(l.partner, l.slug)}>
              {l.label}
            </a>
          ))}
        </div>
      </div>

      {/* LEAD FORM */}
      <section id="naruchnik" className="lead-section">
        <div className="lead-card">
          <div className="lead-icon">📗</div>
          <h2 className="lead-title">Безплатен Наръчник</h2>
          <p className="lead-desc">
            „Тайните на Едрите и Вкусни Домати" — всичко от което се нуждаеш,
            за да защитиш и подхраниш своите растения.
          </p>

          {submitted ? (
            <div className="success-card">
              <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
              <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Изпратен!</h3>
              <p style={{ color: '#6b7280', fontSize: 15 }}>Провери имейла си — наръчникът е на път!</p>
            </div>
          ) : (
            <form onSubmit={handleLeadSubmit} className="form-field">
              <input
                placeholder="Твоето име"
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
              />
              <input
                type="email"
                placeholder="Имейл адрес *"
                required
                value={formData.email}
                onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
              />
              <input
                placeholder="Телефон (по желание)"
                value={formData.phone}
                onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
              />
              <button type="submit" className="btn-primary" style={{ justifyContent: 'center', border: 'none' }} disabled={loading}>
                {loading ? 'Изпращане...' : '📗 Изпрати ми наръчника безплатно'}
              </button>
              <p className="lead-privacy">🔒 Без спам. Само полезно агро съдържание.</p>
            </form>
          )}
        </div>
      </section>

      {/* OWN PRODUCTS */}
      <section id="products" className="section">
        <div className="text-center">
          <h2 className="section-title">Продукти Atlas Terra</h2>
          <p className="section-sub">Директна поръчка с наложен платеж · Безплатна доставка над 60 лв.</p>
        </div>

        <div className="products-grid">
          {ownProducts.map(p => (
            <div key={p.slug} className="product-card">
              <div className="product-badge">{p.badge}</div>
              <div style={{ fontSize: 44, marginBottom: 12 }}>{p.emoji}</div>
              <h3 className="product-name">{p.name}</h3>
              <p className="product-sub">{p.subtitle}</p>
              <p className="product-desc">{p.description}</p>
              <ul className="product-bullets">
                {p.bullets.map(b => <li key={b}>{b}</li>)}
              </ul>
              <div className="product-price">
                <span className="price-main">{p.price.toFixed(2)} лв.</span>
                <span className="price-old">{p.compare.toFixed(2)} лв.</span>
                <span className="price-unit">/ {p.unit}</span>
                <span className="price-save">-{Math.round((1 - p.price / p.compare) * 100)}%</span>
              </div>
              <button className="btn-green" onClick={() => { addToCart(p); setCartOpen(true) }}>
                🛒 Добави в количката
              </button>
            </div>
          ))}
        </div>

        <div className="combo-cta">
          <h3>Комбинирай двата продукта</h3>
          <p>
            Не избирайте между здрава почва и бърз растеж.
            Комбинирайте Atlas Terra и Atlas Terra AMINO за{' '}
            <strong style={{ color: '#4ade80' }}>професионални резултати</strong> още тази седмица!
          </p>
          <a
            href="https://atlasagro.eu/"
            target="_blank"
            rel="noreferrer"
            className="btn-primary"
            style={{ display: 'inline-flex', textDecoration: 'none' }}
            onClick={() => trackAffiliate('atlasagro', 'combo')}
          >
            🛒 КУПИ от Производителя →
          </a>
        </div>
      </section>

      {/* AFFILIATE PRODUCTS */}
      <section id="affiliate" className="aff-section">
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div className="text-center">
            <h2 className="section-title">Препоръчани продукти</h2>
            <p className="section-sub">Проверени продукти от доверени доставчици</p>
          </div>

          <div className="aff-grid">
            {affiliateProducts.map(p => (
              <a
                key={p.id}
                href={p.href}
                target="_blank"
                rel="noreferrer"
                className="aff-card"
                onClick={() => trackAffiliate(p.partner, p.slug)}
              >
                <div className="aff-emoji">{p.emoji}</div>
                <div className="aff-badge">{p.subtitle}</div>
                <h3 className="aff-name">{p.name}</h3>
                <p className="aff-desc">{p.description}</p>
                <ul className="aff-bullets">
                  {p.bullets.map(b => <li key={b}>{b}</li>)}
                </ul>
                <span className="aff-cta">ПРОЧЕТИ ПОВЕЧЕ →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* PARTNER LINKS */}
      <div className="partner-links">
        <p className="partner-title">Нашите партньори</p>
        <div className="partner-grid">
          <a className="partner-link" href={`${AFFILIATE_BASE}/${TRACKING}`} target="_blank" rel="noreferrer" onClick={() => trackAffiliate('agroapteki', 'general')}>
            🌿 AgroApteki.bg →
          </a>
          <a className="partner-link" href="https://oranjeriata.com/products/polietilen-za-oranjerii/izraelski-polietiolen-za-oranjerii/ginegar" target="_blank" rel="noreferrer" onClick={() => trackAffiliate('oranjeriata', 'ginegar')}>
            🏡 Oranjeriata.bg →
          </a>
          <a className="partner-link" href="https://atlasagro.eu/" target="_blank" rel="noreferrer" onClick={() => trackAffiliate('atlasagro', 'main')}>
            🌱 AtlasAgro.eu →
          </a>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <p>© {new Date().getFullYear()} Denny Angelow · dennyangelow.com</p>
        <p><a href="/admin">admin</a></p>
      </footer>

      {/* CART SIDEBAR */}
      {cartOpen && (
        <>
          <div className="cart-overlay" onClick={() => setCartOpen(false)} />
          <div className="cart-sidebar">
            <div className="cart-head">
              <h3>🛒 Количка ({totalQty} бр.)</h3>
              <button className="cart-close" onClick={() => setCartOpen(false)}>✕</button>
            </div>
            <div className="cart-body">
              {cart.length === 0 ? (
                <p style={{ color: '#9ca3af', textAlign: 'center', paddingTop: 40, fontSize: 15 }}>
                  Количката е празна
                </p>
              ) : (
                cart.map(c => (
                  <div key={c.slug} className="cart-item">
                    <div style={{ flex: 1 }}>
                      <div className="cart-item-name">{c.name}</div>
                      <div className="cart-item-price">{c.price.toFixed(2)} лв. / бр.</div>
                    </div>
                    <div className="qty-control">
                      <button className="qty-btn" onClick={() => changeQty(c.slug, -1)}>−</button>
                      <span className="qty-num">{c.qty}</span>
                      <button className="qty-btn" onClick={() => changeQty(c.slug, 1)}>+</button>
                    </div>
                    <span style={{ fontWeight: 700, minWidth: 64, textAlign: 'right', fontSize: 14 }}>
                      {(c.price * c.qty).toFixed(2)} лв.
                    </span>
                    <button className="cart-remove" onClick={() => removeFromCart(c.slug)}>✕</button>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="cart-foot">
                <div className="cart-line"><span>Продукти</span><span>{subtotal.toFixed(2)} лв.</span></div>
                <div className="cart-line"><span>Доставка</span><span>{shipping === 0 ? '🎁 Безплатна' : `${shipping.toFixed(2)} лв.`}</span></div>
                {shipping > 0 && (
                  <div className="cart-line" style={{ color: '#2d6a4f', fontSize: 12 }}>
                    <span>Добави още за безплатна доставка</span>
                    <span>+{(60 - subtotal).toFixed(2)} лв.</span>
                  </div>
                )}
                <div className="cart-total-line"><span>Общо</span><span>{total.toFixed(2)} лв.</span></div>

                {orderDone ? (
                  <div className="success-card" style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                    <h4 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Поръчка {orderDone}</h4>
                    <p style={{ color: '#6b7280', fontSize: 13 }}>Ще се свържем с теб скоро!</p>
                  </div>
                ) : (
                  <form onSubmit={handleOrder} className="order-section">
                    <h4>📦 Данни за доставка</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div className="order-grid">
                        <input placeholder="Имe *" required value={orderForm.customer_name}
                          onChange={e => setOrderForm(p => ({ ...p, customer_name: e.target.value }))} />
                        <input placeholder="Телефон *" required value={orderForm.customer_phone}
                          onChange={e => setOrderForm(p => ({ ...p, customer_phone: e.target.value }))} />
                      </div>
                      <input placeholder="Имейл (по желание)" type="email" value={orderForm.customer_email}
                        onChange={e => setOrderForm(p => ({ ...p, customer_email: e.target.value }))} />
                      <input placeholder="Адрес *" required value={orderForm.customer_address}
                        onChange={e => setOrderForm(p => ({ ...p, customer_address: e.target.value }))} />
                      <input placeholder="Град *" required value={orderForm.customer_city}
                        onChange={e => setOrderForm(p => ({ ...p, customer_city: e.target.value }))} />
                      <textarea placeholder="Бележка (по желание)" rows={2} value={orderForm.customer_notes}
                        onChange={e => setOrderForm(p => ({ ...p, customer_notes: e.target.value }))}
                        style={{ resize: 'vertical' }} />
                      <select value={orderForm.payment_method}
                        onChange={e => setOrderForm(p => ({ ...p, payment_method: e.target.value }))}>
                        <option value="cod">💵 Наложен платеж</option>
                        <option value="bank">🏦 Банков превод</option>
                      </select>
                      <button type="submit" className="btn-primary" style={{ justifyContent: 'center', border: 'none' }} disabled={orderLoading}>
                        {orderLoading ? 'Изпращане...' : `✓ Поръчай за ${total.toFixed(2)} лв.`}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Floating cart button */}
      {cart.length > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 150,
            background: 'linear-gradient(135deg, #2d6a4f, #40916c)',
            color: '#fff', border: 'none', borderRadius: 16,
            padding: '14px 22px', font: "600 16px 'Sora', sans-serif",
            cursor: 'pointer', boxShadow: '0 8px 32px rgba(45,106,79,.5)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          🛒 {totalQty} · {total.toFixed(2)} лв.
        </button>
      )}
    </div>
  )
}
