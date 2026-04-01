'use client'
// components/client/CartSystem.tsx — ФИКС v2
// Поправки:
// 1. ❌ Махнат import от admin компонент (причиняваше webpack crash)
//    → Типовете са дефинирани локално тук
// 2. ❌ 500 грешка при поръчка — items полетата бяха объркани
//    → Правилна структура: product_name, quantity, unit_price, total_price
// 3. ❌ Количката се губеше при refresh
//    → localStorage persistence с 7-дневен TTL
// 4. ✅ По-добри error messages при неуспешна поръчка

import { useState, useCallback, useEffect } from 'react'

// ─── Типове (НЕ се импортират от admin!) ─────────────────────────────────────

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
  variantLabel: string; price: number; qty: number
  emoji: string; img: string; size_liters: number
}

interface Props {
  atlasProducts: AtlasProduct[]
  shippingPrice: number
  freeShippingAbove: number
  siteEmail: string
  sitePhone: string
  currencySymbol?: string  // от settings.currency_symbol — по подразбиране '€'
}

// ─── localStorage Cart Persistence ───────────────────────────────────────────

const CART_KEY = 'denny_cart_v2'
const CART_TTL = 7 * 24 * 60 * 60 * 1000 // 7 дни

function loadCartFromStorage(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Date.now() - (parsed.savedAt || 0) > CART_TTL) {
      localStorage.removeItem(CART_KEY)
      return []
    }
    return Array.isArray(parsed.items) ? parsed.items : []
  } catch {
    return []
  }
}

function saveCartToStorage(items: CartItem[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CART_KEY, JSON.stringify({ items, savedAt: Date.now() }))
  } catch {}
}

