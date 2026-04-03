'use client'
// components/client/CartSystem.tsx — v5
// ✅ Drawer top = динамично измерен от долния ръб на .site-header
//    (работи правилно с urgency bar, banners и т.н. независимо от височината им)
// ✅ Cart drawer header по-компактен — по-малко вертикално място
// ✅ Оферта badge в резюмето на Стъпка 2 (показва ✨ Оферта / Кръстосана)
// ✅ Стъпка 2 — по-компактни полета, бутони, резюме
// ✅ Мобилни: цял екран top:0 — хедъра се крие зад drawer-а

import { useState, useCallback, useEffect, useRef } from 'react'

export function CartHeaderButton() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('denny_cart_v2')
      if (raw) {
        const parsed = JSON.parse(raw)
        const total = Array.isArray(parsed.items) ? parsed.items.reduce((s: number, i: any) => s + (i.quantity || i.qty || 0), 0) : 0
        setCount(total)
      }
    } catch {}
    const handler = (e: Event) => setCount((e as CustomEvent).detail)
    window.addEventListener('cart:count', handler)
    return () => window.removeEventListener('cart:count', handler)
  }, [])
  return (
    <button className={`cart-btn${count > 0 ? ' cart-btn--active' : ''}`} onClick={() => window.dispatchEvent(new Event('cart:open'))} aria-label={`Количка${count > 0 ? ` (${count})` : ''}`}>
      🛒 Количка
      {count > 0 && <span className="cart-btn-badge">{count}</span>}
    </button>
  )
}

interface UpsellOffer {
  id: string; type: 'cart_upsell' | 'cross_sell' | 'post_purchase'; active: boolean
  title: string; description: string; emoji: string; image_url?: string
  badge_text?: string; badge_color?: string
  trigger_type: 'always' | 'product_in_cart' | 'cart_above' | 'cart_below'
  trigger_value?: string; offer_product_id?: string; offer_variant_id?: string
  discount_pct?: number; sort_order: number
}
interface MarketingSettings {
  upsell_enabled: boolean; cross_sell_enabled: boolean; post_purchase_enabled: boolean
  progress_bar_enabled: boolean; progress_goal_amount: number; progress_goal_label: string
  post_purchase_delay: number; offers: UpsellOffer[]
}
interface ProductVariant {
  id: string; product_id: string; label: string; size_liters: number
  price: number; compare_price: number; price_per_liter: number; stock: number; active: boolean
}
interface AtlasProduct {
  id: string; name: string; subtitle: string; desc: string; badge: string; emoji: string; img: string
  price: number; comparePrice: number; priceLabel: string; features: string[]; variants?: ProductVariant[]
}
interface CartItem {
  productId: string; variantId: string; productName: string; variantLabel: string
  price: number; comparePrice: number; qty: number; emoji: string; img: string; size_liters: number
  fromOffer?: boolean; offerType?: 'cart_upsell' | 'cross_sell'
}
interface Props {
  atlasProducts: AtlasProduct[]; shippingPrice: number; freeShippingAbove: number
  siteEmail: string; sitePhone: string; currencySymbol?: string
}

const CART_KEY = 'denny_cart_v2'
const CART_TTL = 7 * 24 * 60 * 60 * 1000

function loadCartFromStorage(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Date.now() - (parsed.savedAt || 0) > CART_TTL) { localStorage.removeItem(CART_KEY); return [] }
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
function makeFmt(sym: string) {
  return { fmt: (n: number) => n.toFixed(2) + ' ' + sym, fmtLiter: (n: number) => n.toFixed(2) + ' ' + sym + '/л' }
}
function offerMatches(offer: UpsellOffer, items: CartItem[], subtotal: number): boolean {
  if (!offer.active) return false
  switch (offer.trigger_type) {
    case 'always': return true
    case 'product_in_cart': return items.some(i => i.productId === offer.trigger_value)
    case 'cart_above': return subtotal > Number(offer.trigger_value || 0)
    case 'cart_below': return subtotal < Number(offer.trigger_value || 999999)
    default: return false
  }
}

// ── Динамично измерване на долния ръб на .site-header ──────────────────────
// Работи правилно независимо от urgency bar, banners, etc.
function useHeaderBottom() {
  const [bottom, setBottom] = useState(60)
  useEffect(() => {
    function measure() {
      const header = document.querySelector('.site-header') as HTMLElement | null
      if (header) setBottom(Math.round(header.getBoundingClientRect().bottom))
    }
    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure, { passive: true })
    return () => { window.removeEventListener('scroll', measure); window.removeEventListener('resize', measure) }
  }, [])
  return bottom
}

function useLockBodyScroll(lock: boolean) {
  useEffect(() => {
    if (!lock) return
    const ov = document.body.style.overflow, op = document.body.style.position
    const sy = window.scrollY
    document.body.style.overflow = 'hidden'; document.body.style.position = 'fixed'
    document.body.style.top = `-${sy}px`; document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = ov; document.body.style.position = op
      document.body.style.top = ''; document.body.style.width = ''
      window.scrollTo(0, sy)
    }
  }, [lock])
}

const OFFER_META = {
  cart_upsell:   { color: '#7c3aed', icon: '⬆️' },
  cross_sell:    { color: '#0369a1', icon: '🔀' },
  post_purchase: { color: '#dc2626', icon: '⚡' },
}

