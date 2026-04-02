'use client'
// components/client/CartSystem.tsx
// Fixes:
// ✅ z-index 9999 — drawer above sticky header
// ✅ Window events for header button connection
// ✅ Floating button removed — header button used instead
// ✅ Offer "added" state persists across drawer open/close
// ✅ Checkout summary shows all savings

import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// ─── CartHeaderButton — drop-in replacement for the header cart button ────────
// Usage in HeaderClient: replace the static <button className="cart-btn"> with:
//   import { CartHeaderButton } from '@/components/client/CartSystem'
//   <CartHeaderButton />

export function CartHeaderButton() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    // Load count from localStorage on mount
    try {
      const raw = localStorage.getItem('denny_cart_v2')
      if (raw) {
        const parsed = JSON.parse(raw)
        const total = Array.isArray(parsed.items)
          ? parsed.items.reduce((s: number, i: any) => s + (i.quantity || i.qty || 0), 0)
          : 0
        setCount(total)
      }
    } catch {}

    // Listen for count updates from CartSystem
    const handler = (e: Event) => setCount((e as CustomEvent).detail)
    window.addEventListener('cart:count', handler)
    return () => window.removeEventListener('cart:count', handler)
  }, [])

  return (
    <button
      className={`cart-btn${count > 0 ? ' cart-btn--active' : ''}`}
      onClick={() => window.dispatchEvent(new Event('cart:open'))}
      aria-label={`Количка${count > 0 ? ` (${count})` : ''}`}
    >
      🛒 Количка
      {count > 0 && (
        <span className="cart-btn-badge">{count}</span>
      )}
    </button>
  )
}

// ─── Типове ───────────────────────────────────────────────────────────────────

interface UpsellOffer {
  id: string
  type: 'cart_upsell' | 'cross_sell' | 'post_purchase'
  active: boolean
  title: string
  description: string
  emoji: string
  image_url?: string
  badge_text?: string
  badge_color?: string
  trigger_type: 'always' | 'product_in_cart' | 'cart_above' | 'cart_below'
  trigger_value?: string
  offer_product_id?: string
  offer_variant_id?: string
  discount_pct?: number
  sort_order: number
}

interface MarketingSettings {
  upsell_enabled: boolean
  cross_sell_enabled: boolean
  post_purchase_enabled: boolean
  progress_bar_enabled: boolean
  progress_goal_amount: number
  progress_goal_label: string
  post_purchase_delay: number
  offers: UpsellOffer[]
}

interface ProductVariant {
  id: string; product_id: string; label: string; size_liters: number
  price: number; compare_price: number; price_per_liter: number
  stock: number; active: boolean
}

interface AtlasProduct {
  id: string; name: string; subtitle: string; desc: string
  badge: string; emoji: string; img: string
  price: number; comparePrice: number; priceLabel: string
  features: string[]; variants?: ProductVariant[]
}

interface CartItem {
  productId: string; variantId: string; productName: string
  variantLabel: string; price: number; comparePrice: number; qty: number
  emoji: string; img: string; size_liters: number
}

interface Props {
  atlasProducts: AtlasProduct[]
  shippingPrice: number
  freeShippingAbove: number
  siteEmail: string
  sitePhone: string
  currencySymbol?: string
}

// ─── localStorage ─────────────────────────────────────────────────────────────

const CART_KEY = 'denny_cart_v2'
const CART_TTL = 7 * 24 * 60 * 60 * 1000

function loadCartFromStorage(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Date.now() - (parsed.savedAt || 0) > CART_TTL) {
      localStorage.removeItem(CART_KEY); return []
    }
    return Array.isArray(parsed.items) ? parsed.items : []
  } catch { return [] }
}

function saveCartToStorage(items: CartItem[]) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(CART_KEY, JSON.stringify({ items, savedAt: Date.now() })) } catch {}
}

function clearCartStorage() {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(CART_KEY) } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFmt(sym: string) {
  return {
    fmt: (n: number) => n.toFixed(2) + ' ' + sym,
    fmtLiter: (n: number) => n.toFixed(2) + ' ' + sym + '/л',
  }
}

// Module-scope fallback — not used directly; each component receives fmt/fmtLiter as props
// derived from currencySymbol read from the DB via page.tsx → CartSystem prop

function offerMatches(offer: UpsellOffer, items: CartItem[], subtotal: number): boolean {
  if (!offer.active) return false
  switch (offer.trigger_type) {
    case 'always':          return true
    case 'product_in_cart': return items.some(i => i.productId === offer.trigger_value)
    case 'cart_above':      return subtotal > Number(offer.trigger_value || 0)
    case 'cart_below':      return subtotal < Number(offer.trigger_value || 999999)
    default:                return false
  }
}

// ─── ЕДИННА Progress Bar (чете goal от settings, не е hardcode) ───────────────

