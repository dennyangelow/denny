'use client'
// app/page.tsx — Главна маркетинг страница

import { useState } from 'react'

export default function HomePage() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cart, setCart] = useState<{ slug: string; name: string; price: number; qty: number }[]>([])
  const [orderForm, setOrderForm] = useState({
    customer_name: '', customer_phone: '', customer_email: '',
    customer_address: '', customer_city: '', customer_notes: '',
    payment_method: 'cod',
  })
  const [orderDone, setOrderDone] = useState('')
  const [orderLoading, setOrderLoading] = useState(false)

  const products = [
    {
      slug: 'atlas-terra',
      name: 'Atlas Terra',
      subtitle: 'Органичен подобрител на почвата',
      price: 28.90,
      compare: 35.00,
      unit: 'кг',
      emoji: '🌱',
      bullets: ['Хуминови киселини', 'Задържа влага', 'За изтощени почви'],
    },
    {
      slug: 'atlas-terra-amino',
      name: 'Atlas Terra AMINO',
      subtitle: 'Аминокиселини за експлозивен растеж',
      price: 32.90,
      compare: 39.00,
      unit: 'л',
      emoji: '⚡',
      bullets: ['Свободни аминокиселини', 'Действа за 48 часа', 'При стрес от жега/студ'],
    },
  ]

  const addToCart = (p: typeof products[0]) => {
    setCart(prev => {
      const ex = prev.find(c => c.slug === p.slug)
      if (ex) return prev.map(c => c.slug === p.slug ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { slug: p.slug, name: p.name, price: p.price, qty: 1 }]
    })
  }

  const totalQty = cart.reduce((s, c) => s + c.qty, 0)
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0)
  const shipping = subtotal >= 60 ? 0 : 5.99
  const total = subtotal + shipping

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, source: 'naruchnik' }),
    })
    setSubmitted(true)
    setLoading(false)
  }

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cart.length === 0) return
    setOrderLoading(true)
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
    }
    setOrderLoading(false)
  }

  const trackAffiliate = (partner: string, slug: string) => {
    fetch('/api/analytics/affiliate-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner, product_slug: slug }),
    })
  }

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", color: '#111', margin: 0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', system-ui, sans-serif; }
        .btn-green {
          background: #2d6a4f; color: #fff; border: none; border-radius: 10px;
          padding: 14px 28px; font-size: 16px; font-weight: 600; cursor: pointer;
          font-family: inherit; transition: opacity .2s; width: 100%;
        }
        .btn-green:hover { opacity: .88; }
        .btn-outline {
          background: transparent; color: #2d6a4f; border: 2px solid #2d6a4f;
          border-radius: 10px; padding: 12px 24px; font-size: 15px; font-weight: 600;
          cursor: pointer; font-family: inherit; transition: all .2s; width: 100%;
        }
        .btn-outline:hover { background: #2d6a4f; color: #fff; }
        input, textarea, select {
          width: 100%; padding: 12px 14px; border: 1.5px solid #e5e7eb;
          border-radius: 9px; font-family: inherit; font-size: 15px;
          transition: border-color .2s; outline: none;
        }
        input:focus, textarea:focus, select:focus { border-color: #2d6a4f; }
        .section { padding: 64px 20px; max-width: 900px; margin: 0 auto; }
        .card {
          background: #fff; border: 1px solid #e5e7eb; border-radius: 16px;
          padding: 28px; margin-bottom: 20px;
        }
      `}</style>

      {/* HERO */}
      <section style={{ background: 'linear-gradient(135deg, #0f1f16 0%, #2d6a4f 60%, #40916c 100%)', padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🍅</div>
          <h1 style={{ color: '#fff', fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 700, lineHeight: 1.2, marginBottom: 16 }}>
            Тайните на Едрите<br />и Вкусни Домати
          </h1>
          <p style={{ color: 'rgba(255,255,255,.8)', fontSize: 18, marginBottom: 32, lineHeight: 1.6 }}>
            Изтегли безплатния наръчник и открий как да отгледаш здрави домати без загубена реколта
          </p>
          <a href="#naruchnik" style={{ background: '#4ade80', color: '#0f1f16', padding: '16px 36px', borderRadius: 12, textDecoration: 'none', fontWeight: 700, fontSize: 18, display: 'inline-block' }}>
            📗 Вземи безплатния наръчник
          </a>
        </div>
      </section>

      {/* LEAD FORM */}
      <section id="naruchnik" style={{ background: '#f0fdf4', padding: '64px 20px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
            📗 Безплатен Наръчник
          </h2>
          <p style={{ color: '#6b7280', textAlign: 'center', marginBottom: 28 }}>
            "Тайните на Едрите и Вкусни Домати" — PDF на имейла ти
          </p>

          {submitted ? (
            <div style={{ background: '#fff', border: '2px solid #4ade80', borderRadius: 16, padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Изпратен!</h3>
              <p style={{ color: '#6b7280' }}>Провери имейла си — наръчникът е на път.</p>
            </div>
          ) : (
            <form onSubmit={handleLeadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
              <button type="submit" className="btn-green" disabled={loading}>
                {loading ? 'Изпращане...' : '📗 Изпрати ми наръчника безплатно'}
              </button>
              <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
                Без спам. Само полезно агро съдържание.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* PRODUCTS */}
      <section id="products" className="section">
        <h2 style={{ fontSize: 32, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
          Продукти Atlas Terra
        </h2>
        <p style={{ color: '#6b7280', textAlign: 'center', marginBottom: 36 }}>
          Директна поръчка с наложен платеж
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 40 }}>
          {products.map(p => (
            <div key={p.slug} className="card" style={{ position: 'relative' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>{p.emoji}</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{p.name}</h3>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 12 }}>{p.subtitle}</p>
              <ul style={{ marginBottom: 16, paddingLeft: 0, listStyle: 'none' }}>
                {p.bullets.map(b => (
                  <li key={b} style={{ fontSize: 14, color: '#374151', padding: '3px 0' }}>✓ {b}</li>
                ))}
              </ul>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: '#2d6a4f' }}>{p.price.toFixed(2)} лв.</span>
                <span style={{ fontSize: 15, color: '#9ca3af', textDecoration: 'line-through' }}>{p.compare.toFixed(2)} лв.</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>/ {p.unit}</span>
              </div>
              <button className="btn-green" onClick={() => addToCart(p)}>
                + Добави в количката
              </button>
            </div>
          ))}
        </div>

        {/* Cart & Order Form */}
        {cart.length > 0 && (
          <div className="card" style={{ borderColor: '#2d6a4f', borderWidth: 2 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>🛒 Количка</h3>
            {cart.map(c => (
              <div key={c.slug} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0', alignItems: 'center' }}>
                <span style={{ fontSize: 14 }}>{c.name} × {c.qty}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 600 }}>{(c.price * c.qty).toFixed(2)} лв.</span>
                  <button onClick={() => setCart(prev => prev.filter(x => x.slug !== c.slug))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16 }}>✕</button>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '2px solid #e5e7eb' }}>
              <span>Доставка</span>
              <span>{shipping === 0 ? 'Безплатна' : `${shipping.toFixed(2)} лв.`}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700, marginTop: 8 }}>
              <span>Общо</span>
              <span style={{ color: '#2d6a4f' }}>{total.toFixed(2)} лв.</span>
            </div>

            {orderDone ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #4ade80', borderRadius: 12, padding: 20, marginTop: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                <h4 style={{ fontSize: 18, fontWeight: 700 }}>Поръчка {orderDone} е получена!</h4>
                <p style={{ color: '#6b7280', marginTop: 4 }}>Ще се свържем с теб скоро.</p>
              </div>
            ) : (
              <form onSubmit={handleOrder} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Данни за доставка</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
                  <option value="cod">Наложен платеж</option>
                  <option value="bank">Банков превод</option>
                </select>
                <button type="submit" className="btn-green" disabled={orderLoading}>
                  {orderLoading ? 'Изпращане...' : `✓ Поръчай за ${total.toFixed(2)} лв.`}
                </button>
              </form>
            )}
          </div>
        )}
      </section>

      {/* AFFILIATE LINKS */}
      <section style={{ background: '#f9fafb', padding: '48px 20px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Препоръчани партньори</h2>
          <p style={{ color: '#6b7280', marginBottom: 32 }}>Проверени продукти от доверени доставчици</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://www.agroapteki.bg/?tracking=6809eceee15ad"
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAffiliate('agroapteki', 'general')}
              style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 24px', textDecoration: 'none', color: '#111', fontWeight: 600, fontSize: 15, transition: 'all .2s' }}
            >
              🌿 AgroApteki.bg →
            </a>
            <a
              href="https://oranjeriata.bg"
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAffiliate('oranjeriata', 'ginegar')}
              style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 24px', textDecoration: 'none', color: '#111', fontWeight: 600, fontSize: 15 }}
            >
              🏡 Oranjeriata.bg →
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#0f1f16', color: 'rgba(255,255,255,.5)', padding: '32px 20px', textAlign: 'center', fontSize: 14 }}>
        <p>© {new Date().getFullYear()} Denny Angelow · dennyangelow.com</p>
        <p style={{ marginTop: 8 }}>
          <a href="/admin" style={{ color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>admin</a>
        </p>
      </footer>
    </div>
  )
}