function clearCartStorage() {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(CART_KEY) } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// currency symbol се задава от CartSystem компонента чрез setCurrencySymbol()
// никога повече хардкодирано 'лв.' — идва от settings.currency_symbol в БД
let _currencySymbol = '€'
const fmt = (n: number) => n.toFixed(2) + ' ' + _currencySymbol
const fmtLiter = (n: number) => n.toFixed(2) + ' ' + _currencySymbol + '/л'

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

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function CartProgressBar({ current, goal, label }: { current: number; goal: number; label: string }) {
  const pct = Math.min(100, (current / goal) * 100)
  const left = goal - current
  const done = current >= goal

  return (
    <div style={{
      background: done ? 'linear-gradient(135deg,#14532d,#166534)' : '#f0fdf4',
      border: done ? 'none' : '1px solid #bbf7d0',
      borderRadius: 10, padding: '10px 13px', marginBottom: 12, transition: 'all .3s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12.5 }}>
        <span style={{ fontWeight: 700, color: done ? '#86efac' : '#166534' }}>
          {done ? `🎉 ${label} отключена!` : `🚚 ${label}`}
        </span>
        {!done && <span style={{ color: '#6b7280', fontSize: 11.5 }}>остават {fmt(left)}</span>}
      </div>
      <div style={{ background: done ? 'rgba(255,255,255,.15)' : '#dcfce7', borderRadius: 99, height: 7, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: done ? 'linear-gradient(90deg,#4ade80,#86efac)' : 'linear-gradient(90deg,#16a34a,#4ade80)', borderRadius: 99, transition: 'width .5s cubic-bezier(.4,0,.2,1)' }} />
      </div>
    </div>
  )
}

// ─── Inline Upsell/Cross-sell Card ───────────────────────────────────────────

function InlineOfferCard({
  offer, products, onAddToCart,
}: { offer: UpsellOffer; products: AtlasProduct[]; onAddToCart: (item: CartItem) => void }) {
  const product = products.find(p => p.id === offer.offer_product_id)
  const variant = product?.variants?.find(v => v.active !== false)
  const [added, setAdded] = useState(false)

  const discountedPrice = variant && offer.discount_pct
    ? +(variant.price * (1 - offer.discount_pct / 100)).toFixed(2)
    : variant?.price ?? 0

  const colorMap: Record<UpsellOffer['type'], string> = {
    cart_upsell: '#7c3aed', cross_sell: '#0369a1', post_purchase: '#dc2626',
  }
  const c = colorMap[offer.type]

  const handleAdd = () => {
    if (!product || !variant) return
    onAddToCart({
      productId: product.id, variantId: variant.id, productName: product.name,
      variantLabel: variant.label + (offer.discount_pct ? ` (-${offer.discount_pct}%)` : ''),
      price: discountedPrice, qty: 1, emoji: product.emoji,
      img: product.img || '', size_liters: variant.size_liters,
    })
    setAdded(true)
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: `linear-gradient(135deg,${c}08,${c}03)`, border: `1.5px solid ${c}25`, borderRadius: 14, padding: '12px 14px', marginBottom: 8 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, overflow: 'hidden', background: c + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, border: `1px solid ${c}20` }}>
        {(offer as any).image_url ? <img src={(offer as any).image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : offer.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>{offer.title}</span>
          {offer.badge_text && (
            <span style={{ fontSize: 9.5, fontWeight: 900, color: '#fff', background: offer.badge_color || c, padding: '2px 7px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {offer.badge_text}
            </span>
          )}
        </div>
        {offer.description && <div style={{ fontSize: 11.5, color: '#6b7280', lineHeight: 1.4, marginBottom: 3 }}>{offer.description}</div>}
        {product && variant && (
          <div style={{ fontSize: 12, fontWeight: 700, color: c }}>
            {offer.discount_pct ? (
              <><span style={{ textDecoration: 'line-through', color: '#9ca3af', fontWeight: 500 }}>{fmt(variant.price)}</span>{' '}{fmt(discountedPrice)}{' '}<span style={{ background: '#fee2e2', color: '#dc2626', padding: '1px 5px', borderRadius: 5, fontSize: 10 }}>-{offer.discount_pct}%</span></>
            ) : fmt(variant.price)}
          </div>
        )}
        {!product && offer.offer_product_id && <div style={{ fontSize: 11, color: '#f59e0b' }}>⚠️ Продуктът не е намерен</div>}
      </div>
      <button
        onClick={handleAdd}
        disabled={added || !product || !variant}
        style={{ padding: '7px 13px', background: added ? '#059669' : (!product || !variant) ? '#d1d5db' : c, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: added || !product || !variant ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0, transition: 'background .2s', whiteSpace: 'nowrap' }}
      >
        {added ? '✓ Добавено' : '+ Добави'}
      </button>
    </div>
  )
}

// ─── Post-purchase Modal ──────────────────────────────────────────────────────

function PostPurchaseModal({
  offer, products, onAccept, onDismiss, customerData,
}: {
  offer: UpsellOffer; products: AtlasProduct[]
  onAccept: () => void; onDismiss: () => void
  customerData: { name: string; phone: string; city: string; address: string; notes: string; courier: string }
}) {
  const product = products.find(p => p.id === offer.offer_product_id)
  const variant = product?.variants?.find(v => v.active !== false)
  const [adding, setAdding] = useState(false)
  const [done, setDone] = useState(false)

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
          customer_name:    customerData.name,
          customer_phone:   customerData.phone,
          customer_city:    customerData.city,
          customer_address: customerData.address,
          customer_notes:   `[POST-PURCHASE UPSELL] ${customerData.notes}`.trim(),
          courier:          customerData.courier,
          payment_method:   'cod',
          items: [{
            product_name: `${product.name} — ${variant.label} (Post-purchase upsell)`,
            quantity:     1,
            unit_price:   discountedPrice,
            total_price:  discountedPrice,
          }],
          subtotal: discountedPrice,
          shipping: 0,
          total:    discountedPrice,
        }),
      })
      setDone(true)
      setTimeout(onAccept, 1800)
    } catch {
      onDismiss()
    } finally {
      setAdding(false)
    }
  }

  return (
    <>
      <style>{`@keyframes ppIn{from{transform:translateY(40px) scale(.95);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}`}</style>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 600, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
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
                    {offer.discount_pct ? <><span style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'line-through' }}>{fmt(variant.price)}</span><span style={{ fontSize: 10, fontWeight: 800, background: '#fee2e2', color: '#dc2626', padding: '2px 6px', borderRadius: 6 }}>-{offer.discount_pct}%</span></> : null}
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

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ product, onAddToCart }: { product: AtlasProduct; onAddToCart: (item: CartItem) => void }) {
  const variants = (product.variants || []).filter(v => v.active !== false)
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id || '')
  const [added, setAdded] = useState(false)
  const selectedVariant = variants.find(v => v.id === selectedVariantId) ?? variants[0]
  const discount = selectedVariant && selectedVariant.compare_price > selectedVariant.price
    ? Math.round(((selectedVariant.compare_price - selectedVariant.price) / selectedVariant.compare_price) * 100) : 0

  const handleAdd = () => {
    if (!selectedVariant) return
    onAddToCart({
      productId: product.id, variantId: selectedVariant.id,
      productName: product.name, variantLabel: selectedVariant.label,
      price: selectedVariant.price, qty: 1, emoji: product.emoji,
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
                const sel = v.id === selectedVariantId
                const savePct = v.compare_price > v.price ? Math.round(((v.compare_price - v.price) / v.compare_price) * 100) : 0
                return (
                  <button key={v.id} onClick={() => setSelectedVariantId(v.id)}
                    style={{ flex: '1 1 calc(50% - 4px)', padding: '10px 12px', borderRadius: 12, border: sel ? '2px solid #16a34a' : '1.5px solid #e5e7eb', background: sel ? '#f0fdf4' : '#fafafa', cursor: 'pointer', textAlign: 'left', transition: 'all .15s', fontFamily: 'inherit' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: sel ? '#15803d' : '#374151' }}>{v.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: sel ? '#16a34a' : '#111', marginTop: 2 }}>{fmt(v.price)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: '#9ca3af', textDecoration: 'line-through' }}>{fmt(v.compare_price)}</span>
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
              {selectedVariant.compare_price > selectedVariant.price && <div style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'line-through' }}>{fmt(selectedVariant.compare_price)}</div>}
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

