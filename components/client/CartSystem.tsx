'use client'
// components/client/CartSystem.tsx
// Variant picker (5л / 20л) + цена на литър + количка + евро

import { useState, useCallback } from 'react'

interface ProductVariant {
  id: string
  product_id: string
  label: string
  size_liters: number
  price: number
  compare_price: number
  price_per_liter: number
  stock: number
  active: boolean
}

interface AtlasProduct {
  id: string
  name: string
  subtitle: string
  desc: string
  badge: string
  emoji: string
  img: string
  price: number
  comparePrice: number
  priceLabel: string
  features: string[]
  variants?: ProductVariant[]
}

interface CartItem {
  productId: string
  variantId: string
  productName: string
  variantLabel: string
  price: number
  qty: number
  emoji: string
  size_liters: number
}

interface Props {
  atlasProducts: AtlasProduct[]
  shippingPrice: number
  freeShippingAbove: number
  siteEmail: string
  sitePhone: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => '€' + n.toFixed(2)
const fmtLiter = (n: number) => '€' + n.toFixed(2) + '/л'

// ─── Single product card with variant picker ──────────────────────────────────
function ProductCard({
  product,
  onAddToCart,
}: {
  product: AtlasProduct
  onAddToCart: (item: CartItem) => void
}) {
  const variants = (product.variants || []).filter(v => v.active !== false)
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    variants[0]?.id || ''
  )
  const [added, setAdded] = useState(false)

  const selectedVariant = variants.find(v => v.id === selectedVariantId) || variants[0]
  const discount = selectedVariant
    ? Math.round(((selectedVariant.compare_price - selectedVariant.price) / selectedVariant.compare_price) * 100)
    : 0

