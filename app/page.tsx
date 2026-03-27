// app/page.tsx — Главна маркетинг страница v3
// с FAQ, евро цени, Еконт/Спиди, без дублиране

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FadeIn } from '@/components/marketing/FadeIn'
import { LeadForm } from '@/components/marketing/LeadForm'
import { ProductCard } from '@/components/marketing/ProductCard'
import { PRODUCTS, ATLAS_PRODUCTS, AFFILIATE_CATEGORIES, TESTIMONIALS, FAQ } from '@/lib/marketing-data'
import { COURIER_LABELS } from '@/lib/constants'

// ── Cart types ───────────────────────────────────────────────
interface CartItem { id: string; name: string; price: number; quantity: number }

function useCart() {
  const [items, setItems] = useState<CartItem[]>([])
  const add = (id: string, name: string, price: number) => {
    setItems(prev => {
      const ex = prev.find(i => i.id === id)
      return ex ? prev.map(i => i.id === id ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { id, name, price, quantity: 1 }]
    })
  }
  const remove = (id: string) => setItems(prev => prev.filter(i => i.id !== id))
  const update = (id: string, qty: number) => setItems(prev => qty <= 0 ? prev.filter(i => i.id !== id) : prev.map(i => i.id === id ? { ...i, quantity: qty } : i))
  const total  = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const count  = items.reduce((s, i) => s + i.quantity, 0)
  return { items, add, remove, update, total, count, clear: () => setItems([]) }
}