// ─── Cart Drawer ──────────────────────────────────────────────────────────────

function CartDrawer({
  items, shippingPrice, freeShippingAbove, sitePhone,
  onClose, onUpdateQty, onRemove, onAddToCart, onClearCart, products, marketingSettings,
}: {
  items: CartItem[]; shippingPrice: number; freeShippingAbove: number; sitePhone: string
  onClose: () => void
  onUpdateQty: (id: string, qty: number) => void
  onRemove: (id: string) => void
  onAddToCart: (item: CartItem) => void
  onClearCart: () => void
  products: AtlasProduct[]
  marketingSettings: MarketingSettings | null
}) {
  const [step, setStep] = useState<'cart' | 'checkout'>('cart')
  const [form, setForm] = useState({ name: '', phone: '', city: '', address: '', notes: '', courier: 'econt' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [error, setError] = useState('')
  const [postPurchaseOffer, setPostPurchaseOffer] = useState<UpsellOffer | null>(null)

  const subtotal    = items.reduce((s, i) => s + i.price * i.qty, 0)
  const shipping    = subtotal >= freeShippingAbove ? 0 : shippingPrice
  const total       = subtotal + shipping
  const totalLiters = items.reduce((s, i) => s + i.size_liters * i.qty, 0)
  const ms          = marketingSettings

  const inlineOffers: UpsellOffer[] = ms ? [
    ...(ms.upsell_enabled     ? ms.offers.filter(o => o.type === 'cart_upsell' && offerMatches(o, items, subtotal)) : []),
    ...(ms.cross_sell_enabled ? ms.offers.filter(o => o.type === 'cross_sell'  && offerMatches(o, items, subtotal)) : []),
  ] : []

  const handleOrder = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.city.trim() || !form.address.trim()) {
      setError('Моля попълни всички задължителни полета (имена, телефон, град, адрес).')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      // ── Правилна структура на items ──────────────────────────────────────
      const orderItems = items.map(i => ({
        product_name: `${i.productName} — ${i.variantLabel}`,
        quantity:     i.qty,
        unit_price:   i.price,
        total_price:  +(i.price * i.qty).toFixed(2),
      }))

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name:    form.name.trim(),
          customer_phone:   form.phone.trim(),
          customer_city:    form.city.trim(),
          customer_address: form.address.trim(),
          customer_notes:   form.notes.trim() || null,
          courier:          form.courier,
          payment_method:   'cod',
          items:            orderItems,
          subtotal:         +subtotal.toFixed(2),
          shipping:         +shipping.toFixed(2),
          total:            +total.toFixed(2),
        }),
      })

      // ── Детайлна грешка ──────────────────────────────────────────────────
      if (!res.ok) {
        let errMsg = `Грешка ${res.status}`
        try {
          const errData = await res.json()
          errMsg = errData.error || errMsg
        } catch {}
        throw new Error(errMsg)
      }

      const data = await res.json()
      setOrderNumber(data.order_number || '')
      setDone(true)

      // Изчисти количката от localStorage
      onClearCart()

      // Post-purchase оферта
      if (ms?.post_purchase_enabled) {
        const pp = ms.offers.filter(o => o.type === 'post_purchase' && offerMatches(o, items, subtotal))
        if (pp.length > 0) {
          setTimeout(() => setPostPurchaseOffer(pp[0]), Math.max(0, (ms.post_purchase_delay ?? 2)) * 1000)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Грешка при изпращане. Моля опитай отново.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <style>{`
        .cart-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:500;backdrop-filter:blur(3px)}
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');
        .cart-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:500;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
        .cart-drawer{position:fixed;right:0;top:0;bottom:0;width:100%;max-width:480px;background:#fff;z-index:501;display:flex;flex-direction:column;box-shadow:-20px 0 80px rgba(0,0,0,.2);animation:slideIn .3s cubic-bezier(.4,0,.2,1);font-family:'Outfit','DM Sans',sans-serif}
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
        .cart-item{display:flex;gap:14px;padding:14px 0;border-bottom:1px solid #f8fafc;align-items:center}
        .cart-item:last-child{border-bottom:none}
        @media(max-width:480px){.cart-drawer{max-width:100%}}
      `}</style>

      {postPurchaseOffer && (
        <PostPurchaseModal
          offer={postPurchaseOffer} products={products} customerData={form}
          onAccept={() => setPostPurchaseOffer(null)} onDismiss={() => setPostPurchaseOffer(null)}
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
                {done ? 'Поръчката е приета!' : step === 'cart' ? `Количка` : 'Финализирай поръчката'}
              </div>
              {!done && step === 'cart' && items.length > 0 && <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>{items.length} {items.length === 1 ? 'продукт' : 'продукта'}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, border: 'none', background: '#f8fafc', borderRadius: 10, cursor: 'pointer', fontSize: 15, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}>✕</button>
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
            <div className="cart-inner">
              {items.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: 64, paddingBottom: 32 }}>
                  <div style={{ fontSize: 56, marginBottom: 16 }}>🛒</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Количката е празна</div>
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>Разгледай продуктите и добави нещо</div>
                </div>
              ) : items.map(item => (
                <div key={item.variantId} className="cart-item">
                  <div style={{ width: 62, height: 62, flexShrink: 0, borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
                    {item.img ? <img src={item.img} alt={item.productName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 28 }}>{item.emoji}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 2, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.productName}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{item.variantLabel}</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#16a34a', marginTop: 4, letterSpacing: '-.01em' }}>{fmt(item.price * item.qty)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#f8fafc', borderRadius: 10, padding: '3px', border: '1px solid #f1f5f9' }}>
                      <button onClick={() => onUpdateQty(item.variantId, item.qty - 1)} style={{ width: 28, height: 28, border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e2e8f0' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>−</button>
                      <span style={{ fontSize: 13, fontWeight: 800, minWidth: 22, textAlign: 'center' as const, color: '#0f172a' }}>{item.qty}</span>
                      <button onClick={() => onUpdateQty(item.variantId, item.qty + 1)} style={{ width: 28, height: 28, border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e2e8f0' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>+</button>
                    </div>
                    <button onClick={() => onRemove(item.variantId)} style={{ fontSize: 10.5, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '2px 6px', borderRadius: 6, transition: 'color .15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#dc2626' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}>Премахни</button>
                  </div>
                </div>
              ))}
            </div>

            {items.length > 0 && (
              <div className="cart-footer">
                {ms?.progress_bar_enabled && (
                  <CartProgressBar current={subtotal} goal={ms.progress_goal_amount} label={ms.progress_goal_label} />
                )}

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

                {inlineOffers.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>✨ Може да те заинтересува</div>
                    {inlineOffers.map(offer => (
                      <InlineOfferCard key={offer.id} offer={offer} products={products} onAddToCart={onAddToCart} />
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                  <span>Продукти</span><span>{fmt(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                  <span>Доставка</span>
                  <span>{shipping === 0 ? <span style={{ color: '#16a34a', fontWeight: 700 }}>Безплатна 🎉</span> : fmt(shipping)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 20, fontWeight: 900, color: '#0f172a', paddingTop: 10, borderTop: '2px solid #f1f5f9', letterSpacing: '-.02em' }}>
                  <span>Общо</span><span style={{ color: '#16a34a' }}>{fmt(total)}</span>
                </div>
                <button className="cart-btn-primary" onClick={() => setStep('checkout')}>Продължи към поръчка →</button>
              </div>
            )}
          </>

        /* ── Checkout ── */
        ) : (
          <>
            <div className="cart-inner">
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 13px' }}>
                💵 Поръчката е с <strong>наложен платеж</strong>. Плащаш при получаване.
              </div>

              <input className="cart-input" placeholder="Имена *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <input className="cart-input" placeholder="Телефон *" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              <input className="cart-input" placeholder="Град *" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              <input className="cart-input" placeholder="Адрес *" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Куриер</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ value: 'econt', label: '📦 Еконт' }, { value: 'speedy', label: '🚀 Спиди' }].map(c => (
                    <button key={c.value} onClick={() => setForm(f => ({ ...f, courier: c.value }))}
                      style={{ flex: 1, padding: 10, border: `1.5px solid ${form.courier === c.value ? '#16a34a' : '#e5e7eb'}`, borderRadius: 10, background: form.courier === c.value ? '#f0fdf4' : '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, color: form.courier === c.value ? '#15803d' : '#374151', transition: 'all .15s' }}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea className="cart-input" placeholder="Бележки (по желание)" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />

              {error && (
                <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 10, display: 'flex', gap: 8, alignItems: 'flex-start', lineHeight: 1.5 }}>
                  <span style={{ flexShrink: 0 }}>⚠️</span> {error}
                </div>
              )}

              <div style={{ background: '#f8fafc', borderRadius: 16, padding: '16px 18px', marginTop: 4, border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Резюме на поръчката</div>
                {items.map(i => (
                  <div key={i.variantId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5, color: '#374151', gap: 8 }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{i.emoji} {i.productName} {i.variantLabel} ×{i.qty}</span>
                    <span style={{ fontWeight: 700, flexShrink: 0 }}>{fmt(i.price * i.qty)}</span>
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
              <button className="cart-btn-secondary" onClick={() => { setError(''); setStep('cart') }}>← Назад към количката</button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ─── MAIN CartSystem ──────────────────────────────────────────────────────────

export function CartSystem({ atlasProducts, shippingPrice, freeShippingAbove, siteEmail, sitePhone, currencySymbol = '€' }: Props) {
  // Задаваме символа за целия модул при всеки render
  _currencySymbol = currencySymbol

  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [marketingSettings, setMarketingSettings] = useState<MarketingSettings | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // ── Зареди количката от localStorage при mount ───────────────────────────
  useEffect(() => {
    const saved = loadCartFromStorage()
    if (saved.length > 0) setCartItems(saved)
    setHydrated(true)
  }, [])

  // ── Зареди marketing settings ────────────────────────────────────────────
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

  // Не рендирай floating button преди hydration (избягва mismatch)
  if (!hydrated) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
      {atlasProducts.map(product => (
        <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
      ))}
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes pulse{0%,100%{transform:scale(1);box-shadow:0 8px 32px rgba(22,163,74,.4)}50%{transform:scale(1.04);box-shadow:0 12px 40px rgba(22,163,74,.55)}}
      `}</style>

      {totalItems > 0 && !drawerOpen && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 400 }}>
          <button
            onClick={() => setDrawerOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 50, padding: '13px 20px', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 8px 32px rgba(22,163,74,.4)', fontFamily: 'inherit', animation: 'pulse 2s infinite' }}
          >
            🛒 <span>{totalItems} в количката</span>
            <span style={{ background: '#dc2626', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>{totalItems}</span>
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        {atlasProducts.map(product => (
          <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
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
        />
      )}
    </>
  )
}