  const handleAdd = () => {
    if (!selectedVariant) return
    onAddToCart({
      productId: product.id,
      variantId: selectedVariant.id,
      productName: product.name,
      variantLabel: selectedVariant.label,
      price: selectedVariant.price,
      qty: 1,
      emoji: product.emoji,
      size_liters: selectedVariant.size_liters,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: 20,
      overflow: 'hidden',
      boxShadow: '0 4px 32px rgba(0,0,0,0.07)',
      border: '1.5px solid #f0f0f0',
      display: 'flex',
      flexDirection: 'column',
      transition: 'transform .2s, box-shadow .2s',
    }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'translateY(-4px)'
        el.style.boxShadow = '0 12px 48px rgba(0,0,0,0.12)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = ''
        el.style.boxShadow = '0 4px 32px rgba(0,0,0,0.07)'
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {product.badge && (
          <div style={{ position: 'absolute', top: 14, left: 14, background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 30, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {product.badge}
          </div>
        )}
        {discount > 0 && (
          <div style={{ position: 'absolute', top: 14, right: 14, background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 900, padding: '4px 10px', borderRadius: 30 }}>
            -{discount}%
          </div>
        )}
        {product.img ? (
          <img src={product.img} alt={product.name} style={{ maxHeight: 160, maxWidth: '100%', objectFit: 'contain' }} />
        ) : (
          <span style={{ fontSize: 72 }}>{product.emoji}</span>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '20px 22px 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>
          {product.emoji} {product.subtitle || 'Биостимулатор'}
        </div>
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 800, color: '#111', margin: '0 0 10px', lineHeight: 1.2 }}>
          {product.name}
        </h3>
        <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.65, marginBottom: 16, flex: 0 }}>
          {product.desc}
        </p>

        {/* Features */}
        {product.features?.length > 0 && (
          <ul style={{ margin: '0 0 18px', padding: 0, listStyle: 'none' }}>
            {product.features.slice(0, 3).map((f, i) => (
              <li key={i} style={{ fontSize: 12.5, color: '#374151', padding: '5px 0', display: 'flex', gap: 8, alignItems: 'flex-start', borderBottom: '1px solid #f5f5f5' }}>
                <span style={{ background: '#16a34a', color: '#fff', width: 15, height: 15, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>✓</span>
                {f}
              </li>
            ))}
          </ul>
        )}

        {/* ── VARIANT PICKER ── */}
        {variants.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Избери количество:
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {variants.map(v => {
                const isSelected = v.id === selectedVariantId
                const savePct = v.compare_price > v.price
                  ? Math.round(((v.compare_price - v.price) / v.compare_price) * 100)
                  : 0
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariantId(v.id)}
                    style={{
                      flex: '1 1 calc(50% - 4px)',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: isSelected ? '2px solid #16a34a' : '1.5px solid #e5e7eb',
                      background: isSelected ? '#f0fdf4' : '#fafafa',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all .15s',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 800, color: isSelected ? '#15803d' : '#374151' }}>
                      {v.label}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: isSelected ? '#16a34a' : '#111', marginTop: 2 }}>
                      {fmt(v.price)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: '#9ca3af', textDecoration: 'line-through' }}>
                        {fmt(v.compare_price)}
                      </span>
                      {/* цена на литър — ключовият маркетинг елемент */}
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '1px 6px', borderRadius: 6 }}>
                        {fmtLiter(v.price_per_liter)}
                      </span>
                    </div>
                    {savePct > 0 && v.size_liters >= 20 && (
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', marginTop: 3 }}>
                        🔥 Спестяваш {savePct}%
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Price summary */}
        {selectedVariant && (
          <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '12px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Избрано: {selectedVariant.label}</div>
              <div style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>{fmtLiter(selectedVariant.price_per_liter)} · {selectedVariant.size_liters}л</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a' }}>{fmt(selectedVariant.price)}</div>
              {selectedVariant.compare_price > selectedVariant.price && (
                <div style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'line-through' }}>{fmt(selectedVariant.compare_price)}</div>
              )}
            </div>
          </div>
        )}

        {/* Add to cart */}
        <button
          onClick={handleAdd}
          disabled={!selectedVariant}
          style={{
            display: 'block',
            width: '100%',
            padding: '13px 20px',
            background: added ? '#059669' : '#16a34a',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontWeight: 800,
            fontSize: 15,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all .2s',
            marginTop: 'auto',
            transform: added ? 'scale(0.98)' : 'scale(1)',
          }}
        >
          {added ? '✓ Добавено!' : `🛒 Добави в количката`}
        </button>
      </div>
    </div>
  )
}

// ─── Cart Drawer ──────────────────────────────────────────────────────────────
function CartDrawer({
  items,
  shippingPrice,
  freeShippingAbove,
  sitePhone,
  onClose,
  onUpdateQty,
  onRemove,
}: {
  items: CartItem[]
  shippingPrice: number
  freeShippingAbove: number
  sitePhone: string
  onClose: () => void
  onUpdateQty: (variantId: string, qty: number) => void
  onRemove: (variantId: string) => void
}) {
  const [step, setStep] = useState<'cart' | 'checkout'>('cart')
  const [form, setForm] = useState({ name: '', phone: '', city: '', address: '', notes: '', courier: 'econt' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const shipping = subtotal >= freeShippingAbove ? 0 : shippingPrice
  const total = subtotal + shipping

  const handleOrder = async () => {
    if (!form.name || !form.phone || !form.city || !form.address) {
      setError('Моля попълни всички задължителни полета.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: form.name,
          customer_phone: form.phone,
          customer_city: form.city,
          customer_address: form.address,
          customer_notes: form.notes,
          courier: form.courier,
          payment_method: 'cod',
          currency: 'EUR',
          items: items.map(i => ({
            product_id: i.productId,
            variant_id: i.variantId,
            product_name: `${i.productName} — ${i.variantLabel}`,
            quantity: i.qty,
            unit_price: i.price,
            total_price: i.price * i.qty,
          })),
          subtotal,
          shipping,
          total,
        }),
      })
      if (!res.ok) throw new Error()
      setDone(true)
    } catch {
      setError('Грешка при изпращане. Моля опитай отново.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <style>{`
        .cart-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:500;backdrop-filter:blur(3px)}
        .cart-drawer{position:fixed;right:0;top:0;bottom:0;width:100%;max-width:440px;background:#fff;z-index:501;display:flex;flex-direction:column;box-shadow:-12px 0 60px rgba(0,0,0,.18);animation:slideIn .25s ease}
        @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        .cart-inner{flex:1;overflow-y:auto;padding:20px}
        .cart-footer{padding:16px 20px;border-top:1px solid #f0f0f0;background:#fafafa}
        .cart-input{width:100%;padding:10px 13px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:inherit;font-size:14px;outline:none;box-sizing:border-box;margin-bottom:10px;color:#111;background:#fff}
        .cart-input:focus{border-color:#16a34a}
        .cart-btn-primary{width:100%;padding:14px;background:#16a34a;color:#fff;border:none;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;transition:opacity .2s}
        .cart-btn-primary:disabled{opacity:.55}
        .cart-btn-secondary{width:100%;padding:11px;background:#f5f5f5;color:#374151;border:none;border-radius:12px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;margin-top:8px}
      `}</style>
      <div className="cart-overlay" onClick={onClose} />
      <div className="cart-drawer">
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: '#111' }}>
            {done ? '✅ Поръчката е приета!' : step === 'cart' ? `🛒 Количка (${items.length})` : '📦 Финализирай поръчката'}
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, border: 'none', background: '#f5f5f5', borderRadius: 8, cursor: 'pointer', fontSize: 16, color: '#6b7280' }}>✕</button>
        </div>

        {done ? (
          /* ── Success ── */
          <div className="cart-inner" style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 800, marginBottom: 12 }}>Благодаря!</h2>
            <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
              Поръчката ти е получена. Ще се свържем с теб скоро за потвърждение.
            </p>
            <p style={{ fontSize: 14, color: '#374151' }}>
              📞 При въпроси: <a href={`tel:${sitePhone}`} style={{ color: '#16a34a', fontWeight: 700 }}>{sitePhone}</a>
            </p>
          </div>
        ) : step === 'cart' ? (
          /* ── Cart items ── */
          <>
            <div className="cart-inner">
              {items.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, paddingTop: 60 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
                  Количката е празна
                </div>
              ) : (
                items.map(item => (
                  <div key={item.variantId} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid #f5f5f5', alignItems: 'center' }}>
                    <div style={{ fontSize: 32, flexShrink: 0 }}>{item.emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 2 }}>{item.productName}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{item.variantLabel} · {fmtLiter(item.price / item.size_liters)}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>{fmt(item.price * item.qty)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => onUpdateQty(item.variantId, item.qty - 1)} style={{ width: 28, height: 28, border: '1.5px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                      <button onClick={() => onUpdateQty(item.variantId, item.qty + 1)} style={{ width: 28, height: 28, border: '1.5px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      <button onClick={() => onRemove(item.variantId)} style={{ width: 28, height: 28, border: 'none', borderRadius: 8, background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {items.length > 0 && (
              <div className="cart-footer">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: '#6b7280' }}>
                  <span>Продукти</span><span>{fmt(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13, color: '#6b7280' }}>
                  <span>Доставка</span>
                  <span>{shipping === 0 ? <span style={{ color: '#16a34a', fontWeight: 700 }}>Безплатна 🎉</span> : fmt(shipping)}</span>
                </div>
                {shipping > 0 && (
                  <div style={{ background: '#fef9c3', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#854d0e', marginBottom: 12, textAlign: 'center' }}>
                    Добави още {fmt(freeShippingAbove - subtotal)} за безплатна доставка
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 18, fontWeight: 900, color: '#111' }}>
                  <span>Общо</span><span style={{ color: '#16a34a' }}>{fmt(total)}</span>
                </div>
                <button className="cart-btn-primary" onClick={() => setStep('checkout')}>
                  Продължи към поръчка →
                </button>
              </div>
            )}
          </>
        ) : (
          /* ── Checkout form ── */
          <>
            <div className="cart-inner">
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                Поръчката е с наложен платеж. Плащаш при получаване.
              </div>
              <input className="cart-input" placeholder="Имена *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <input className="cart-input" placeholder="Телефон *" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              <input className="cart-input" placeholder="Град *" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              <input className="cart-input" placeholder="Адрес *" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>КУРИЕР</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ value: 'econt', label: '📦 Еконт' }, { value: 'speedy', label: '🚀 Спиди' }].map(c => (
                    <button key={c.value} onClick={() => setForm(f => ({ ...f, courier: c.value }))}
                      style={{ flex: 1, padding: '10px', border: `1.5px solid ${form.courier === c.value ? '#16a34a' : '#e5e7eb'}`, borderRadius: 10, background: form.courier === c.value ? '#f0fdf4' : '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, color: form.courier === c.value ? '#15803d' : '#374151' }}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea className="cart-input" placeholder="Бележки към поръчката (по желание)" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />

              {error && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 10 }}>{error}</div>}

              {/* Order summary */}
              <div style={{ background: '#f9fafb', borderRadius: 12, padding: '14px', marginTop: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Резюме</div>
                {items.map(i => (
                  <div key={i.variantId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: '#374151' }}>
                    <span>{i.emoji} {i.productName} {i.variantLabel} ×{i.qty}</span>
                    <span style={{ fontWeight: 700 }}>{fmt(i.price * i.qty)}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 16 }}>
                  <span>Общо с доставка</span>
                  <span style={{ color: '#16a34a' }}>{fmt(total)}</span>
                </div>
              </div>
            </div>
            <div className="cart-footer">
              <button className="cart-btn-primary" onClick={handleOrder} disabled={submitting}>
                {submitting ? '⏳ Изпращане...' : `✅ Потвърди поръчката — ${fmt(total)}`}
              </button>
              <button className="cart-btn-secondary" onClick={() => setStep('cart')}>← Назад към количката</button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ─── MAIN CartSystem ──────────────────────────────────────────────────────────
export function CartSystem({ atlasProducts, shippingPrice, freeShippingAbove, siteEmail, sitePhone }: Props) {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)

  const addToCart = useCallback((item: CartItem) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.variantId === item.variantId)
      if (existing) {
        return prev.map(i => i.variantId === item.variantId ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, item]
    })
    setDrawerOpen(true)
  }, [])

  const updateQty = useCallback((variantId: string, qty: number) => {
    if (qty <= 0) {
      setCartItems(prev => prev.filter(i => i.variantId !== variantId))
    } else {
      setCartItems(prev => prev.map(i => i.variantId === variantId ? { ...i, qty } : i))
    }
  }, [])

  const removeItem = useCallback((variantId: string) => {
    setCartItems(prev => prev.filter(i => i.variantId !== variantId))
  }, [])

  const totalItems = cartItems.reduce((s, i) => s + i.qty, 0)

  return (
    <>
      {/* Floating cart button */}
      {totalItems > 0 && !drawerOpen && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 400 }}>
          <button
            onClick={() => setDrawerOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 50, padding: '14px 22px', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 8px 32px rgba(22,163,74,0.4)', fontFamily: 'inherit', animation: 'pulse 2s infinite' }}
          >
            🛒 <span>{totalItems} в количката</span>
            <span style={{ background: '#dc2626', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>{totalItems}</span>
          </button>
        </div>
      )}

      {/* Products grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        {atlasProducts.map(product => (
          <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
        ))}
      </div>

      {/* Cart drawer */}
      {drawerOpen && (
        <CartDrawer
          items={cartItems}
          shippingPrice={shippingPrice}
          freeShippingAbove={freeShippingAbove}
          sitePhone={sitePhone}
          onClose={() => setDrawerOpen(false)}
          onUpdateQty={updateQty}
          onRemove={removeItem}
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 8px 32px rgba(22,163,74,.4); }
          50% { transform: scale(1.04); box-shadow: 0 12px 40px rgba(22,163,74,.55); }
        }
      `}</style>
    </>
  )
}