function OfferCard({ offer, products, onAddToCart, fmt, cartItems }: { offer: UpsellOffer; products: AtlasProduct[]; onAddToCart: (item: CartItem) => void; fmt: (n: number) => string; cartItems: CartItem[] }) {
  const product = products.find(p => p.id === offer.offer_product_id)
  const variant = product?.variants?.find(v => offer.offer_variant_id ? v.id === offer.offer_variant_id : v.active !== false)
  const meta = OFFER_META[offer.type]
  const alreadyInCart = !!variant && cartItems.some(i => i.variantId === variant.id)
  const [justAdded, setJustAdded] = useState(false)
  const [wasAdded, setWasAdded] = useState(false)
  const imgSrc = offer.image_url || product?.img || ''
  useEffect(() => { if (alreadyInCart) setWasAdded(true); else setWasAdded(false) }, [alreadyInCart])
  const variantPrice = variant?.price ?? 0
  const variantCompare = Number(variant?.compare_price ?? 0)
  const hasPctDiscount = !!(offer.discount_pct && offer.discount_pct > 0)
  const discountedPrice = hasPctDiscount ? +(variantPrice * (1 - offer.discount_pct! / 100)).toFixed(2) : variantPrice
  const oldPrice = hasPctDiscount ? variantPrice : variantCompare > variantPrice ? variantCompare : 0
  const showOld = oldPrice > discountedPrice
  const savePct = showOld && oldPrice > 0 ? Math.round(((oldPrice - discountedPrice) / oldPrice) * 100) : 0
  const handleAdd = () => {
    if (!product || !variant || alreadyInCart) return
    onAddToCart({ productId: product.id, variantId: variant.id, productName: product.name, variantLabel: variant.label + (hasPctDiscount ? ` (-${offer.discount_pct}%)` : ''), price: discountedPrice, comparePrice: oldPrice > discountedPrice ? oldPrice : discountedPrice, qty: 1, emoji: product.emoji, img: product.img || '', size_liters: variant.size_liters, fromOffer: true, offerType: offer.type === 'cross_sell' ? 'cross_sell' : 'cart_upsell' })
    setJustAdded(true); setTimeout(() => setJustAdded(false), 1800)
  }
  if (wasAdded && alreadyInCart) return null
  return (
    <div style={{ background: '#fff', border: `1.5px solid ${meta.color}22`, borderLeft: `3px solid ${meta.color}`, borderRadius: 12, padding: '9px 11px 9px 10px', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
      <div style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0, overflow: 'hidden', background: `${meta.color}0d`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: `1px solid ${meta.color}18`, marginTop: 1 }}>
        {imgSrc ? <img src={imgSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }} /> : <span>{offer.emoji || meta.icon}</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a', lineHeight: 1.3, marginBottom: 2 }}>{offer.title}</div>
        {offer.description && <div style={{ fontSize: 10.5, color: '#64748b', lineHeight: 1.35, marginBottom: 3 }}>{offer.description}</div>}
        {variant && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: 12.5, fontWeight: 900, color: meta.color }}>{fmt(discountedPrice)}</span>
            {showOld && <span style={{ fontSize: 10.5, color: '#9ca3af', textDecoration: 'line-through' }}>{fmt(oldPrice)}</span>}
            {savePct > 0 && <span style={{ fontSize: 9, fontWeight: 800, background: '#fee2e2', color: '#dc2626', padding: '1px 5px', borderRadius: 4 }}>-{savePct}%</span>}
            {offer.badge_text && <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: offer.badge_color || meta.color, padding: '1px 6px', borderRadius: 99 }}>{offer.badge_text}</span>}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0, alignSelf: 'center', minWidth: 58 }}>
        {justAdded ? (
          <div style={{ fontSize: 10.5, fontWeight: 800, color: '#059669', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 8, padding: '4px 7px', textAlign: 'center' as const }}>✓ Добавен</div>
        ) : (
          <button onClick={handleAdd} disabled={alreadyInCart} style={{ height: 30, borderRadius: 8, border: 'none', background: alreadyInCart ? '#059669' : meta.color, color: '#fff', cursor: alreadyInCart ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 800, padding: '0 9px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s', boxShadow: !alreadyInCart ? `0 2px 6px ${meta.color}38` : 'none', whiteSpace: 'nowrap' as const }}>
            {alreadyInCart ? '✓ Добавен' : '+ Добави'}
          </button>
        )}
      </div>
    </div>
  )
}

