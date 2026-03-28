'use client'

// components/client/CartSystem.tsx
// Atlas продукти + количка — само тази логика е client

import { useState, useEffect } from 'react'
import { FadeIn } from '@/components/marketing/FadeIn'

interface CartItem { id: string; name: string; price: number; qty: number }
interface OrderForm { name: string; phone: string; email: string; address: string; city: string; notes: string; payment: string }
interface AtlasProduct { id: string; name: string; subtitle: string; desc: string; badge: string; emoji: string; img: string; price: number; comparePrice: number; priceLabel: string; features: string[] }

interface Props {
  atlasProducts: AtlasProduct[]
  shippingPrice: number
  freeShippingAbove: number
  siteEmail: string
  sitePhone: string
}

export function CartSystem({ atlasProducts, shippingPrice, freeShippingAbove, siteEmail, sitePhone }: Props) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartVisible, setCartVisible] = useState(false)
  const [orderForm, setOrderForm] = useState<OrderForm>({ name: '', phone: '', email: '', address: '', city: '', notes: '', payment: 'cod' })
  const [orderLoading, setOrderLoading] = useState(false)
  const [orderDone, setOrderDone] = useState('')

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const shipping = cartTotal >= freeShippingAbove ? 0 : shippingPrice

  // Комуникация с HeaderClient чрез custom events
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('cart:count', { detail: cartCount }))
  }, [cartCount])

  useEffect(() => {
    const handler = () => setCartVisible(true)
    window.addEventListener('cart:open', handler)
    return () => window.removeEventListener('cart:open', handler)
  }, [])

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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  const canOrder = !!(orderForm.name && orderForm.phone && orderForm.address && orderForm.city)

  return (
    <>
      {/* Atlas Grid */}
      <div className="atlas-grid">
        {atlasProducts.map((p, i) => (
          <FadeIn key={p.id} delay={i * 100}>
            <div className="atlas-card"
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-6px)'; el.style.boxShadow = '0 20px 60px rgba(22,163,74,0.15)'; el.style.borderColor = '#86efac' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '0 8px 40px rgba(0,0,0,0.09)'; el.style.borderColor = '#d1fae5' }}>
              <div style={{ position: 'relative', minHeight: 200, background: '#e8f5e9' }}>
                <img src={p.img} alt={p.name} style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }}
                  onError={e => { const img = e.currentTarget as HTMLImageElement; img.style.display = 'none'; const w = img.parentElement; if (w) { w.style.display = 'flex'; w.style.alignItems = 'center'; w.style.justifyContent = 'center'; w.style.fontSize = '56px'; w.style.background = 'linear-gradient(135deg,#dcfce7,#bbf7d0)'; const span = document.createElement('span'); span.textContent = p.emoji; w.appendChild(span) } }} />
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
                      <span style={{ background: '#16a34a', color: '#fff', width: 15, height: 15, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, flexShrink: 0, marginTop: 2 }}>✓</span>{f}
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
                      {shipping > 0 && <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '7px 11px', fontSize: 12, color: '#92400e', marginBottom: 8 }}>Добави още <strong>{(freeShippingAbove - cartTotal).toFixed(2)} лв.</strong> за безплатна доставка</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 18, color: '#111', borderTop: '2px solid #e5e7eb', paddingTop: 11, marginTop: 4 }}>
                        <span>Общо:</span><span style={{ color: '#16a34a' }}>{(cartTotal + shipping).toFixed(2)} лв.</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📦 Данни за доставка</div>
                    {([
                      { key: 'name', placeholder: 'Три имена *', type: 'text' },
                      { key: 'phone', placeholder: 'Телефон *', type: 'tel' },
                      { key: 'email', placeholder: 'Имейл (по желание)', type: 'email' },
                      { key: 'address', placeholder: 'Адрес *', type: 'text' },
                      { key: 'city', placeholder: 'Град *', type: 'text' },
                    ] as const).map(field => (
                      <input key={field.key} type={field.type} placeholder={field.placeholder} value={orderForm[field.key]}
                        onChange={e => setOrderForm(f => ({ ...f, [field.key]: e.target.value }))}
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
                <button onClick={submitOrder} disabled={orderLoading || !canOrder}
                  style={{ width: '100%', padding: '15px', borderRadius: 14, border: 'none', background: !canOrder ? '#d1d5db' : '#16a34a', color: '#fff', fontWeight: 900, fontSize: 16, cursor: !canOrder ? 'not-allowed' : 'pointer', transition: 'all 0.2s', fontFamily: 'inherit' }}>
                  {orderLoading ? 'Изпращане...' : `✅ Поръчай — ${(cartTotal + shipping).toFixed(2)} лв.`}
                </button>
                <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 9 }}>🔒 Сигурна поръчка · Плащане при доставка</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating cart button */}
      {cartCount > 0 && !cartVisible && (
        <button onClick={() => setCartVisible(true)} className="float-cart">
          🛒 {cartCount} · {(cartTotal + shipping).toFixed(2)} лв.
        </button>
      )}
    </>
  )
}