// ── Main component ───────────────────────────────────────────
export default function HomePage() {
  const [cartOpen, setCartOpen]   = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [faqOpen, setFaqOpen]     = useState<number | null>(null)
  const [form, setForm]           = useState({ name:'', phone:'', email:'', address:'', city:'', notes:'', payment:'cod', courier:'econt' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const cart = useCart()

  const FREE_SHIPPING = 60

  const shippingCost = () => {
    if (cart.total >= FREE_SHIPPING) return 0
    return COURIER_LABELS[form.courier as keyof typeof COURIER_LABELS]?.price || 5.00
  }

  const grandTotal = () => cart.total + shippingCost()

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cart.items.length === 0) return
    setSubmitting(true)
    setSubmitError('')
    const params = new URLSearchParams(window.location.search)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name:    form.name,
          customer_phone:   form.phone,
          customer_email:   form.email || undefined,
          customer_address: form.address,
          customer_city:    form.city,
          customer_notes:   form.notes || undefined,
          payment_method:   form.payment,
          courier:          form.courier,
          items: cart.items.map(i => ({
            product_name: i.name,
            quantity:     i.quantity,
            unit_price:   i.price,
            total_price:  i.price * i.quantity,
          })),
          subtotal:  cart.total,
          shipping:  shippingCost(),
          total:     grandTotal(),
          utm_source:   params.get('utm_source')   || undefined,
          utm_campaign: params.get('utm_campaign') || undefined,
        }),
      })
      if (res.ok) {
        setSubmitted(true)
        cart.clear()
        setCartOpen(false)
        setCheckoutOpen(false)
      } else {
        const d = await res.json()
        setSubmitError(d.error || 'Грешка. Опитай отново.')
      }
    } catch { setSubmitError('Грешка при изпращане.') }
    finally { setSubmitting(false) }
  }

  return (
    <>
      <style>{globalCSS}</style>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-inner">
          <FadeIn>
            <div className="hero-badge">🍅 Над 3,200 фермери вече го използват</div>
            <h1 className="hero-h1">
              Искаш Едри, Здрави<br/>и Сочни Домати?
            </h1>
            <p className="hero-sub">
              Изтегли безплатния наръчник и открий точно <strong>кога, как и с какво</strong> да торенeш — 
              за рекордна реколта без загубена продукция.
            </p>
            <div className="hero-warning">
              ⚠️ Не рискувай да изхвърлиш реколтата заради грешно торене — грешките са скъпи!
            </div>
          </FadeIn>

          {/* Lead form */}
          <FadeIn delay={150}>
            <div className="hero-form-box">
              <div className="hero-form-header">
                <div style={{ fontSize:32 }}>📗</div>
                <div>
                  <div style={{ fontWeight:800, color:'#fff', fontSize:17 }}>Безплатен PDF Наръчник</div>
                  <div style={{ fontSize:13, color:'rgba(255,255,255,.7)' }}>Получи на имейла си веднага</div>
                </div>
              </div>
              <LeadForm showSelector={true} source="homepage"/>
            </div>
          </FadeIn>
        </div>

        {/* Trust badges */}
        <div className="trust-row">
          {['📗 Безплатен наръчник','✓ Без спам','🚚 Еконт & Спиди','💶 Плащане с карта или в брой'].map(t => (
            <div key={t} className="trust-badge">{t}</div>
          ))}
        </div>
      </section>

      {/* ── AFFILIATE CATEGORIES ─────────────────────────────── */}
      <section className="section" style={{ background:'#f8fafb' }}>
        <div className="container">
          <FadeIn>
            <h2 className="section-title">Разгледай по категория</h2>
            <p className="section-sub">Партньорски продукти от доверени доставчици</p>
          </FadeIn>
          <div className="cat-grid">
            {AFFILIATE_CATEGORIES.map((cat, i) => (
              <FadeIn key={cat.label} delay={i * 60}>
                <a href={cat.link} target="_blank" rel="noopener noreferrer" className="cat-card"
                  style={{ borderColor: cat.color + '33' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = cat.color; (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = cat.color+'33'; (e.currentTarget as HTMLElement).style.transform = '' }}
                >
                  <div className="cat-icon" style={{ background: cat.color+'18', color: cat.color }}>{cat.icon}</div>
                  <div className="cat-label">{cat.label}</div>
                </a>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── AFFILIATE PRODUCTS ────────────────────────────────── */}
      <section className="section" id="products">
        <div className="container">
          <FadeIn>
            <h2 className="section-title">Препоръчани продукти</h2>
            <p className="section-sub">Проверени в практиката от хиляди фермери</p>
          </FadeIn>
          <div className="products-grid">
            {PRODUCTS.map((p, i) => <ProductCard key={p.id} p={p} idx={i}/>)}
          </div>
        </div>
      </section>

      {/* ── ATLAS TERRA ──────────────────────────────────────── */}
      <section className="section atlas-section" id="atlas">
        <div className="container">
          <FadeIn>
            <div className="atlas-badge">🌱 Собствена линия</div>
            <h2 className="section-title" style={{ color:'#fff' }}>Atlas Terra — Нашите продукти</h2>
            <p className="section-sub" style={{ color:'rgba(255,255,255,.75)' }}>
              Разработени съвместно с агрономи. Доставка с Еконт или Спиди до 2 работни дни.
            </p>
          </FadeIn>
          <div className="atlas-grid">
            {ATLAS_PRODUCTS.map((p, i) => (
              <FadeIn key={p.id} delay={i * 100}>
                <div className="atlas-card">
                  <div className="atlas-badge-pill">{p.badge}</div>
                  <div style={{ fontSize:48, margin:'8px 0' }}>{p.emoji}</div>
                  <img src={p.img} alt={p.name} className="atlas-img" loading="lazy"/>
                  <div style={{ fontSize:12, color:'#86efac', fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em', marginBottom:4 }}>{p.subtitle}</div>
                  <h3 className="atlas-name">{p.name}</h3>
                  <p className="atlas-desc">{p.desc}</p>
                  <ul className="atlas-features">
                    {p.features.map(f => <li key={f}>✓ {f}</li>)}
                  </ul>
                  <div className="atlas-price-row">
                    <span className="atlas-price">{p.priceLabel}</span>
                    {p.comparePrice && <span className="atlas-old">{p.comparePrice.toFixed(2)} €</span>}
                  </div>
                  <button className="atlas-btn" onClick={() => { cart.add(p.id, p.name, p.price); setCartOpen(true) }}>
                    🛒 Добави в количката
                  </button>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────── */}
      <section className="section" style={{ background:'#f8fafb' }}>
        <div className="container">
          <FadeIn>
            <h2 className="section-title">Какво казват фермерите</h2>
            <p className="section-sub">Реални резултати от реални хора</p>
          </FadeIn>
          <div className="testimonials-grid">
            {TESTIMONIALS.map((t, i) => (
              <FadeIn key={t.name} delay={i * 60}>
                <div className="testimonial-card">
                  <div className="t-stars">{'⭐'.repeat(t.stars)}</div>
                  <p className="t-text">"{t.text}"</p>
                  <div className="t-author">
                    <span className="t-avatar">{t.avatar}</span>
                    <div>
                      <div className="t-name">{t.name}</div>
                      <div className="t-loc">📍 {t.location}</div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="section" id="faq">
        <div className="container" style={{ maxWidth:800 }}>
          <FadeIn>
            <h2 className="section-title">Често задавани въпроси</h2>
            <p className="section-sub">Имаш въпрос? Вероятно е тук</p>
          </FadeIn>
          <div className="faq-list">
            {FAQ.map((item, i) => (
              <FadeIn key={i} delay={i * 30}>
                <div className="faq-item" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                  <div className="faq-q">
                    <span>{item.q}</span>
                    <span className="faq-icon">{faqOpen === i ? '−' : '+'}</span>
                  </div>
                  {faqOpen === i && <div className="faq-a">{item.a}</div>}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA bottom ───────────────────────────────────────── */}
      <section className="section cta-section">
        <div className="container" style={{ textAlign:'center', maxWidth:600 }}>
          <FadeIn>
            <div style={{ fontSize:48, marginBottom:16 }}>🍅</div>
            <h2 style={{ fontSize:28, fontWeight:800, color:'#fff', marginBottom:12 }}>
              Готов за рекордна реколта?
            </h2>
            <p style={{ color:'rgba(255,255,255,.75)', fontSize:15, marginBottom:28, lineHeight:1.6 }}>
              Изтегли безплатния наръчник сега и започни правилно още тази сезона.
            </p>
            <LeadForm source="cta-bottom"/>
          </FadeIn>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div>
              <div style={{ fontSize:24, marginBottom:8 }}>🍅 Denny Angelow</div>
              <p style={{ fontSize:13, color:'rgba(255,255,255,.5)', lineHeight:1.6, maxWidth:260 }}>
                Агро консултант. Помагам на фермерите да отглеждат по-здрава и богата реколта.
              </p>
            </div>
            <div>
              <div className="footer-title">Доставка</div>
              <div className="footer-links">
                <span>🚚 Еконт — 5.00 €</span>
                <span>🚚 Спиди — 5.50 €</span>
                <span>🎁 Безплатна над 60 €</span>
                <span>⏱ 1-2 работни дни</span>
              </div>
            </div>
            <div>
              <div className="footer-title">Контакти</div>
              <div className="footer-links">
                <a href="mailto:support@dennyangelow.com" className="footer-link">support@dennyangelow.com</a>
                <a href="#faq" className="footer-link">Въпроси и отговори</a>
                <a href="/unsubscribe" className="footer-link">Отпиши се</a>
              </div>
            </div>
          </div>
          <div className="footer-copy">
            © {new Date().getFullYear()} Denny Angelow. Всички права запазени. · Цените са в евро (€) с включен ДДС.
          </div>
        </div>
      </footer>

      {/* ── CART BUTTON ──────────────────────────────────────── */}
      {cart.count > 0 && !cartOpen && (
        <button className="cart-float" onClick={() => setCartOpen(true)}>
          🛒 <span className="cart-count">{cart.count}</span>
          <span style={{ fontSize:13, fontWeight:600 }}>{cart.total.toFixed(2)} €</span>
        </button>
      )}

      {/* ── CART DRAWER ──────────────────────────────────────── */}
      {cartOpen && (
        <div className="drawer-backdrop" onClick={() => setCartOpen(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>🛒 Количка</h3>
              <button className="drawer-close" onClick={() => setCartOpen(false)}>✕</button>
            </div>
            {cart.items.length === 0 ? (
              <div style={{ padding:40, textAlign:'center', color:'#9ca3af', fontSize:14 }}>Количката е празна</div>
            ) : (
              <>
                <div className="drawer-body">
                  {cart.items.map(item => (
                    <div key={item.id} className="cart-item">
                      <div className="cart-item-name">{item.name}</div>
                      <div className="cart-item-controls">
                        <button className="qty-btn" onClick={() => cart.update(item.id, item.quantity - 1)}>−</button>
                        <span style={{ fontWeight:700, minWidth:20, textAlign:'center' }}>{item.quantity}</span>
                        <button className="qty-btn" onClick={() => cart.update(item.id, item.quantity + 1)}>+</button>
                        <span style={{ fontWeight:700, color:'#16a34a', marginLeft:8 }}>{(item.price * item.quantity).toFixed(2)} €</span>
                        <button className="remove-btn" onClick={() => cart.remove(item.id)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="drawer-footer">
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:14, color:'#6b7280' }}>
                    <span>Продукти</span><span>{cart.total.toFixed(2)} €</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16, fontSize:16, fontWeight:800 }}>
                    <span>Общо</span><span style={{ color:'#16a34a' }}>{cart.total.toFixed(2)} €</span>
                  </div>
                  <p style={{ fontSize:12, color:'#9ca3af', marginBottom:12, textAlign:'center' }}>
                    {cart.total >= FREE_SHIPPING ? '🎁 Безплатна доставка!' : `Добави още ${(FREE_SHIPPING - cart.total).toFixed(2)} € за безплатна доставка`}
                  </p>
                  <button className="checkout-btn" onClick={() => { setCartOpen(false); setCheckoutOpen(true) }}>
                    Продължи към поръчка →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CHECKOUT ─────────────────────────────────────────── */}
      {checkoutOpen && !submitted && (
        <div className="drawer-backdrop" onClick={() => setCheckoutOpen(false)}>
          <div className="drawer checkout-drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>📦 Поръчка</h3>
              <button className="drawer-close" onClick={() => setCheckoutOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleOrder} className="drawer-body">
              {/* Order summary */}
              <div className="order-summary">
                {cart.items.map(i => (
                  <div key={i.id} style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
                    <span>{i.name} × {i.quantity}</span>
                    <span style={{ fontWeight:700 }}>{(i.price*i.quantity).toFixed(2)} €</span>
                  </div>
                ))}
              </div>

              {/* Courier */}
              <div className="field-group">
                <label className="field-label">Куриер за доставка</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {Object.entries(COURIER_LABELS).map(([key, cfg]) => {
                    const price = cart.total >= FREE_SHIPPING ? 0 : cfg.price
                    return (
                      <label key={key} className={`courier-option${form.courier===key?' selected':''}`}>
                        <input type="radio" name="courier" value={key} checked={form.courier===key} onChange={() => setForm(p=>({...p, courier:key}))} style={{ display:'none' }}/>
                        <span style={{ fontWeight:700 }}>🚚 {cfg.label}</span>
                        <span style={{ fontSize:12, color: price===0?'#16a34a':'#6b7280', fontWeight:price===0?700:400 }}>
                          {price===0 ? 'Безплатна' : `${price.toFixed(2)} €`}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Customer fields */}
              {[
                { key:'name',    label:'Имена *',              type:'text',  required:true,  placeholder:'Иван Петров' },
                { key:'phone',   label:'Телефон *',            type:'tel',   required:true,  placeholder:'+359 88 888 8888' },
                { key:'email',   label:'Имейл (за потвърждение)', type:'email', required:false, placeholder:'ivan@email.com' },
                { key:'address', label:'Адрес *',              type:'text',  required:true,  placeholder:'ул. Роза 12' },
                { key:'city',    label:'Град *',               type:'text',  required:true,  placeholder:'София' },
                { key:'notes',   label:'Бележки',              type:'text',  required:false, placeholder:'Предпочитан час за доставка...' },
              ].map(f => (
                <div key={f.key} className="field-group">
                  <label className="field-label">{f.label}</label>
                  <input type={f.type} required={f.required} value={form[f.key as keyof typeof form]} placeholder={f.placeholder}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="field-input"/>
                </div>
              ))}

              {/* Payment */}
              <div className="field-group">
                <label className="field-label">Начин на плащане</label>
                <select value={form.payment} onChange={e => setForm(p=>({...p, payment:e.target.value}))} className="field-input">
                  <option value="cod">💵 Наложен платеж</option>
                  <option value="bank">🏦 Банков превод</option>
                  <option value="card">💳 Карта</option>
                </select>
              </div>

              {/* Total */}
              <div className="order-total">
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:14 }}>
                  <span style={{ color:'#6b7280' }}>Доставка ({form.courier === 'speedy' ? 'Спиди' : 'Еконт'})</span>
                  <span>{shippingCost()===0 ? '🎁 Безплатна' : `${shippingCost().toFixed(2)} €`}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:18 }}>
                  <span>Общо</span>
                  <span style={{ color:'#16a34a' }}>{grandTotal().toFixed(2)} €</span>
                </div>
              </div>

              {submitError && <div className="submit-error">⚠️ {submitError}</div>}

              <button type="submit" disabled={submitting} className="submit-btn">
                {submitting ? '⏳ Изпраща...' : '✅ Потвърди поръчката'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Success */}
      {submitted && (
        <div className="drawer-backdrop" onClick={() => setSubmitted(false)}>
          <div className="success-box" onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:56, marginBottom:12 }}>🎉</div>
            <h2 style={{ fontSize:22, fontWeight:800, marginBottom:8 }}>Поръчката е получена!</h2>
            <p style={{ color:'#6b7280', fontSize:14, lineHeight:1.6, marginBottom:20 }}>
              Ще се свържем с теб в рамките на 24 часа за потвърждение. Ще получиш имейл с детайлите.
            </p>
            <button onClick={() => setSubmitted(false)} style={{ background:'#16a34a', color:'#fff', border:'none', borderRadius:12, padding:'12px 28px', fontWeight:800, fontSize:15, cursor:'pointer', fontFamily:'inherit' }}>
              Затвори
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── CSS ───────────────────────────────────────────────────────
const globalCSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{font-family:'DM Sans',system-ui,sans-serif;color:#111;background:#fff;-webkit-font-smoothing:antialiased}

  .container{max-width:1200px;margin:0 auto;padding:0 24px}
  .section{padding:72px 0}

  /* HERO */
  .hero{background:linear-gradient(145deg,#0c3a1c 0%,#1b4332 40%,#0f1f16 100%);padding:80px 24px 40px;color:#fff}
  .hero-inner{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 420px;gap:60px;align-items:center}
  @media(max-width:900px){.hero-inner{grid-template-columns:1fr;gap:36px}}
  .hero-badge{display:inline-flex;align-items:center;background:rgba(74,222,128,.15);border:1px solid rgba(74,222,128,.3);color:#86efac;border-radius:99px;padding:6px 16px;font-size:13px;font-weight:700;margin-bottom:20px;letter-spacing:.02em}
  .hero-h1{font-family:'Cormorant Garamond',serif;font-size:clamp(36px,5vw,56px);font-weight:800;line-height:1.15;margin-bottom:18px;color:#fff}
  .hero-sub{font-size:17px;color:rgba(255,255,255,.8);line-height:1.7;margin-bottom:20px;max-width:520px}
  .hero-warning{background:rgba(234,179,8,.12);border:1px solid rgba(234,179,8,.35);border-radius:10px;padding:12px 16px;font-size:13.5px;color:#fde68a;line-height:1.5;max-width:520px}
  .hero-form-box{background:rgba(255,255,255,.06);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:28px}
  .hero-form-header{display:flex;align-items:center;gap:12px;margin-bottom:20px}
  .trust-row{max-width:1200px;margin:32px auto 0;display:flex;gap:10px;flex-wrap:wrap;padding:0 24px}
  .trust-badge{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:99px;padding:8px 16px;font-size:12.5px;color:rgba(255,255,255,.75);font-weight:500}

  /* CATEGORIES */
  .cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-top:32px}
  .cat-card{display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px;background:#fff;border:1.5px solid transparent;border-radius:16px;text-decoration:none;transition:all .2s;box-shadow:0 2px 12px rgba(0,0,0,.05)}
  .cat-icon{width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px}
  .cat-label{font-size:13px;font-weight:700;color:#111;text-align:center;line-height:1.3}

  /* PRODUCTS */
  .products-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;margin-top:36px}

  /* ATLAS */
  .atlas-section{background:linear-gradient(145deg,#0c3a1c,#1b4332)}
  .atlas-badge{display:inline-block;background:rgba(74,222,128,.15);border:1px solid rgba(74,222,128,.3);color:#86efac;border-radius:99px;padding:6px 16px;font-size:13px;font-weight:700;margin-bottom:16px}
  .atlas-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:24px;margin-top:36px}
  .atlas-card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:28px;text-align:center;backdrop-filter:blur(8px);transition:all .2s}
  .atlas-card:hover{background:rgba(255,255,255,.1);transform:translateY(-3px)}
  .atlas-badge-pill{display:inline-block;background:rgba(74,222,128,.2);color:#86efac;font-size:11px;font-weight:800;padding:4px 12px;border-radius:99px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px}
  .atlas-img{max-height:160px;max-width:100%;object-fit:contain;border-radius:10px;margin:8px 0 16px}
  .atlas-name{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:800;color:#fff;margin-bottom:8px}
  .atlas-desc{font-size:14px;color:rgba(255,255,255,.7);line-height:1.6;margin-bottom:16px;font-style:italic}
  .atlas-features{list-style:none;text-align:left;margin-bottom:20px}
  .atlas-features li{font-size:13px;color:rgba(255,255,255,.8);padding:4px 0;display:flex;gap:8px;align-items:flex-start}
  .atlas-price-row{display:flex;align-items:baseline;gap:10px;justify-content:center;margin-bottom:18px}
  .atlas-price{font-size:28px;font-weight:900;color:#4ade80}
  .atlas-old{font-size:16px;color:rgba(255,255,255,.4);text-decoration:line-through}
  .atlas-btn{width:100%;background:linear-gradient(135deg,#4ade80,#22c55e);color:#052e16;border:none;border-radius:12px;padding:14px;font-weight:900;font-size:15px;cursor:pointer;font-family:inherit;transition:all .2s}
  .atlas-btn:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(74,222,128,.3)}

  /* SECTION titles */
  .section-title{font-family:'Cormorant Garamond',serif;font-size:clamp(28px,4vw,38px);font-weight:800;color:#111;text-align:center;margin-bottom:8px}
  .section-sub{font-size:16px;color:#6b7280;text-align:center;line-height:1.6}

  /* TESTIMONIALS */
  .testimonials-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-top:36px}
  .testimonial-card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.04)}
  .t-stars{font-size:14px;margin-bottom:10px}
  .t-text{font-size:14px;color:#374151;line-height:1.7;font-style:italic;margin-bottom:16px}
  .t-author{display:flex;align-items:center;gap:10px}
  .t-avatar{font-size:28px}
  .t-name{font-size:13px;font-weight:700;color:#111}
  .t-loc{font-size:12px;color:#9ca3af}

  /* FAQ */
  .faq-list{margin-top:32px;display:flex;flex-direction:column;gap:8px}
  .faq-item{background:#fff;border:1.5px solid #e5e7eb;border-radius:12px;padding:18px 20px;cursor:pointer;transition:all .2s}
  .faq-item:hover{border-color:#2d6a4f}
  .faq-q{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;font-size:15px;font-weight:700;color:#111}
  .faq-icon{font-size:20px;font-weight:400;color:#6b7280;flex-shrink:0;line-height:1}
  .faq-a{font-size:14px;color:#374151;line-height:1.7;margin-top:12px;padding-top:12px;border-top:1px solid #f0f0f0}

  /* CTA */
  .cta-section{background:linear-gradient(135deg,#0c3a1c,#1b4332);color:#fff}
  
  /* FOOTER */
  .footer{background:#0f1f16;color:#fff;padding:48px 0 24px}
  .footer-inner{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:40px;margin-bottom:36px}
  @media(max-width:640px){.footer-inner{grid-template-columns:1fr}}
  .footer-title{font-size:12px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px}
  .footer-links{display:flex;flex-direction:column;gap:8px}
  .footer-link{color:rgba(255,255,255,.6);text-decoration:none;font-size:14px;transition:color .2s}
  .footer-link:hover{color:#4ade80}
  .footer-copy{font-size:12px;color:rgba(255,255,255,.25);text-align:center;padding-top:24px;border-top:1px solid rgba(255,255,255,.06)}

  /* CART */
  .cart-float{position:fixed;bottom:24px;right:24px;background:#1b4332;color:#fff;border:none;border-radius:99px;padding:14px 22px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:700;display:flex;align-items:center;gap:10px;box-shadow:0 8px 28px rgba(0,0,0,.3);z-index:100;transition:transform .2s}
  .cart-float:hover{transform:translateY(-2px)}
  .cart-count{background:#ef4444;color:#fff;border-radius:99px;font-size:11px;padding:2px 7px;font-weight:900}
  
  /* DRAWER */
  .drawer-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:200;display:flex;justify-content:flex-end;backdrop-filter:blur(2px)}
  .drawer{background:#fff;width:100%;max-width:440px;height:100%;display:flex;flex-direction:column;overflow:hidden}
  .checkout-drawer{max-width:520px}
  .drawer-header{padding:20px 24px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
  .drawer-header h3{font-size:18px;font-weight:800}
  .drawer-close{background:#f5f5f5;border:none;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;color:#6b7280}
  .drawer-body{flex:1;overflow-y:auto;padding:20px 24px}
  .drawer-footer{padding:20px 24px;border-top:1px solid #e5e7eb}
  
  /* CART ITEMS */
  .cart-item{padding:14px 0;border-bottom:1px solid #f5f5f5;display:flex;flex-direction:column;gap:8px}
  .cart-item-name{font-size:14px;font-weight:600;color:#111}
  .cart-item-controls{display:flex;align-items:center;gap:8px}
  .qty-btn{width:28px;height:28px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;font-weight:700}
  .remove-btn{background:#fee2e2;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;color:#991b1b;font-size:12px;margin-left:auto}
  
  /* CHECKOUT */
  .order-summary{background:#f9fafb;border-radius:10px;padding:14px;margin-bottom:16px}
  .field-group{margin-bottom:14px}
  .field-label{display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:5px}
  .field-input{width:100%;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:9px;font-family:inherit;font-size:14px;outline:none;transition:border-color .2s;box-sizing:border-box;color:#111}
  .field-input:focus{border-color:#2d6a4f}
  .courier-option{display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px;border:1.5px solid #e5e7eb;border-radius:10px;cursor:pointer;transition:all .2s;font-size:14px}
  .courier-option.selected{border-color:#16a34a;background:#f0fdf4}
  .order-total{background:#f9fafb;border-radius:10px;padding:14px;margin:16px 0}
  .submit-error{background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;font-size:13px;color:#991b1b;margin-bottom:12px}
  .submit-btn{width:100%;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border:none;border-radius:12px;padding:15px;font-weight:900;font-size:16px;cursor:pointer;font-family:inherit;transition:all .2s}
  .submit-btn:disabled{opacity:.6;cursor:default}
  .checkout-btn{width:100%;background:#1b4332;color:#fff;border:none;border-radius:12px;padding:14px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;transition:opacity .2s}
  .checkout-btn:hover{opacity:.9}

  /* SUCCESS */
  .success-box{background:#fff;border-radius:20px;padding:40px;max-width:420px;width:100%;text-align:center;margin:auto;box-shadow:0 24px 60px rgba(0,0,0,.4)}

  @media(max-width:640px){
    .section{padding:48px 0}
    .products-grid{grid-template-columns:1fr}
    .atlas-grid{grid-template-columns:1fr}
    .cart-float{bottom:16px;right:16px}
    .drawer{max-width:100%}
  }
`