function PostPurchaseModal({ offer, products, onAccept, onDismiss, originalOrderId, fmt }: { offer: UpsellOffer; products: AtlasProduct[]; onAccept: () => void; onDismiss: () => void; originalOrderId: string; fmt: (n: number) => string }) {
  const product = products.find(p => p.id === offer.offer_product_id)
  const variant = product?.variants?.find(v => offer.offer_variant_id ? v.id === offer.offer_variant_id : v.active !== false)
  const [adding, setAdding] = useState(false); const [done, setDone] = useState(false)
  const discountedPrice = variant && offer.discount_pct ? +(variant.price * (1 - offer.discount_pct / 100)).toFixed(2) : variant?.price ?? 0
  const handleAccept = async () => {
    if (!product || !variant) { onDismiss(); return }
    setAdding(true)
    try {
      await fetch(`/api/orders/${originalOrderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ add_items: [{ product_name: `${product.name} — ${variant.label} (Post-purchase upsell)`, quantity: 1, unit_price: discountedPrice, total_price: discountedPrice }], offer_type: 'post_purchase', add_to_notes: '[POST-PURCHASE UPSELL]', add_to_total: discountedPrice }) })
      setDone(true); setTimeout(onAccept, 1800)
    } catch { onDismiss() } finally { setAdding(false) }
  }
  return (
    <>
      <style>{`@keyframes ppIn{from{transform:translateY(40px) scale(.95);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}`}</style>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 1000000, backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 22, width: '100%', maxWidth: 380, overflow: 'hidden', animation: 'ppIn .4s cubic-bezier(.34,1.56,.64,1)', boxShadow: '0 28px 70px rgba(0,0,0,.32)' }}>
          <div style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', padding: '18px 20px 15px' }}>
            <div style={{ fontSize: 9.5, fontWeight: 900, color: 'rgba(255,255,255,.65)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 5 }}>⚡ Специална оферта само веднъж</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 30 }}>{offer.emoji}</span>
              <div>
                <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>{offer.title}</div>
                {offer.badge_text && <span style={{ fontSize: 9.5, fontWeight: 900, background: '#fff', color: '#dc2626', padding: '1px 7px', borderRadius: 99, display: 'inline-block', marginTop: 4 }}>{offer.badge_text}</span>}
              </div>
            </div>
          </div>
          <div style={{ padding: '16px 20px' }}>
            {offer.description && <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 13 }}>{offer.description}</p>}
            {product && variant && (
              <div style={{ background: '#f9fafb', borderRadius: 11, padding: 13, marginBottom: 13, display: 'flex', gap: 11, alignItems: 'center', border: '1px solid #f1f5f9' }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {product.img ? <img src={product.img} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 24 }}>{product.emoji}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{product.name}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{variant.label}</div>
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 17, fontWeight: 900, color: '#dc2626' }}>{fmt(discountedPrice)}</span>
                    {offer.discount_pct ? <><span style={{ fontSize: 11.5, color: '#9ca3af', textDecoration: 'line-through' }}>{fmt(variant.price)}</span><span style={{ fontSize: 9.5, fontWeight: 800, background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: 5 }}>-{offer.discount_pct}%</span></> : null}
                  </div>
                </div>
              </div>
            )}
            {done && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9, padding: '8px 12px', marginBottom: 11, fontSize: 12.5, color: '#166534', fontWeight: 700, textAlign: 'center' as const }}>✅ Добавено към поръчката!</div>}
            <button onClick={handleAccept} disabled={adding || done} style={{ width: '100%', padding: 12, background: done ? '#059669' : 'linear-gradient(135deg,#dc2626,#b91c1c)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 900, fontSize: 14.5, cursor: done ? 'default' : 'pointer', fontFamily: 'inherit', marginBottom: 8, boxShadow: done ? 'none' : '0 3px 12px rgba(220,38,38,.32)', transition: 'all .2s' }}>
              {adding ? '⏳ Добавяне...' : done ? '✓ Добавено!' : `⚡ Да, искам${offer.discount_pct ? ` (-${offer.discount_pct}%)` : ''}!`}
            </button>
            <button onClick={onDismiss} style={{ width: '100%', padding: 9, background: 'transparent', color: '#9ca3af', border: 'none', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Не, благодаря</button>
          </div>
        </div>
      </div>
    </>
  )
}

function CartItemRow({ item, onUpdateQty, onRemove, fmt }: { item: CartItem; onUpdateQty: (id: string, qty: number) => void; onRemove: (id: string) => void; fmt: (n: number) => string }) {
  const saving = item.comparePrice > item.price ? (item.comparePrice - item.price) * item.qty : 0
  return (
    <div style={{ display: 'flex', gap: 11, padding: '11px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
      <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
        {item.img ? <img src={item.img} alt={item.productName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 24 }}>{item.emoji}</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginBottom: 2, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.productName}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3, flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{item.variantLabel}</span>
          {item.fromOffer && <span style={{ fontSize: 9, fontWeight: 800, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ede9fe', padding: '1px 5px', borderRadius: 99 }}>✨ Оферта</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: '#16a34a' }}>{fmt(item.price * item.qty)}</span>
          {item.comparePrice > item.price && <><span style={{ fontSize: 11, color: '#9ca3af', textDecoration: 'line-through' }}>{fmt(item.comparePrice * item.qty)}</span><span style={{ fontSize: 9, fontWeight: 800, background: '#fee2e2', color: '#dc2626', padding: '1px 5px', borderRadius: 4 }}>-{Math.round(((item.comparePrice - item.price) / item.comparePrice) * 100)}%</span></>}
        </div>
        {saving > 0 && <div style={{ fontSize: 10, color: '#059669', fontWeight: 700, marginTop: 1 }}>🏷 Спестяваш {fmt(saving)}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <button onClick={() => onUpdateQty(item.variantId, item.qty - 1)} style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' as any }}>−</button>
          <span style={{ fontSize: 13, fontWeight: 800, minWidth: 22, textAlign: 'center' as const, color: '#0f172a' }}>{item.qty}</span>
          <button onClick={() => onUpdateQty(item.variantId, item.qty + 1)} style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' as any }}>+</button>
        </div>
        <button onClick={() => onRemove(item.variantId)} style={{ fontSize: 10.5, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '2px 6px', borderRadius: 5, WebkitTapHighlightColor: 'transparent' as any }}>🗑</button>
      </div>
    </div>
  )
}

function OffersGroup({ upsellOffers, crossSellOffers, products, onAddToCart, fmt, cartItems }: { upsellOffers: UpsellOffer[]; crossSellOffers: UpsellOffer[]; products: AtlasProduct[]; onAddToCart: (item: CartItem) => void; fmt: (n: number) => string; cartItems: CartItem[] }) {
  const allOffers = [...upsellOffers, ...crossSellOffers]
  if (allOffers.length === 0) return null
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.09em', marginBottom: 5 }}>✨ Може да те заинтересува</div>
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
        {allOffers.map(offer => <OfferCard key={offer.id} offer={offer} products={products} onAddToCart={onAddToCart} fmt={fmt} cartItems={cartItems} />)}
      </div>
    </div>
  )
}

function ProductCard({ product, onAddToCart, fmt, fmtLiter }: { product: AtlasProduct; onAddToCart: (item: CartItem) => void; fmt: (n: number) => string; fmtLiter: (n: number) => string }) {
  const variants = (product.variants || []).filter(v => v.active !== false)
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id || '')
  const [added, setAdded] = useState(false)
  const selectedVariant = variants.find(v => v.id === selectedVariantId) ?? variants[0]
  const discount = selectedVariant && selectedVariant.compare_price > selectedVariant.price ? Math.round(((selectedVariant.compare_price - selectedVariant.price) / selectedVariant.compare_price) * 100) : 0
  const handleAdd = () => {
    if (!selectedVariant) return
    onAddToCart({ productId: product.id, variantId: selectedVariant.id, productName: product.name, variantLabel: selectedVariant.label, price: selectedVariant.price, comparePrice: Number(selectedVariant.compare_price) > Number(selectedVariant.price) ? Number(selectedVariant.compare_price) : 0, qty: 1, emoji: product.emoji, img: product.img || '', size_liters: selectedVariant.size_liters })
    setAdded(true); setTimeout(() => setAdded(false), 1800)
  }
  return (
    <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 32px rgba(0,0,0,.07)', border: '1.5px solid #f0f0f0', display: 'flex', flexDirection: 'column', transition: 'transform .2s, box-shadow .2s' }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-4px)'; el.style.boxShadow = '0 12px 48px rgba(0,0,0,.12)' }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '0 4px 32px rgba(0,0,0,.07)' }}>
      <div style={{ position: 'relative', background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {product.badge && <div style={{ position: 'absolute', top: 14, left: 14, background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 30, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>{product.badge}</div>}
        {discount > 0 && <div style={{ position: 'absolute', top: 14, right: 14, background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 900, padding: '4px 10px', borderRadius: 30 }}>-{discount}%</div>}
        {product.img ? <img src={product.img} alt={product.name} style={{ maxHeight: 160, maxWidth: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 72 }}>{product.emoji}</span>}
      </div>
      <div style={{ padding: '20px 22px 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', letterSpacing: '0.07em', textTransform: 'uppercase' as const, marginBottom: 6 }}>{product.emoji} {product.subtitle}</div>
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 800, color: '#111', margin: '0 0 10px', lineHeight: 1.2 }}>{product.name}</h3>
        <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.65, marginBottom: 16 }}>{product.desc}</p>
        {product.features?.length > 0 && (
          <ul style={{ margin: '0 0 18px', padding: 0, listStyle: 'none' }}>
            {product.features.slice(0, 3).map((f, i) => (
              <li key={i} style={{ fontSize: 12.5, color: '#374151', padding: '5px 0', display: 'flex', gap: 8, alignItems: 'flex-start', borderBottom: '1px solid #f5f5f5' }}>
                <span style={{ background: '#16a34a', color: '#fff', width: 15, height: 15, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>✓</span>{f}
              </li>
            ))}
          </ul>
        )}
        {variants.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Избери количество:</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
              {variants.map(v => {
                const sel = v.id === selectedVariantId
                const savePct = v.compare_price > v.price ? Math.round(((v.compare_price - v.price) / v.compare_price) * 100) : 0
                return (
                  <button key={v.id} onClick={() => setSelectedVariantId(v.id)} style={{ flex: '1 1 calc(50% - 4px)', padding: '10px 12px', borderRadius: 12, border: sel ? '2px solid #16a34a' : '1.5px solid #e5e7eb', background: sel ? '#f0fdf4' : '#fafafa', cursor: 'pointer', textAlign: 'left' as const, transition: 'all .15s', fontFamily: 'inherit' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: sel ? '#15803d' : '#374151' }}>{v.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: sel ? '#16a34a' : '#111', marginTop: 2 }}>{fmt(v.price)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' as const }}>
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
            <div style={{ textAlign: 'right' as const }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a' }}>{fmt(selectedVariant.price)}</div>
              {selectedVariant.compare_price > selectedVariant.price && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'line-through' }}>{fmt(selectedVariant.compare_price)}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: 5 }}>-{Math.round(((selectedVariant.compare_price - selectedVariant.price) / selectedVariant.compare_price) * 100)}%</span>
                </div>
              )}
            </div>
          </div>
        )}
        <button onClick={handleAdd} disabled={!selectedVariant} style={{ display: 'block', width: '100%', padding: '13px 20px', background: added ? '#059669' : '#16a34a', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s', marginTop: 'auto', transform: added ? 'scale(0.98)' : 'scale(1)' }}>
          {added ? '✓ Добавено!' : '🛒 Добави в количката'}
        </button>
      </div>
    </div>
  )
}

// ─── CartDrawer ───────────────────────────────────────────────────────────────

function CartDrawer({ items, shippingPrice, freeShippingAbove, sitePhone, onClose, onUpdateQty, onRemove, onAddToCart, onClearCart, products, marketingSettings, currencySymbol }: { items: CartItem[]; shippingPrice: number; freeShippingAbove: number; sitePhone: string; onClose: () => void; onUpdateQty: (id: string, qty: number) => void; onRemove: (id: string) => void; onAddToCart: (item: CartItem) => void; onClearCart: () => void; products: AtlasProduct[]; marketingSettings: MarketingSettings | null; currencySymbol?: string }) {
  const [step, setStep] = useState<'cart' | 'checkout'>('cart')
  const [form, setForm] = useState({ name: '', phone: '', city: '', address: '', notes: '', courier: 'econt' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [orderId, setOrderId] = useState('')
  const [error, setError] = useState('')
  const [postPurchaseOffer, setPostPurchaseOffer] = useState<UpsellOffer | null>(null)
  const headerBottom = useHeaderBottom()
  useLockBodyScroll(true)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const { fmt } = makeFmt(currencySymbol ?? '€')
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const totalSavings = items.reduce((s, i) => i.comparePrice > i.price ? s + (i.comparePrice - i.price) * i.qty : s, 0)
  const shipping = subtotal >= freeShippingAbove ? 0 : shippingPrice
  const total = subtotal + shipping
  const totalLiters = items.reduce((s, i) => s + i.size_liters * i.qty, 0)
  const ms = marketingSettings
  const upsellOffers: UpsellOffer[] = ms?.upsell_enabled ? ms.offers.filter(o => o.type === 'cart_upsell' && offerMatches(o, items, subtotal)) : []
  const crossSellOffers: UpsellOffer[] = ms?.cross_sell_enabled ? ms.offers.filter(o => o.type === 'cross_sell' && offerMatches(o, items, subtotal)) : []

  const handleOrder = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.city.trim() || !form.address.trim()) { setError('Моля попълни всички задължителни полета (имена, телефон, град, адрес).'); return }
    setSubmitting(true); setError('')
    try {
      const orderItems = items.map(i => ({ product_name: `${i.productName} — ${i.variantLabel}`, quantity: i.qty, unit_price: i.price, total_price: +(i.price * i.qty).toFixed(2) }))
      const hasUpsell = items.some(i => i.fromOffer && i.offerType === 'cart_upsell')
      const hasCross = items.some(i => i.fromOffer && i.offerType === 'cross_sell')
      const hasAnyOffer = items.some(i => i.fromOffer)
      const offerMarkers: string[] = []
      if (hasUpsell || (hasAnyOffer && !hasCross)) offerMarkers.push('[CART-UPSELL]')
      if (hasCross) offerMarkers.push('[CROSS-SELL]')
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_name: form.name.trim(), customer_phone: form.phone.trim(), customer_city: form.city.trim(), customer_address: form.address.trim(), customer_notes: (() => { const base = form.notes.trim(); return offerMarkers.length > 0 ? [base, ...offerMarkers].filter(Boolean).join(' ').trim() : base || null })(), offer_type: hasUpsell ? 'cart_upsell' : hasCross ? 'cross_sell' : null, courier: form.courier, payment_method: 'cod', items: orderItems, subtotal: +subtotal.toFixed(2), shipping: +shipping.toFixed(2), total: +total.toFixed(2) }) })
      if (!res.ok) { let errMsg = `Грешка ${res.status}`; try { const errData = await res.json(); errMsg = errData.error || errMsg } catch {}; throw new Error(errMsg) }
      const data = await res.json()
      setOrderNumber(data.order_number || ''); setOrderId(data.id || data.order_id || '')
      setDone(true); onClearCart()
      if (ms?.post_purchase_enabled) {
        const pp = ms.offers.filter(o => o.type === 'post_purchase' && offerMatches(o, items, subtotal))
        if (pp.length > 0) setTimeout(() => setPostPurchaseOffer(pp[0]), Math.max(0, (ms.post_purchase_delay ?? 2)) * 1000)
      }
    } catch (err: any) { setError(err.message || 'Грешка при изпращане. Моля опитай отново.') } finally { setSubmitting(false) }
  }

  const hb = `${headerBottom}px`

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');

        .cart-overlay {
          position: fixed; left: 0; right: 0; bottom: 0; top: ${hb};
          background: rgba(15,23,42,.48); z-index: 999998;
          backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
          cursor: pointer; touch-action: none;
        }
        .cart-drawer {
          position: fixed; right: 0; top: ${hb}; bottom: 0;
          width: 100%; max-width: 440px;
          background: #fff; z-index: 999999;
          display: flex; flex-direction: column;
          box-shadow: -16px 0 56px rgba(0,0,0,.17);
          animation: cartSlideIn .26s cubic-bezier(.4,0,.2,1);
          font-family: 'Outfit', 'DM Sans', sans-serif;
          overflow: hidden; border-radius: 0 0 0 14px;
        }
        @media (max-width: 640px) {
          .cart-overlay { top: 0 !important; }
          .cart-drawer { top: 0 !important; left: 0; right: 0; bottom: 0; max-width: 100%; border-radius: 0; animation: cartSlideUp .28s cubic-bezier(.4,0,.2,1); }
        }
        @keyframes cartSlideIn  { from { transform: translateX(105%); opacity:.5 } to { transform: translateX(0); opacity:1 } }
        @keyframes cartSlideUp  { from { transform: translateY(100%) } to { transform: translateY(0) } }

        /* Компактен header */
        .cart-header { padding: 9px 15px 8px; border-bottom: 1px solid #f1f5f9; background: #fff; flex-shrink: 0; position: sticky; top: 0; z-index: 10; }
        @media (max-width: 640px) { .cart-header { padding-top: max(11px, env(safe-area-inset-top, 11px)); } }

        .cart-drag-handle { display: none; }
        @media (max-width: 640px) { .cart-drag-handle { display: block; width: 32px; height: 3px; background: #e2e8f0; border-radius: 99px; margin: 0 auto 9px; } }

        .cart-inner { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; overscroll-behavior-y: contain; padding: 11px 15px; min-height: 0; touch-action: pan-y; }
        .cart-inner::-webkit-scrollbar { width: 3px }
        .cart-inner::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 99px }

        .cart-footer { padding: 9px 15px; padding-bottom: max(13px, env(safe-area-inset-bottom, 13px)); border-top: 1px solid #f1f5f9; background: #fff; flex-shrink: 0; }
        @media (max-width: 640px) { .cart-footer { padding-bottom: max(22px, env(safe-area-inset-bottom, 22px)); } }

        /* Компактни inputs */
        .cart-input { width: 100%; padding: 8px 10px; border: 1.5px solid #e2e8f0; border-radius: 9px; font-family: inherit; font-size: 13.5px; outline: none; box-sizing: border-box; margin-bottom: 6px; color: #0f172a; background: #fff; transition: border-color .15s, box-shadow .15s; -webkit-appearance: none; appearance: none; }
        @media (max-width: 640px) { .cart-input { font-size: 16px; padding: 10px 12px; } }
        .cart-input:focus { border-color: #16a34a; box-shadow: 0 0 0 2px rgba(22,163,74,.09) }
        .cart-input::placeholder { color: #c8d4e0 }

        .cart-btn-primary { width: 100%; padding: 12px; background: linear-gradient(135deg,#16a34a,#15803d); color: #fff; border: none; border-radius: 11px; font-weight: 800; font-size: 14px; cursor: pointer; font-family: inherit; transition: all .2s; box-shadow: 0 3px 10px rgba(22,163,74,.26); letter-spacing: -.01em; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        .cart-btn-primary:disabled { opacity: .5; cursor: not-allowed; box-shadow: none }
        .cart-btn-primary:hover:not(:disabled) { filter: brightness(1.06); box-shadow: 0 5px 18px rgba(22,163,74,.35) }
        .cart-btn-primary:active:not(:disabled) { transform: scale(.98) }

        .cart-btn-secondary { width: 100%; padding: 9px; background: #f8fafc; color: #64748b; border: 1px solid #f1f5f9; border-radius: 10px; font-weight: 700; font-size: 12.5px; cursor: pointer; font-family: inherit; margin-top: 5px; transition: all .15s; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        .cart-btn-secondary:active { background: #f1f5f9; color: #0f172a }

        /* Компактен close btn */
        .cart-close-btn { min-width: 34px; min-height: 34px; width: 34px; height: 34px; border: 1.5px solid #e2e8f0; background: #f8fafc; border-radius: 9px; cursor: pointer; font-size: 13px; color: #475569; display: flex; align-items: center; justify-content: center; transition: all .15s; flex-shrink: 0; touch-action: manipulation; -webkit-tap-highlight-color: transparent; font-weight: 800; }
        .cart-close-btn:hover { background: #fee2e2; border-color: #fca5a5; color: #dc2626 }
        .cart-close-btn:active { transform: scale(.88) }

        @media (max-width: 640px) { .cart-city-addr { flex-direction: column !important; gap: 0 !important } }
      `}</style>

      {postPurchaseOffer && <PostPurchaseModal offer={postPurchaseOffer} products={products} originalOrderId={orderId} onAccept={() => setPostPurchaseOffer(null)} onDismiss={() => setPostPurchaseOffer(null)} fmt={fmt} />}

      <div className="cart-overlay" onClick={onClose} />

      <div className="cart-drawer" role="dialog" aria-modal="true" aria-label="Количка">

        {/* ── КОМПАКТЕН HEADER ── */}
        <div className="cart-header">
          <div className="cart-drag-handle" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: done ? 'linear-gradient(135deg,#16a34a,#15803d)' : step === 'checkout' ? 'linear-gradient(135deg,#0369a1,#1d4ed8)' : 'linear-gradient(135deg,#0f172a,#1e293b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                {done ? '✅' : step === 'cart' ? '🛒' : '📦'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a', letterSpacing: '-.01em', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {done ? 'Поръчката е приета!' : step === 'cart' ? 'Количка' : 'Финализирай поръчката'}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 0, display: 'flex', gap: 3, alignItems: 'center' }}>
                  {!done && step === 'cart' && items.length > 0 && <><span>{items.reduce((s, i) => s + i.qty, 0)} бр.</span>{totalSavings > 0 && <span style={{ color: '#dc2626', fontWeight: 700 }}>· -{fmt(totalSavings)}</span>}</>}
                  {!done && step === 'checkout' && <span>Стъпка 2 от 2</span>}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="cart-close-btn" aria-label="Затвори">✕</button>
          </div>
        </div>

        {/* ── УСПЕХ ── */}
        {done ? (
          <div className="cart-inner" style={{ textAlign: 'center', paddingTop: 44 }}>
            <div style={{ fontSize: 58, marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 800, marginBottom: 9, color: '#111' }}>Благодаря!</h2>
            {orderNumber && <div style={{ display: 'inline-block', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9, padding: '6px 14px', marginBottom: 11, fontSize: 12, fontWeight: 700, color: '#166534' }}>Поръчка №{orderNumber}</div>}
            <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>Поръчката ти е получена. Ще се свържем с теб скоро за потвърждение.</p>
            <p style={{ fontSize: 13, color: '#374151' }}>📞 При въпроси: <a href={`tel:${sitePhone}`} style={{ color: '#16a34a', fontWeight: 700 }}>{sitePhone}</a></p>
          </div>

        /* ── СТЪПКА 1 ── */
        ) : step === 'cart' ? (
          <>
            <div className="cart-inner">
              {items.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: 52, paddingBottom: 24 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Количката е празна</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>Разгледай продуктите и добави нещо</div>
                </div>
              ) : items.map(item => <CartItemRow key={item.variantId} item={item} onUpdateQty={onUpdateQty} onRemove={onRemove} fmt={fmt} />)}
            </div>

            {items.length > 0 && (
              <div className="cart-footer">
                {totalLiters >= 60 ? (
                  <div style={{ background: 'linear-gradient(135deg,#14532d,#166534)', borderRadius: 9, padding: '8px 11px', marginBottom: 7, display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>🔬</span>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 800, color: '#86efac', marginBottom: 1 }}>БЕЗПЛАТЕН АНАЛИЗ НА ПОЧВАТА!</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.8)', lineHeight: 1.4 }}>С тази поръчка ({totalLiters}л) получаваш безплатен почвен, листен и воден анализ.</div>
                    </div>
                  </div>
                ) : totalLiters > 0 ? (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9, padding: '7px 10px', marginBottom: 7, display: 'flex', gap: 7, alignItems: 'center' }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>🔬</span>
                    <div style={{ fontSize: 10.5, color: '#166534', lineHeight: 1.35 }}>Добави още <strong>{60 - totalLiters}л</strong> и получи <strong>безплатен анализ на почвата</strong>!</div>
                  </div>
                ) : null}

                <OffersGroup upsellOffers={upsellOffers} crossSellOffers={crossSellOffers} products={products} onAddToCart={onAddToCart} fmt={fmt} cartItems={items} />

                <div style={{ background: '#f8fafc', borderRadius: 11, padding: '10px 13px', marginBottom: 10, border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#64748b', fontWeight: 500 }}><span>Продукти</span><span>{fmt(subtotal)}</span></div>
                  {totalSavings > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#059669', fontWeight: 700 }}><span>🏷 Спестяваш</span><span>-{fmt(totalSavings)}</span></div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <span style={{ color: '#64748b', fontWeight: 500 }}>🚚 Доставка</span>
                    <span>{shipping === 0 ? <span style={{ color: '#16a34a', fontWeight: 800 }}>Безплатна 🎉</span> : <span style={{ fontWeight: 700, color: '#0f172a' }}>{fmt(shipping)}</span>}</span>
                  </div>
                  {shipping > 0 && (() => {
                    const goal = ms?.progress_bar_enabled ? (ms.progress_goal_amount || freeShippingAbove) : freeShippingAbove
                    const pct = Math.min(100, (subtotal / goal) * 100)
                    const left = goal - subtotal
                    return <div style={{ marginTop: 5 }}>
                      <div style={{ background: 'rgba(0,0,0,.06)', borderRadius: 99, height: 4, overflow: 'hidden', marginBottom: 3 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#16a34a,#4ade80)', borderRadius: 99, transition: 'width .6s' }} />
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Добави още <strong style={{ color: '#16a34a' }}>{fmt(left)}</strong> за безплатна</span>
                        <span>{fmt(goal)}</span>
                      </div>
                    </div>
                  })()}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 19, fontWeight: 900, color: '#0f172a', letterSpacing: '-.02em' }}>
                  <span>Общо</span>
                  <div style={{ textAlign: 'right' as const }}>
                    <div style={{ color: '#16a34a' }}>{fmt(total)}</div>
                    {totalSavings > 0 && <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>Пести {fmt(totalSavings)} спрямо редовна цена</div>}
                  </div>
                </div>
                <button className="cart-btn-primary" onClick={() => setStep('checkout')}>Продължи към поръчка →</button>
              </div>
            )}
          </>

        /* ── СТЪПКА 2 — КОМПАКТНА ── */
        ) : (
          <>
            <div className="cart-inner">
              {/* COD */}
              <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #bbf7d0', borderRadius: 9, padding: '7px 11px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>💵</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 11.5, color: '#15803d' }}>Наложен платеж</div>
                  <div style={{ fontSize: 10, color: '#166534', marginTop: 0.5 }}>Плащаш само при получаване — без предплащане</div>
                </div>
              </div>

              {/* Delivery fields */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 7 }}>👤 Данни за доставка</div>
                <input className="cart-input" placeholder="Три имена *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <input className="cart-input" placeholder="Телефон *" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                <div className="cart-city-addr" style={{ display: 'flex', gap: 5 }}>
                  <input className="cart-input" placeholder="Град *" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} style={{ flex: 1, marginBottom: 0 }} />
                  <input className="cart-input" placeholder="Адрес *" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={{ flex: 2, marginBottom: 0 }} />
                </div>
              </div>

              {/* Courier */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 6 }}>🚚 Куриер</div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[{ value: 'econt', label: 'Еконт', emoji: '📦' }, { value: 'speedy', label: 'Спиди', emoji: '🚀' }].map(c => (
                    <button key={c.value} onClick={() => setForm(f => ({ ...f, courier: c.value }))} style={{ flex: 1, padding: '8px 6px', border: `2px solid ${form.courier === c.value ? '#16a34a' : '#e5e7eb'}`, borderRadius: 9, background: form.courier === c.value ? 'linear-gradient(135deg,#f0fdf4,#dcfce7)' : '#fafafa', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5, color: form.courier === c.value ? '#15803d' : '#374151', transition: 'all .15s', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2, boxShadow: form.courier === c.value ? '0 0 0 2px rgba(22,163,74,.1)' : 'none' }}>
                      <span style={{ fontSize: 17 }}>{c.emoji}</span>
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 9 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 6 }}>💬 Бележки (по желание)</div>
                <textarea className="cart-input" placeholder="Допълнителни инструкции..." rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'none' as const, marginBottom: 0 }} />
              </div>

              {error && (
                <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 9, padding: '9px 12px', fontSize: 12, marginBottom: 10, display: 'flex', gap: 7, alignItems: 'flex-start', lineHeight: 1.5, border: '1px solid #fecaca' }}>
                  <span style={{ flexShrink: 0, fontSize: 13 }}>⚠️</span><span>{error}</span>
                </div>
              )}

              {/* Summary — компактна, с оферта badge */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ padding: '9px 13px 8px', borderBottom: '1px solid #e8edf2', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 12 }}>📋</span>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>Резюме на поръчката</div>
                </div>
                <div style={{ padding: '7px 13px' }}>
                  {items.map((i, idx) => (
                    <div key={i.variantId} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: idx < items.length - 1 ? 7 : 0, marginBottom: idx < items.length - 1 ? 7 : 0, borderBottom: idx < items.length - 1 ? '1px solid #edf0f4' : 'none' }}>
                      <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 7, overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
                        {i.img ? <img src={i.img} alt={i.productName} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }} /> : <span style={{ fontSize: 16 }}>{i.emoji}</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.productName}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' as const }}>
                          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{i.variantLabel} · ×{i.qty}</span>
                          {/* ── ОФЕРТА BADGE в стъпка 2 ── */}
                          {i.fromOffer && (
                            <span style={{ fontSize: 8.5, fontWeight: 800, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ede9fe', padding: '1px 5px', borderRadius: 99, whiteSpace: 'nowrap' as const }}>
                              ✨ {i.offerType === 'cross_sell' ? 'Кръстосана' : 'Оферта'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 900, color: '#16a34a' }}>{fmt(i.price * i.qty)}</div>
                        {i.comparePrice > i.price && <div style={{ fontSize: 10, color: '#cbd5e1', textDecoration: 'line-through', marginTop: 1 }}>{fmt(i.comparePrice * i.qty)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#fff', padding: '9px 13px', borderTop: '1px solid #e2e8f0' }}>
                  {totalSavings > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#059669', fontWeight: 700, marginBottom: 5 }}><span>🏷 Спестяваш</span><span>-{fmt(totalSavings)}</span></div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#64748b', fontWeight: 500, marginBottom: 7, alignItems: 'center' }}>
                    <span>🚚 Доставка ({form.courier === 'econt' ? 'Еконт' : 'Спиди'})</span>
                    <span>{shipping === 0 ? <span style={{ color: '#16a34a', fontWeight: 800 }}>Безплатна 🎉</span> : <span style={{ fontWeight: 700, color: '#0f172a' }}>{fmt(shipping)}</span>}</span>
                  </div>
                  {shipping > 0 && <div style={{ fontSize: 10, color: '#92400e', fontWeight: 600, marginBottom: 7, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '4px 9px' }}>💡 Добави {fmt(freeShippingAbove - subtotal)} още за безплатна доставка</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a' }}>Общо</span>
                    <div style={{ textAlign: 'right' as const }}>
                      <div style={{ fontWeight: 900, fontSize: 20, color: '#16a34a', lineHeight: 1, letterSpacing: '-.02em' }}>{fmt(total)}</div>
                      {totalSavings > 0 && <div style={{ fontSize: 9.5, color: '#dc2626', fontWeight: 700, marginTop: 2 }}>Пести {fmt(totalSavings)} спрямо редовна цена</div>}
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
}

// ─── MAIN CartSystem ──────────────────────────────────────────────────────────

export function CartSystem({ atlasProducts, shippingPrice, freeShippingAbove, siteEmail, sitePhone, currencySymbol }: Props) {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [marketingSettings, setMarketingSettings] = useState<MarketingSettings | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => { const saved = loadCartFromStorage(); if (saved.length > 0) setCartItems(saved); setHydrated(true) }, [])
  useEffect(() => { fetch('/api/marketing', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(data => { if (data) setMarketingSettings(data) }).catch(() => {}) }, [])

  const addToCart = useCallback((item: CartItem) => {
    setCartItems(prev => { const existing = prev.find(i => i.variantId === item.variantId); const next = existing ? prev.map(i => i.variantId === item.variantId ? { ...i, qty: i.qty + 1 } : i) : [...prev, item]; saveCartToStorage(next); return next })
    setDrawerOpen(true)
  }, [])
  const updateQty = useCallback((variantId: string, qty: number) => {
    setCartItems(prev => { const next = qty <= 0 ? prev.filter(i => i.variantId !== variantId) : prev.map(i => i.variantId === variantId ? { ...i, qty } : i); saveCartToStorage(next); return next })
  }, [])
  const removeItem = useCallback((variantId: string) => {
    setCartItems(prev => { const next = prev.filter(i => i.variantId !== variantId); saveCartToStorage(next); return next })
  }, [])
  const clearCart = useCallback(() => { setCartItems([]); clearCartStorage() }, [])

  const totalItems = cartItems.reduce((s, i) => s + i.qty, 0)
  const { fmt, fmtLiter } = makeFmt(currencySymbol ?? '€')

  useEffect(() => { const handler = () => setDrawerOpen(prev => !prev); window.addEventListener('cart:open', handler); return () => window.removeEventListener('cart:open', handler) }, [])
  useEffect(() => { window.dispatchEvent(new CustomEvent('cart:count', { detail: totalItems })) }, [totalItems])

  if (!hydrated) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
      {atlasProducts.map(product => <ProductCard key={product.id} product={product} onAddToCart={addToCart} fmt={fmt} fmtLiter={fmtLiter} />)}
    </div>
  )

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        {atlasProducts.map(product => <ProductCard key={product.id} product={product} onAddToCart={addToCart} fmt={fmt} fmtLiter={fmtLiter} />)}
      </div>
      {drawerOpen && (
        <CartDrawer items={cartItems} shippingPrice={shippingPrice} freeShippingAbove={freeShippingAbove} sitePhone={sitePhone} onClose={() => setDrawerOpen(false)} onUpdateQty={updateQty} onRemove={removeItem} onAddToCart={addToCart} onClearCart={clearCart} products={atlasProducts} marketingSettings={marketingSettings} currencySymbol={currencySymbol} />
      )}
    </>
  )
}