function CartProgressBar({
  subtotal,
  freeShippingAbove,
  ms,
  fmt,
}: {
  subtotal: number
  freeShippingAbove: number
  ms: MarketingSettings | null
  fmt: (n: number) => string
}) {
  // Използваме goal от settings ако е включена progress bar, иначе freeShippingAbove
  const goal = ms?.progress_bar_enabled
    ? (ms.progress_goal_amount || freeShippingAbove)
    : freeShippingAbove
  const label = ms?.progress_goal_label || 'Безплатна доставка'
  const pct   = Math.min(100, (subtotal / goal) * 100)
  const left  = goal - subtotal
  const done  = subtotal >= goal

  return (
    <div style={{
      background: done
        ? 'linear-gradient(135deg,#14532d,#166534)'
        : 'linear-gradient(135deg,#f0fdf4,#f7fef9)',
      border: done ? 'none' : '1.5px solid #bbf7d0',
      borderRadius: 14, padding: '12px 16px', marginBottom: 14,
      transition: 'all .4s cubic-bezier(.4,0,.2,1)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 13, color: done ? '#86efac' : '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>{done ? '🎉' : '🚚'}</span>
          {done ? `${label} отключена!` : label}
        </span>
        {!done && (
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
            остават <strong style={{ color: '#16a34a' }}>{fmt(left)}</strong>
          </span>
        )}
      </div>
      <div style={{
        background: done ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.7)',
        borderRadius: 99, height: 8, overflow: 'hidden',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,.06)',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: done
            ? 'linear-gradient(90deg,#4ade80,#86efac)'
            : 'linear-gradient(90deg,#16a34a,#4ade80)',
          borderRadius: 99,
          transition: 'width .6s cubic-bezier(.4,0,.2,1)',
          boxShadow: done ? 'none' : '0 0 8px rgba(22,163,74,.4)',
        }} />
      </div>
      {!done && (
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
          <span>Текущо: <strong style={{ color: '#166534' }}>{fmt(subtotal)}</strong></span>
          <span>Цел: <strong>{fmt(goal)}</strong></span>
        </div>
      )}
    </div>
  )
}

// ─── Offer Cards — Beautiful compact design ────────────────────────────────────

const OFFER_META = {
  cart_upsell: {
    color: '#7c3aed', pill: '#f5f3ff', pillText: '#6d28d9',
    icon: '⬆️', label: 'Ъпгрейд',
  },
  cross_sell: {
    color: '#0369a1', pill: '#eff6ff', pillText: '#1d4ed8',
    icon: '🔀', label: 'Добавя се с',
  },
  post_purchase: {
    color: '#dc2626', pill: '#fff1f2', pillText: '#be123c',
    icon: '⚡', label: 'Само веднъж',
  },
}

function OfferCard({
  offer, products, onAddToCart, fmt, cartItems,
}: { offer: UpsellOffer; products: AtlasProduct[]; onAddToCart: (item: CartItem) => void; fmt: (n: number) => string; cartItems: CartItem[] }) {
  const product = products.find(p => p.id === offer.offer_product_id)
  const variant = product?.variants?.find(v =>
    offer.offer_variant_id ? v.id === offer.offer_variant_id : v.active !== false
  )
  const meta = OFFER_META[offer.type]

  // Check if already in cart — persistent across drawer open/close
  const alreadyInCart = !!variant && cartItems.some(i => i.variantId === variant.id)

  const discountedPrice = variant && offer.discount_pct
    ? +(variant.price * (1 - offer.discount_pct / 100)).toFixed(2)
    : variant?.price ?? 0

  const hasDiscount = offer.discount_pct && offer.discount_pct > 0

  const handleAdd = () => {
    if (!product || !variant || alreadyInCart) return
    onAddToCart({
      productId: product.id, variantId: variant.id, productName: product.name,
      variantLabel: variant.label + (hasDiscount ? ` (-${offer.discount_pct}%)` : ''),
      price: discountedPrice,
      comparePrice: Number(variant.compare_price) > Number(variant.price)
        ? Number(variant.compare_price)
        : Number(variant.price),
      qty: 1, emoji: product.emoji,
      img: product.img || '', size_liters: variant.size_liters,
    })
  }

  const canAdd = !!product && !!variant && !alreadyInCart

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: '#fff',
      border: '1px solid #f1f5f9',
      borderRadius: 14,
      padding: '10px 12px',
      boxShadow: '0 1px 4px rgba(0,0,0,.04)',
      transition: 'box-shadow .2s',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: meta.color, borderRadius: '14px 0 0 14px',
      }} />

      {/* Image / Emoji */}
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
        background: `${meta.color}10`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        marginLeft: 4,
      }}>
        {offer.image_url
          ? <img src={offer.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span>{offer.emoji || meta.icon}</span>}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Badge only (no type label) */}
        {offer.badge_text && (
          <div style={{ marginBottom: 2 }}>
            <span style={{
              fontSize: 9, fontWeight: 800, color: '#fff',
              background: offer.badge_color || meta.color,
              padding: '1px 6px', borderRadius: 99,
            }}>{offer.badge_text}</span>
          </div>
        )}
        <div style={{
          fontSize: 12.5, fontWeight: 700, color: '#0f172a',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          lineHeight: 1.3,
        }}>{offer.title}</div>

        {/* Price */}
        {canAdd && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: meta.color }}>{fmt(discountedPrice)}</span>
            {hasDiscount && (
              <>
                <span style={{ fontSize: 11, color: '#9ca3af', textDecoration: 'line-through', fontWeight: 500 }}>{fmt(variant!.price)}</span>
                <span style={{ fontSize: 9, fontWeight: 800, background: '#fee2e2', color: '#dc2626', padding: '1px 5px', borderRadius: 4 }}>
                  -{offer.discount_pct}%
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Add button */}
      <button
        onClick={handleAdd}
        disabled={!canAdd}
        style={{
          width: 32, height: 32, borderRadius: 10, border: 'none', flexShrink: 0,
          background: alreadyInCart ? '#059669' : canAdd ? meta.color : '#e2e8f0',
          color: '#fff', cursor: !canAdd ? 'default' : 'pointer',
          fontFamily: 'inherit', fontSize: alreadyInCart ? 14 : 18, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .2s',
          boxShadow: canAdd ? `0 2px 8px ${meta.color}40` : 'none',
        }}
      >
        {alreadyInCart ? '✓' : '+'}
      </button>
    </div>
  )
}

// ─── Post-purchase Modal ──────────────────────────────────────────────────────

function PostPurchaseModal({
  offer, products, onAccept, onDismiss, customerData, fmt,
}: {
  offer: UpsellOffer; products: AtlasProduct[]
  onAccept: () => void; onDismiss: () => void
  customerData: { name: string; phone: string; city: string; address: string; notes: string; courier: string }
  fmt: (n: number) => string
}) {
  const product = products.find(p => p.id === offer.offer_product_id)
  const variant = product?.variants?.find(v =>
    (offer as any).offer_variant_id
      ? v.id === (offer as any).offer_variant_id
      : v.active !== false
  )
  const [adding, setAdding] = useState(false)
  const [done, setDone]     = useState(false)

  const discountedPrice = variant && offer.discount_pct
    ? +(variant.price * (1 - offer.discount_pct / 100)).toFixed(2)
    : variant?.price ?? 0

  const handleAccept = async () => {
    if (!product || !variant) { onDismiss(); return }
    setAdding(true)
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerData.name, customer_phone: customerData.phone,
          customer_city: customerData.city, customer_address: customerData.address,
          customer_notes: `[POST-PURCHASE UPSELL] ${customerData.notes}`.trim(),
          courier: customerData.courier, payment_method: 'cod',
          items: [{
            product_name: `${product.name} — ${variant.label} (Post-purchase upsell)`,
            quantity: 1, unit_price: discountedPrice, total_price: discountedPrice,
          }],
          subtotal: discountedPrice, shipping: 0, total: discountedPrice,
        }),
      })
      setDone(true)
      setTimeout(onAccept, 1800)
    } catch { onDismiss() } finally { setAdding(false) }
  }

  return (
    <>
      <style>{`@keyframes ppIn{from{transform:translateY(40px) scale(.95);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}`}</style>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 10000, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 22, width: '100%', maxWidth: 400, overflow: 'hidden', animation: 'ppIn .4s cubic-bezier(.34,1.56,.64,1)', boxShadow: '0 32px 80px rgba(0,0,0,.3)' }}>
          <div style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', padding: '20px 22px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>⚡ Специална оферта само веднъж</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 32 }}>{offer.emoji}</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>{offer.title}</div>
                {offer.badge_text && <span style={{ fontSize: 10, fontWeight: 900, background: '#fff', color: '#dc2626', padding: '2px 8px', borderRadius: 99, display: 'inline-block', marginTop: 4 }}>{offer.badge_text}</span>}
              </div>
            </div>
          </div>
          <div style={{ padding: '18px 22px' }}>
            {offer.description && <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.65, marginBottom: 14 }}>{offer.description}</p>}
            {product && variant && (
              <div style={{ background: '#f9fafb', borderRadius: 12, padding: 14, marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 54, height: 54, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {product.img ? <img src={product.img} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 26 }}>{product.emoji}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{product.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{variant.label}</div>
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: '#dc2626' }}>{fmt(discountedPrice)}</span>
                    {offer.discount_pct ? <>
                      <span style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'line-through' }}>{fmt(variant.price)}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, background: '#fee2e2', color: '#dc2626', padding: '2px 6px', borderRadius: 6 }}>-{offer.discount_pct}%</span>
                    </> : null}
                  </div>
                </div>
              </div>
            )}
            {done && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#166534', fontWeight: 700, textAlign: 'center' }}>✅ Продуктът е добавен!</div>}
            <button onClick={handleAccept} disabled={adding || done} style={{ width: '100%', padding: 13, background: done ? '#059669' : '#dc2626', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 900, fontSize: 15, cursor: done ? 'default' : 'pointer', fontFamily: 'inherit', marginBottom: 8 }}>
              {adding ? '⏳ Добавяне...' : done ? '✓ Добавено!' : `⚡ Да, искам${offer.discount_pct ? ` (-${offer.discount_pct}%)` : ''}!`}
            </button>
            <button onClick={onDismiss} style={{ width: '100%', padding: 10, background: 'transparent', color: '#9ca3af', border: 'none', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Не, благодаря</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Product Card (на началната страница) ────────────────────────────────────

function ProductCard({ product, onAddToCart, fmt, fmtLiter }: { product: AtlasProduct; onAddToCart: (item: CartItem) => void; fmt: (n: number) => string; fmtLiter: (n: number) => string }) {
  const variants = (product.variants || []).filter(v => v.active !== false)
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id || '')
  const [added, setAdded] = useState(false)
  const selectedVariant   = variants.find(v => v.id === selectedVariantId) ?? variants[0]
  const discount          = selectedVariant && selectedVariant.compare_price > selectedVariant.price
    ? Math.round(((selectedVariant.compare_price - selectedVariant.price) / selectedVariant.compare_price) * 100) : 0

  const handleAdd = () => {
    if (!selectedVariant) return
    onAddToCart({
      productId: product.id, variantId: selectedVariant.id,
      productName: product.name, variantLabel: selectedVariant.label,
      price: selectedVariant.price,
      comparePrice: Number(selectedVariant.compare_price) > Number(selectedVariant.price)
        ? Number(selectedVariant.compare_price)
        : 0,
      qty: 1, emoji: product.emoji,
      img: product.img || '', size_liters: selectedVariant.size_liters,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  return (
    <div
      style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 32px rgba(0,0,0,.07)', border: '1.5px solid #f0f0f0', display: 'flex', flexDirection: 'column', transition: 'transform .2s, box-shadow .2s' }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-4px)'; el.style.boxShadow = '0 12px 48px rgba(0,0,0,.12)' }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '0 4px 32px rgba(0,0,0,.07)' }}
    >
      <div style={{ position: 'relative', background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {product.badge && <div style={{ position: 'absolute', top: 14, left: 14, background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 30, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{product.badge}</div>}
        {discount > 0 && <div style={{ position: 'absolute', top: 14, right: 14, background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 900, padding: '4px 10px', borderRadius: 30 }}>-{discount}%</div>}
        {product.img ? <img src={product.img} alt={product.name} style={{ maxHeight: 160, maxWidth: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 72 }}>{product.emoji}</span>}
      </div>

      <div style={{ padding: '20px 22px 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>{product.emoji} {product.subtitle}</div>
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 800, color: '#111', margin: '0 0 10px', lineHeight: 1.2 }}>{product.name}</h3>
        <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.65, marginBottom: 16 }}>{product.desc}</p>

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

        {variants.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Избери количество:</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {variants.map(v => {
                const sel     = v.id === selectedVariantId
                const savePct = v.compare_price > v.price ? Math.round(((v.compare_price - v.price) / v.compare_price) * 100) : 0
                return (
                  <button key={v.id} onClick={() => setSelectedVariantId(v.id)}
                    style={{ flex: '1 1 calc(50% - 4px)', padding: '10px 12px', borderRadius: 12, border: sel ? '2px solid #16a34a' : '1.5px solid #e5e7eb', background: sel ? '#f0fdf4' : '#fafafa', cursor: 'pointer', textAlign: 'left', transition: 'all .15s', fontFamily: 'inherit' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: sel ? '#15803d' : '#374151' }}>{v.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: sel ? '#16a34a' : '#111', marginTop: 2 }}>{fmt(v.price)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                      {v.compare_price > v.price && <span style={{ fontSize: 11, color: '#9ca3af', textDecoration: 'line-through' }}>{fmt(v.compare_price)}</span>}
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '1px 6px', borderRadius: 6 }}>{fmtLiter(v.price_per_liter)}</span>
                    </div>
                    {savePct > 0 && v.size_liters >= 20 && <div style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', marginTop: 3 }}>🔥 Спестяваш {savePct}%</div>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {selectedVariant && (
          <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '12px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Избрано: {selectedVariant.label}</div>
              <div style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>{fmtLiter(selectedVariant.price_per_liter)} · {selectedVariant.size_liters}л</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a' }}>{fmt(selectedVariant.price)}</div>
              {selectedVariant.compare_price > selectedVariant.price && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'line-through' }}>{fmt(selectedVariant.compare_price)}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: 5 }}>
                    -{Math.round(((selectedVariant.compare_price - selectedVariant.price) / selectedVariant.compare_price) * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <button onClick={handleAdd} disabled={!selectedVariant}
          style={{ display: 'block', width: '100%', padding: '13px 20px', background: added ? '#059669' : '#16a34a', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s', marginTop: 'auto', transform: added ? 'scale(0.98)' : 'scale(1)' }}>
          {added ? '✓ Добавено!' : '🛒 Добави в количката'}
        </button>
      </div>
    </div>
  )
}

// ─── Cart Item Row (с compare_price) ─────────────────────────────────────────

function CartItemRow({
  item, onUpdateQty, onRemove, fmt,
}: {
  item: CartItem
  onUpdateQty: (id: string, qty: number) => void
  onRemove: (id: string) => void
  fmt: (n: number) => string
}) {
  const saving = item.comparePrice > item.price
    ? (item.comparePrice - item.price) * item.qty
    : 0

  return (
    <div style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid #f8fafc', alignItems: 'flex-start' }}>
      <div style={{ width: 62, height: 62, flexShrink: 0, borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
        {item.img
          ? <img src={item.img} alt={item.productName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <span style={{ fontSize: 28 }}>{item.emoji}</span>}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 2, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.productName}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, marginBottom: 4 }}>{item.variantLabel}</div>

        {/* Цена с compare price */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 15, fontWeight: 900, color: '#16a34a', letterSpacing: '-.01em' }}>{fmt(item.price * item.qty)}</span>
          {item.comparePrice > item.price && (
            <>
              <span style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'line-through' }}>{fmt(item.comparePrice * item.qty)}</span>
              <span style={{ fontSize: 10, fontWeight: 800, background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: 5 }}>
                -{Math.round(((item.comparePrice - item.price) / item.comparePrice) * 100)}%
              </span>
            </>
          )}
        </div>

        {saving > 0 && (
          <div style={{ fontSize: 10.5, color: '#059669', fontWeight: 700, marginTop: 3 }}>
            🏷 Спестяваш {fmt(saving)}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#f8fafc', borderRadius: 10, padding: '3px', border: '1px solid #f1f5f9' }}>
          <button onClick={() => onUpdateQty(item.variantId, item.qty - 1)}
            style={{ width: 28, height: 28, border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e2e8f0' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>−</button>
          <span style={{ fontSize: 13, fontWeight: 800, minWidth: 22, textAlign: 'center' as const, color: '#0f172a' }}>{item.qty}</span>
          <button onClick={() => onUpdateQty(item.variantId, item.qty + 1)}
            style={{ width: 28, height: 28, border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e2e8f0' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>+</button>
        </div>
        <button onClick={() => onRemove(item.variantId)}
          style={{ fontSize: 10.5, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '2px 6px', borderRadius: 6, transition: 'color .15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#dc2626' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}>Премахни</button>
      </div>
    </div>
  )
}

// ─── Offers Section (collapsible, compact) ────────────────────────────────────

// ─── Offers Group — compact, no accordion ──────────────────────────────────────

function OffersGroup({
  upsellOffers, crossSellOffers, products, onAddToCart, fmt, cartItems,
}: {
  upsellOffers: UpsellOffer[]
  crossSellOffers: UpsellOffer[]
  products: AtlasProduct[]
  onAddToCart: (item: CartItem) => void
  fmt: (n: number) => string
  cartItems: CartItem[]
}) {
  const allOffers = [...upsellOffers, ...crossSellOffers]
  if (allOffers.length === 0) return null

  return (
    <div style={{
      background: 'linear-gradient(135deg,#fafafa,#f8f9ff)',
      border: '1px solid #f0f0f8',
      borderRadius: 16, padding: '12px', marginBottom: 12,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800, color: '#94a3b8',
        textTransform: 'uppercase' as const, letterSpacing: '0.09em',
        marginBottom: 8,
      }}>✨ Може да те заинтересува</div>
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 7 }}>
        {allOffers.map(offer => (
          <OfferCard key={offer.id} offer={offer} products={products} onAddToCart={onAddToCart} fmt={fmt} cartItems={cartItems} />
        ))}
      </div>
    </div>
  )
}

// ─── Cart Drawer ──────────────────────────────────────────────────────────────

function CartDrawer({
  items, shippingPrice, freeShippingAbove, sitePhone,
  onClose, onUpdateQty, onRemove, onAddToCart, onClearCart, products, marketingSettings, currencySymbol,
}: {
  items: CartItem[]; shippingPrice: number; freeShippingAbove: number; sitePhone: string
  onClose: () => void
  onUpdateQty: (id: string, qty: number) => void
  onRemove: (id: string) => void
  onAddToCart: (item: CartItem) => void
  onClearCart: () => void
  products: AtlasProduct[]
  marketingSettings: MarketingSettings | null
  currencySymbol?: string
}) {
  const [step, setStep]           = useState<'cart' | 'checkout'>('cart')
  const [form, setForm]           = useState({ name: '', phone: '', city: '', address: '', notes: '', courier: 'econt' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]           = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [error, setError]         = useState('')
  const [postPurchaseOffer, setPostPurchaseOffer] = useState<UpsellOffer | null>(null)
  const [mounted, setMounted]     = useState(false)

  // Mount for portal
  useEffect(() => { setMounted(true) }, [])

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const { fmt, fmtLiter } = makeFmt(currencySymbol ?? '€')

  const subtotal    = items.reduce((s, i) => s + i.price * i.qty, 0)
  const totalSavings = items.reduce((s, i) => {
    return i.comparePrice > i.price ? s + (i.comparePrice - i.price) * i.qty : s
  }, 0)
  const shipping    = subtotal >= freeShippingAbove ? 0 : shippingPrice
  const total       = subtotal + shipping
  const totalLiters = items.reduce((s, i) => s + i.size_liters * i.qty, 0)
  const ms          = marketingSettings

  // Разделяме уpsell и cross-sell визуално
  const upsellOffers: UpsellOffer[] = ms?.upsell_enabled
    ? ms.offers.filter(o => o.type === 'cart_upsell' && offerMatches(o, items, subtotal)) : []
  const crossSellOffers: UpsellOffer[] = ms?.cross_sell_enabled
    ? ms.offers.filter(o => o.type === 'cross_sell' && offerMatches(o, items, subtotal)) : []

  const handleOrder = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.city.trim() || !form.address.trim()) {
      setError('Моля попълни всички задължителни полета (имена, телефон, град, адрес).'); return
    }
    setSubmitting(true); setError('')
    try {
      const orderItems = items.map(i => ({
        product_name: `${i.productName} — ${i.variantLabel}`,
        quantity:    i.qty,
        unit_price:  i.price,
        total_price: +(i.price * i.qty).toFixed(2),
      }))
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: form.name.trim(), customer_phone: form.phone.trim(),
          customer_city: form.city.trim(), customer_address: form.address.trim(),
          customer_notes: form.notes.trim() || null,
          courier: form.courier, payment_method: 'cod',
          items: orderItems, subtotal: +subtotal.toFixed(2),
          shipping: +shipping.toFixed(2), total: +total.toFixed(2),
        }),
      })
      if (!res.ok) {
        let errMsg = `Грешка ${res.status}`
        try { const errData = await res.json(); errMsg = errData.error || errMsg } catch {}
        throw new Error(errMsg)
      }
      const data = await res.json()
      setOrderNumber(data.order_number || '')
      setDone(true)
      onClearCart()
      if (ms?.post_purchase_enabled) {
        const pp = ms.offers.filter(o => o.type === 'post_purchase' && offerMatches(o, items, subtotal))
        if (pp.length > 0) {
          setTimeout(() => setPostPurchaseOffer(pp[0]), Math.max(0, (ms.post_purchase_delay ?? 2)) * 1000)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Грешка при изпращане. Моля опитай отново.')
    } finally { setSubmitting(false) }
  }

  const drawerContent = (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');
        .cart-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:2147483646;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
        .cart-drawer{position:fixed;right:0;top:0;bottom:0;width:100%;max-width:480px;background:#fff;z-index:2147483647;display:flex;flex-direction:column;box-shadow:-20px 0 80px rgba(0,0,0,.2);animation:slideIn .3s cubic-bezier(.4,0,.2,1);font-family:'Outfit','DM Sans',sans-serif}
        @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        .cart-inner{flex:1;overflow-y:auto;padding:20px 22px;overscroll-behavior:contain}
        .cart-inner::-webkit-scrollbar{width:4px}
        .cart-inner::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:99px}
        .cart-footer{padding:16px 22px 22px;border-top:1.5px solid #f1f5f9;background:#fff}
        .cart-input{width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:12px;font-family:inherit;font-size:14px;outline:none;box-sizing:border-box;margin-bottom:10px;color:#0f172a;background:#fff;transition:border-color .15s,box-shadow .15s}
        .cart-input:focus{border-color:#16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.1)}
        .cart-input::placeholder{color:#cbd5e1}
        .cart-btn-primary{width:100%;padding:15px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border:none;border-radius:14px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;transition:all .2s;box-shadow:0 4px 16px rgba(22,163,74,.3);letter-spacing:-.01em}
        .cart-btn-primary:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}
        .cart-btn-primary:hover:not(:disabled){filter:brightness(1.05);transform:translateY(-1px);box-shadow:0 8px 24px rgba(22,163,74,.4)}
        .cart-btn-secondary{width:100%;padding:12px;background:#f8fafc;color:#64748b;border:1.5px solid #f1f5f9;border-radius:14px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;margin-top:8px;transition:all .15s}
        .cart-btn-secondary:hover{background:#f1f5f9;color:#0f172a}
        .cart-close-btn{width:40px;height:40px;border:none;background:#f1f5f9;border-radius:12px;cursor:pointer;font-size:18px;color:#475569;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0;line-height:1}
        .cart-close-btn:hover{background:#e2e8f0;color:#0f172a;transform:scale(1.08)}
        @media(max-width:480px){.cart-drawer{max-width:100%}}
      `}</style>

      {postPurchaseOffer && (
        <PostPurchaseModal
          offer={postPurchaseOffer} products={products} customerData={form}
          onAccept={() => setPostPurchaseOffer(null)} onDismiss={() => setPostPurchaseOffer(null)}
          fmt={fmt}
        />
      )}

      <div className="cart-overlay" onClick={onClose} />
      <div className="cart-drawer">
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1.5px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: done ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#0f172a,#1e293b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
              {done ? '✅' : step === 'cart' ? '🛒' : '📦'}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', letterSpacing: '-.01em' }}>
                {done ? 'Поръчката е приета!' : step === 'cart' ? 'Количка' : 'Финализирай поръчката'}
              </div>
              {!done && step === 'cart' && items.length > 0 && (
                <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>
                  {items.length} {items.length === 1 ? 'продукт' : 'продукта'}
                  {totalSavings > 0 && <span style={{ color: '#dc2626', fontWeight: 700 }}> · спестяваш {fmt(totalSavings)}</span>}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="cart-close-btn" aria-label="Затвори количката">✕</button>
        </div>

        {/* ── Успех ── */}
        {done ? (
          <div className="cart-inner" style={{ textAlign: 'center', paddingTop: 56 }}>
            <div style={{ fontSize: 68, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 800, marginBottom: 12, color: '#111' }}>Благодаря!</h2>
            {orderNumber && (
              <div style={{ display: 'inline-block', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '8px 18px', marginBottom: 14, fontSize: 13, fontWeight: 700, color: '#166534' }}>
                Поръчка №{orderNumber}
              </div>
            )}
            <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
              Поръчката ти е получена. Ще се свържем с теб скоро за потвърждение.
            </p>
            <p style={{ fontSize: 14, color: '#374151' }}>
              📞 При въпроси: <a href={`tel:${sitePhone}`} style={{ color: '#16a34a', fontWeight: 700 }}>{sitePhone}</a>
            </p>
          </div>

        /* ── Количка ── */
        ) : step === 'cart' ? (
          <>
            {/* Scrollable items area with max height */}
            <div className="cart-inner" style={{ maxHeight: 'calc(100vh - 420px)', minHeight: 80 }}>
              {items.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: 64, paddingBottom: 32 }}>
                  <div style={{ fontSize: 56, marginBottom: 16 }}>🛒</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Количката е празна</div>
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>Разгледай продуктите и добави нещо</div>
                </div>
              ) : items.map(item => (
                <CartItemRow
                  key={item.variantId}
                  item={item}
                  onUpdateQty={onUpdateQty}
                  onRemove={onRemove}
                  fmt={fmt}
                />
              ))}
            </div>

            {items.length > 0 && (
              <div className="cart-footer">
                {/* Анализ на почвата banner */}
                {totalLiters >= 60 ? (
                  <div style={{ background: 'linear-gradient(135deg,#14532d,#166534)', borderRadius: 10, padding: '11px 13px', marginBottom: 10, display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>🔬</span>
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: '#86efac', marginBottom: 2 }}>БЕЗПЛАТЕН АНАЛИЗ НА ПОЧВАТА!</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.8)', lineHeight: 1.4 }}>С тази поръчка ({totalLiters}л) получаваш безплатен почвен, листен и воден анализ.</div>
                    </div>
                  </div>
                ) : totalLiters > 0 ? (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '9px 12px', marginBottom: 10, display: 'flex', gap: 9, alignItems: 'center' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>🔬</span>
                    <div style={{ fontSize: 11.5, color: '#166534', lineHeight: 1.4 }}>
                      Добави още <strong>{60 - totalLiters}л</strong> и получи <strong>безплатен анализ на почвата</strong>!
                    </div>
                  </div>
                ) : null}

                {/* Offers — upsell + cross-sell combined */}
                <OffersGroup
                  upsellOffers={upsellOffers}
                  crossSellOffers={crossSellOffers}
                  products={products}
                  onAddToCart={onAddToCart}
                  fmt={fmt}
                  cartItems={items}
                />

                {/* Обобщение на цените */}
                <div style={{ background: '#f8fafc', borderRadius: 14, padding: '14px 16px', marginBottom: 14, border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                    <span>Продукти</span><span>{fmt(subtotal)}</span>
                  </div>
                  {totalSavings > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: '#059669', fontWeight: 700 }}>
                      <span>🏷 Спестяваш</span><span>-{fmt(totalSavings)}</span>
                    </div>
                  )}

                  {/* Доставка ред с вграден мини прогрес бар */}
                  <div style={{ borderTop: totalSavings > 0 ? '1px solid #f1f5f9' : 'none', paddingTop: totalSavings > 0 ? 8 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: shipping === 0 ? 0 : 5, fontSize: 13 }}>
                      <span style={{ color: '#64748b', fontWeight: 500 }}>🚚 Доставка</span>
                      <span>
                        {shipping === 0
                          ? <span style={{ color: '#16a34a', fontWeight: 800 }}>Безплатна 🎉</span>
                          : <span style={{ fontWeight: 700, color: '#0f172a' }}>{fmt(shipping)}</span>
                        }
                      </span>
                    </div>
                    {shipping > 0 && (() => {
                      const goal = ms?.progress_bar_enabled ? (ms.progress_goal_amount || freeShippingAbove) : freeShippingAbove
                      const pct  = Math.min(100, (subtotal / goal) * 100)
                      const left = goal - subtotal
                      return (
                        <div>
                          <div style={{ background: 'rgba(0,0,0,.06)', borderRadius: 99, height: 5, overflow: 'hidden', marginBottom: 4 }}>
                            <div style={{
                              width: `${pct}%`, height: '100%',
                              background: 'linear-gradient(90deg,#16a34a,#4ade80)',
                              borderRadius: 99,
                              transition: 'width .6s cubic-bezier(.4,0,.2,1)',
                            }} />
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Добави още <strong style={{ color: '#16a34a' }}>{fmt(left)}</strong> за безплатна</span>
                            <span>{fmt(goal)}</span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-.02em' }}>
                  <span>Общо</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#16a34a' }}>{fmt(total)}</div>
                    {totalSavings > 0 && (
                      <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>
                        Пести {fmt(totalSavings)} спрямо редовна цена
                      </div>
                    )}
                  </div>
                </div>

                <button className="cart-btn-primary" onClick={() => setStep('checkout')}>Продължи към поръчка →</button>
              </div>
            )}
          </>

        /* ── Checkout ── */
        ) : (
          <>
            <div className="cart-inner">
              {/* COD banner */}
              <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1.5px solid #bbf7d0', borderRadius: 14, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>💵</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#15803d' }}>Наложен платеж</div>
                  <div style={{ fontSize: 11.5, color: '#166534', marginTop: 1 }}>Плащаш само при получаване — без предплащане</div>
                </div>
              </div>

              {/* Section: Данни за доставка */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 }}>👤 Данни за доставка</div>
                <input className="cart-input" placeholder="Имена *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <input className="cart-input" placeholder="Телефон *" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="cart-input" placeholder="Град *" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} style={{ flex: 1 }} />
                  <input className="cart-input" placeholder="Адрес *" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={{ flex: 2 }} />
                </div>
              </div>

              {/* Section: Куриер */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 10 }}>🚚 Куриер</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ value: 'econt', label: 'Еконт', emoji: '📦' }, { value: 'speedy', label: 'Спиди', emoji: '🚀' }].map(c => (
                    <button key={c.value} onClick={() => setForm(f => ({ ...f, courier: c.value }))}
                      style={{
                        flex: 1, padding: '12px 10px',
                        border: `2px solid ${form.courier === c.value ? '#16a34a' : '#e5e7eb'}`,
                        borderRadius: 12,
                        background: form.courier === c.value ? 'linear-gradient(135deg,#f0fdf4,#dcfce7)' : '#fafafa',
                        cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 14,
                        color: form.courier === c.value ? '#15803d' : '#374151',
                        transition: 'all .15s',
                        display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4,
                        boxShadow: form.courier === c.value ? '0 0 0 3px rgba(22,163,74,.1)' : 'none',
                      }}>
                      <span style={{ fontSize: 22 }}>{c.emoji}</span>
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Бележки */}
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 10 }}>💬 Бележки (по желание)</div>
                <textarea className="cart-input" placeholder="Допълнителни инструкции, пожелания..." rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>

              {error && (
                <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 12, padding: '12px 16px', fontSize: 13, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start', lineHeight: 1.5, border: '1px solid #fecaca' }}>
                  <span style={{ flexShrink: 0, fontSize: 16 }}>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* ── Резюме на поръчката — красиво и елегантно ── */}
              <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', borderRadius: 20, overflow: 'hidden', marginTop: 8, marginBottom: 4 }}>
                {/* Header */}
                <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.5)', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>📋 Резюме на поръчката</div>
                </div>

                {/* Products list */}
                <div style={{ padding: '12px 20px' }}>
                  {items.map((i, idx) => (
                    <div key={i.variantId} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      paddingBottom: idx < items.length - 1 ? 10 : 0,
                      marginBottom: idx < items.length - 1 ? 10 : 0,
                      borderBottom: idx < items.length - 1 ? '1px solid rgba(255,255,255,.06)' : 'none',
                    }}>
                      {/* Product image */}
                      <div style={{
                        width: 52, height: 52, flexShrink: 0, borderRadius: 12,
                        overflow: 'hidden', background: 'rgba(255,255,255,.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px solid rgba(255,255,255,.1)',
                      }}>
                        {i.img
                          ? <img src={i.img} alt={i.productName} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }} />
                          : <span style={{ fontSize: 24 }}>{i.emoji}</span>}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.productName}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>{i.variantLabel} · ×{i.qty}</div>
                        {i.comparePrice > i.price && (
                          <div style={{ fontSize: 10.5, color: '#4ade80', fontWeight: 700, marginTop: 2 }}>
                            🏷 спестяваш {fmt((i.comparePrice - i.price) * i.qty)}
                          </div>
                        )}
                      </div>
                      {/* Price */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: '#4ade80' }}>{fmt(i.price * i.qty)}</div>
                        {i.comparePrice > i.price && (
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', textDecoration: 'line-through', marginTop: 1 }}>{fmt(i.comparePrice * i.qty)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div style={{ background: 'rgba(0,0,0,.25)', padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
                  {totalSavings > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#4ade80', fontWeight: 700, marginBottom: 8 }}>
                      <span>🏷 Спестяваш</span>
                      <span>-{fmt(totalSavings)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(255,255,255,.6)', marginBottom: 10, alignItems: 'center' }}>
                    <span>🚚 Доставка ({form.courier === 'econt' ? 'Еконт' : 'Спиди'})</span>
                    <span>
                      {shipping === 0
                        ? <span style={{ color: '#4ade80', fontWeight: 800 }}>Безплатна 🎉</span>
                        : <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{fmt(shipping)}</span>
                      }
                    </span>
                  </div>
                  {shipping > 0 && (
                    <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600, marginBottom: 10, background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 8, padding: '6px 12px' }}>
                      💡 Добави {fmt(freeShippingAbove - subtotal)} още за безплатна доставка
                    </div>
                  )}
                  {/* Total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid rgba(255,255,255,.1)', paddingTop: 12 }}>
                    <span style={{ fontWeight: 800, fontSize: 16, color: '#f1f5f9' }}>Общо</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, fontSize: 24, color: '#4ade80', lineHeight: 1 }}>{fmt(total)}</div>
                      {totalSavings > 0 && (
                        <div style={{ fontSize: 10.5, color: '#fca5a5', fontWeight: 700, marginTop: 3 }}>
                          Пести {fmt(totalSavings)} спрямо редовна цена
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="cart-footer">
              <button className="cart-btn-primary" onClick={handleOrder} disabled={submitting}>
                {submitting ? '⏳ Изпращане...' : `✅ Потвърди поръчката — ${fmt(total)}`}
              </button>
              <button className="cart-btn-secondary" onClick={() => { setError(''); setStep('cart') }}>← Назад към количката</button>
            </div>
          </>
        )}
      </div>
    </>
  )

  if (!mounted) return null
  return createPortal(drawerContent, document.body)
}

// ─── MAIN CartSystem ──────────────────────────────────────────────────────────

export function CartSystem({ atlasProducts, shippingPrice, freeShippingAbove, siteEmail, sitePhone, currencySymbol }: Props) {
  const [cartItems, setCartItems]               = useState<CartItem[]>([])
  const [drawerOpen, setDrawerOpen]             = useState(false)
  const [marketingSettings, setMarketingSettings] = useState<MarketingSettings | null>(null)
  const [hydrated, setHydrated]                 = useState(false)

  useEffect(() => {
    const saved = loadCartFromStorage()
    if (saved.length > 0) setCartItems(saved)
    setHydrated(true)
  }, [])

  useEffect(() => {
    fetch('/api/marketing', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setMarketingSettings(data) })
      .catch(() => {})
  }, [])

  const addToCart = useCallback((item: CartItem) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.variantId === item.variantId)
      const next = existing
        ? prev.map(i => i.variantId === item.variantId ? { ...i, qty: i.qty + 1 } : i)
        : [...prev, item]
      saveCartToStorage(next)
      return next
    })
    setDrawerOpen(true)
  }, [])

  const updateQty = useCallback((variantId: string, qty: number) => {
    setCartItems(prev => {
      const next = qty <= 0
        ? prev.filter(i => i.variantId !== variantId)
        : prev.map(i => i.variantId === variantId ? { ...i, qty } : i)
      saveCartToStorage(next)
      return next
    })
  }, [])

  const removeItem = useCallback((variantId: string) => {
    setCartItems(prev => {
      const next = prev.filter(i => i.variantId !== variantId)
      saveCartToStorage(next)
      return next
    })
  }, [])

  const clearCart = useCallback(() => {
    setCartItems([])
    clearCartStorage()
  }, [])

  const totalItems = cartItems.reduce((s, i) => s + i.qty, 0)
  const { fmt, fmtLiter } = makeFmt(currencySymbol ?? '€')

  // Listen for header cart button click
  useEffect(() => {
    const handler = () => setDrawerOpen(true)
    window.addEventListener('cart:open', handler)
    return () => window.removeEventListener('cart:open', handler)
  }, [])

  // Dispatch cart count to header whenever it changes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('cart:count', { detail: totalItems }))
  }, [totalItems])

  if (!hydrated) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
      {atlasProducts.map(product => (
        <ProductCard key={product.id} product={product} onAddToCart={addToCart} fmt={fmt} fmtLiter={fmtLiter} />
      ))}
    </div>
  )

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        {atlasProducts.map(product => (
          <ProductCard key={product.id} product={product} onAddToCart={addToCart} fmt={fmt} fmtLiter={fmtLiter} />
        ))}
      </div>

      {drawerOpen && (
        <CartDrawer
          items={cartItems}
          shippingPrice={shippingPrice}
          freeShippingAbove={freeShippingAbove}
          sitePhone={sitePhone}
          onClose={() => setDrawerOpen(false)}
          onUpdateQty={updateQty}
          onRemove={removeItem}
          onAddToCart={addToCart}
          onClearCart={clearCart}
          products={atlasProducts}
          marketingSettings={marketingSettings}
          currencySymbol={currencySymbol}
        />
      )}
    </>
  )
}
