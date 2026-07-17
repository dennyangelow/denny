'use client'
// components/marketing/OffersShowcase.tsx — v1
// ─────────────────────────────────────────────────────────────────────────────
// Показва активните маркетинг оферти (cross-sell / bundle) НА САМАТА СТРАНИЦА —
// не само вътре в количката. Използва се на два места:
//   1. Началната страница (context="homepage")  — обща лента "🎁 Оферти и пакети"
//   2. Продуктовата страница (context="product") — само офертите, релевантни за
//      ТОЗИ продукт, показани до/под buy картата.
//
// Логиката за "кое условие сработва" идва изцяло от lib/offers.ts — СЪЩИТЕ
// функции, които ползва и CartSystem.tsx за drawer-а. Добавянето в количката
// минава през същия 'cart:add' CustomEvent, който CartSystem вече слуша — не
// пипаме и не дублираме state-а на количката.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  offersForProduct, offersForHomepage, computeBundleProgress,
  offerRelatedProductIds,
  type UpsellOffer, type OfferCartItemLike,
} from '@/lib/offers'

// ─── Типове ────────────────────────────────────────────────────────────────────
export interface ShowcaseVariant {
  id: string; label: string; price: number; compare_price: number
  stock: number; active: boolean; size_liters?: number
}
export interface ShowcaseProduct {
  id: string; slug: string; name: string; emoji: string; img: string
  variants?: ShowcaseVariant[]
}
export interface CartAddPayload {
  productId: string; variantId: string; productName: string; variantLabel: string
  price: number; comparePrice: number; qty: number; emoji: string; img: string; size_liters: number
}

interface Props {
  offers?: UpsellOffer[]         // ако не е подаден — компонентът сам взима /api/marketing
  products: ShowcaseProduct[]
  context: 'homepage' | 'product'
  currentProductId?: string      // задължително за context="product"
  currentVariantId?: string      // избраният от клиента вариант на текущия продукт (ако има)
  currencySymbol?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number, sym = '€') => `${Number(n).toFixed(2)} ${sym}`

function pickVariant(product: ShowcaseProduct | undefined, variantId?: string, sizeLiters?: number): ShowcaseVariant | null {
  if (!product?.variants?.length) return null
  if (variantId) {
    const exact = product.variants.find(v => v.id === variantId && v.active)
    if (exact) return exact
  }
  const pool = sizeLiters
    ? product.variants.filter(v => v.active && Number(v.size_liters) === Number(sizeLiters))
    : product.variants.filter(v => v.active)
  const inStock = pool.filter(v => v.stock > 0).sort((a, b) => a.price - b.price)
  if (inStock.length) return inStock[0]
  // Ако конкретният размер няма наличност — по-добре нищо, отколкото грешен размер,
  // който да не покрие изискването на пакета (напр. 20л условие с добавени 5л).
  if (sizeLiters && pool.length === 0) return null
  return pool[0] || product.variants.find(v => v.active) || product.variants[0] || null
}

function dispatchAddToCart(payload: CartAddPayload) {
  window.dispatchEvent(new CustomEvent<CartAddPayload>('cart:add', { detail: payload }))
}

// ✅ Цена/литър + % по-изгодно спрямо най-малкия наличен размер на СЪЩИЯ продукт
// (напр. 20л туба показва "-18% /л спрямо 5л") — конкретен, лесно разбираем
// маркетинг аргумент защо по-големият размер е по-изгоден избор.
function perLiterInfo(product: ShowcaseProduct, variant: ShowcaseVariant): { ppl: number; savingsPct: number | null; vsLabel: string | null } | null {
  if (!variant.size_liters) return null
  const ppl = variant.price / variant.size_liters
  const smaller = (product.variants || [])
    .filter(v => v.active && v.size_liters && v.size_liters < variant.size_liters!)
    .sort((a, b) => (b.size_liters || 0) - (a.size_liters || 0))[0]
  if (!smaller?.size_liters) return { ppl, savingsPct: null, vsLabel: null }
  const smallerPpl = smaller.price / smaller.size_liters
  const pct = smallerPpl > 0 ? Math.round((1 - ppl / smallerPpl) * 100) : 0
  return { ppl, savingsPct: pct > 0 ? pct : null, vsLabel: smaller.label }
}

function buildPayload(product: ShowcaseProduct, variant: ShowcaseVariant, qty: number): CartAddPayload {
  return {
    productId: product.id, variantId: variant.id,
    productName: product.name, variantLabel: variant.label,
    price: variant.price, comparePrice: variant.compare_price ?? 0,
    qty, emoji: product.emoji || '🌱', img: product.img || '',
    size_liters: variant.size_liters ?? 0,
  }
}

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  cross_sell: { label: 'Допълва поръчката', color: '#0369a1', bg: '#eff6ff' },
  bundle:     { label: 'Пакет',             color: '#ea580c', bg: '#fff7ed' },
}

// ✅ Слуша живата количка (без да я отваря) — за да покаже реален bundle прогрес
// синхронно ("имаш 3 от 5"), CartSystem broadcast-ва пълния масив при промяна.
function useLiveCartItems(): OfferCartItemLike[] {
  const [items, setItems] = useState<OfferCartItemLike[]>([])
  useEffect(() => {
    try {
      const raw = localStorage.getItem('denny_cart_v2')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed.items)) setItems(parsed.items)
      }
    } catch {}
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<OfferCartItemLike[]>).detail
      if (Array.isArray(detail)) setItems(detail)
    }
    window.addEventListener('cart:items', handler)
    return () => window.removeEventListener('cart:items', handler)
  }, [])
  return items
}

// ✅ Ако родителят не подаде offers (напр. homepage.tsx е server component и не
// иска да плъмбира марketing settings ръчно) — компонентът си ги взима сам, от
// същия route, който вече ползва CartSystem/OwnProduktClient.
function useSelfFetchedOffers(provided?: UpsellOffer[]): UpsellOffer[] {
  const [fetched, setFetched] = useState<UpsellOffer[]>([])
  useEffect(() => {
    if (provided) return
    let cancelled = false
    fetch('/api/marketing', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled && data?.offers) setFetched(data.offers) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [provided])
  return provided ?? fetched
}

// ─── Единична карта на оферта ──────────────────────────────────────────────────
function OfferPromoCard({
  offer, products, context, currentProductId, currentVariantId, sym, cartItems,
}: {
  offer: UpsellOffer; products: ShowcaseProduct[]; context: 'homepage' | 'product'
  currentProductId?: string; currentVariantId?: string; sym: string; cartItems: OfferCartItemLike[]
}) {
  const [added, setAdded] = useState(false)
  const [picks, setPicks] = useState<Record<string, number>>({})
  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products])
  const meta = TYPE_META[offer.type] || TYPE_META.cross_sell

  const isBundleReq = offer.trigger_type === 'bundle_requirements' && !!offer.bundle_requirements?.length
  const progress = isBundleReq ? computeBundleProgress(offer, cartItems) : []
  const fulfilled = isBundleReq && progress.every(p => p.have >= p.need)

  // ✅ "Свободен избор" UI — само когато има ЕДНО условие с група от продукти
  // (напр. "5×20л от каквото и да е измежду Terra/Amino/Nitro") — интерактивно
  // маркетинг изживяване: клиентът сам разпределя бройките между продуктите.
  const groupReq = isBundleReq && offer.bundle_requirements!.length === 1 && (offer.bundle_requirements![0].product_ids?.length || 0) > 1
    ? offer.bundle_requirements![0] : null
  const groupCandidates = groupReq
    ? (groupReq.product_ids || [])
        .map(pid => {
          const product = byId.get(pid)
          const variant = product ? pickVariant(product, groupReq.variant_id, groupReq.size_liters) : null
          return product && variant ? { product, variant } : null
        })
        .filter((x): x is { product: ShowcaseProduct; variant: ShowcaseVariant } => !!x)
    : []
  const pickedTotal = Object.values(picks).reduce((s, n) => s + n, 0)

  function adjustPick(productId: string, delta: number, maxStock: number) {
    setPicks(prev => {
      const next = Math.max(0, Math.min(maxStock, (prev[productId] || 0) + delta))
      return { ...prev, [productId]: next }
    })
  }

  // Продукти, участващи в пакета/офертата (за снимки + имена) — за не-groupReq картите
  const involvedIds = offerRelatedProductIds(offer).filter(id => byId.has(id))
  const involvedProducts = involvedIds.map(id => byId.get(id)!).filter(Boolean)

  const rewardProduct = offer.offer_product_id ? byId.get(offer.offer_product_id) : undefined
  const rewardVariant = rewardProduct ? pickVariant(rewardProduct, offer.offer_variant_id) : null

  function handleAdd() {
    if (groupReq) {
      // Добавя точно това, което клиентът е избрал в степърите — нищо повече.
      // CartSystem вече отваря drawer-а автоматично при cart:add (setDrawerOpen(true)
      // вътре в addToCart) — не пращаме допълнителен 'cart:open' тук (би го TOGGLE-нал
      // обратно затворен, ако вече се е отворил от първия add).
      for (const { product, variant } of groupCandidates) {
        const qty = picks[product.id] || 0
        if (qty > 0) dispatchAddToCart(buildPayload(product, variant, qty))
      }
      setPicks({})
    } else if (isBundleReq) {
      // Без свободен избор (единичен продукт на условие, или повече от едно условие) —
      // добавя автоматично точната комбинация, която изпълнява пакета.
      for (const r of offer.bundle_requirements || []) {
        const candidateIds = r.product_ids && r.product_ids.length > 0 ? r.product_ids : (r.product_id ? [r.product_id] : [])
        let addedOne = false
        for (const pid of candidateIds) {
          const product = byId.get(pid)
          if (!product) continue
          const variant = pickVariant(product, r.variant_id, r.size_liters)
          if (!variant) continue
          dispatchAddToCart(buildPayload(product, variant, r.qty || 1))
          addedOne = true
          break
        }
        if (!addedOne && candidateIds.length > 0) {
          console.warn(`[OffersShowcase] Няма наличен вариант ${r.size_liters ? r.size_liters + 'л' : ''} за оферта "${offer.title}"`)
        }
      }
    } else if (offer.trigger_type === 'product_in_cart' && rewardProduct && rewardVariant) {
      // ✅ Директно гарантираме, че И тригър-продуктът, И наградата са в количката —
      // без значение на коя страница сме и без значение дали единият вече е бил
      // добавен (напр. като награда на реципрочна оферта А↔Б). Проверяваме реалното
      // състояние на количката за всеки поотделно, за да не се дублира нищо и да не
      // се налагат няколко клика/страници, за да се "отключи" офертата.
      const triggerInCart = cartItems.some(i =>
        i.productId === offer.trigger_value &&
        (!offer.trigger_variant_id || i.variantId === offer.trigger_variant_id)
      )
      if (!triggerInCart) {
        const triggerProduct = byId.get(offer.trigger_value!)
        // Ако сме на самата страница на тригер-продукта и клиентът вече е избрал
        // конкретен вариант/размер — пазим точно него.
        const triggerVariant = (context === 'product' && offer.trigger_value === currentProductId && currentVariantId)
          ? pickVariant(triggerProduct, currentVariantId)
          : pickVariant(triggerProduct, offer.trigger_variant_id)
        if (triggerProduct && triggerVariant) dispatchAddToCart(buildPayload(triggerProduct, triggerVariant, 1))
      }

      const rewardInCart = cartItems.some(i =>
        i.productId === offer.offer_product_id &&
        (!offer.offer_variant_id || i.variantId === offer.offer_variant_id)
      )
      if (!rewardInCart) {
        dispatchAddToCart(buildPayload(rewardProduct, rewardVariant, 1))
      }
    }
    setAdded(true)
    setTimeout(() => setAdded(false), 2200)
  }

  return (
    <div className="mk-offer-card" style={{ borderLeftColor: meta.color }}>
      <div className="mk-offer-main">
        <div className="mk-offer-top">
          <span className="mk-offer-emoji" aria-hidden>{offer.emoji || '🎁'}</span>
          <span className="mk-offer-title">{offer.title}</span>
          <span className="mk-offer-type" style={{ color: meta.color, background: meta.bg }}>
            {meta.label}
          </span>
          {offer.badge_text && (
            <span className="mk-offer-badge" style={{ background: offer.badge_color || '#16a34a' }}>
              {offer.badge_text}
            </span>
          )}
        </div>

        {offer.description && <p className="mk-offer-desc">{offer.description}</p>}

        {/* ── Свободен избор: степъри за всеки продукт от групата ── */}
        {groupReq && !fulfilled && (
          <div className="mk-offer-picker">
            {groupCandidates.map(({ product, variant }) => {
              const info = perLiterInfo(product, variant)
              return (
                <div key={product.id} className="mk-offer-pick-row">
                  {product.img
                    ? <img src={product.img} alt={product.name} className="mk-offer-pick-img" loading="lazy" />
                    : <span className="mk-offer-pick-emoji">{product.emoji}</span>}
                  <div className="mk-offer-pick-info">
                    <span className="mk-offer-pick-name">{product.name}</span>
                    {info && (
                      <span className="mk-offer-pick-ppl">
                        {fmt(info.ppl, sym)}/л
                        {info.savingsPct && <span className="mk-offer-pick-save"> · -{info.savingsPct}% спрямо {info.vsLabel}</span>}
                      </span>
                    )}
                  </div>
                  <span className="mk-offer-pick-price">{fmt(variant.price, sym)}</span>
                  <div className="mk-offer-pick-stepper">
                    <button type="button" aria-label="Намали" onClick={() => adjustPick(product.id, -1, variant.stock)} disabled={(picks[product.id] || 0) <= 0}>−</button>
                    <span>{picks[product.id] || 0}</span>
                    <button type="button" aria-label="Увеличи" onClick={() => adjustPick(product.id, 1, variant.stock)} disabled={(picks[product.id] || 0) >= variant.stock}>+</button>
                  </div>
                </div>
              )
            })}
            <div className="mk-offer-pick-total">
              <span>Избрано: <strong>{pickedTotal}</strong> / {groupReq.qty} бр.</span>
              {pickedTotal > 0 && (
                <span className="mk-offer-pick-subtotal">
                  Междинна сума: <strong>{fmt(groupCandidates.reduce((s, { product, variant }) => s + (picks[product.id] || 0) * variant.price, 0), sym)}</strong>
                </span>
              )}
            </div>
            {pickedTotal >= (groupReq.qty || 1) && (
              <div className="mk-offer-pick-gift">
                🎁 + безплатна {groupReq.size_liters ? `${groupReq.size_liters}л` : ''} туба по твой избор
                {groupCandidates.length > 0 && (
                  <> (стойност до {fmt(Math.max(...groupCandidates.map(c => c.variant.price)), sym)})</>
                )}
              </div>
            )}
          </div>
        )}

        {!groupReq && (
          <div className="mk-offer-row">
            {involvedProducts.length > 0 && (
              <div className="mk-offer-products">
                {involvedProducts.slice(0, 4).map(p => (
                  <Link key={p.id} href={`/products/${p.slug}`} className="mk-offer-product" title={p.name}>
                    {p.img
                      ? <img src={p.img} alt={p.name} className="mk-offer-product-img" loading="lazy" />
                      : <span className="mk-offer-product-emoji">{p.emoji}</span>}
                  </Link>
                ))}
              </div>
            )}

            {isBundleReq && !fulfilled && progress.some(p => p.have > 0) && (
              <div className="mk-offer-progress">
                {progress.map((p, i) => (
                  <div key={i} className="mk-offer-progress-row">
                    <div className="mk-offer-progress-bar">
                      <div className="mk-offer-progress-fill" style={{ width: `${Math.min(100, (p.have / p.need) * 100)}%` }} />
                    </div>
                    <span>{Math.min(p.have, p.need)}/{p.need}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isBundleReq && fulfilled && (
          <div className="mk-offer-unlocked">✓ Условията са изпълнени — вземи подаръка в количката</div>
        )}
      </div>

      <div className="mk-offer-action">
        {(offer.bundle_price || offer.discount_pct || rewardVariant?.price === 0) && (
          <span className="mk-offer-price">
            {offer.bundle_price ? `🎁 ${fmt(offer.bundle_price, sym)}`
              : offer.discount_pct ? `-${offer.discount_pct}%`
              : '🎁 Подарък'}
          </span>
        )}
        {(!isBundleReq || !fulfilled) && (
          <button
            type="button"
            className="mk-offer-btn"
            style={{ background: meta.color }}
            onClick={handleAdd}
            disabled={added || (!!groupReq && pickedTotal === 0)}
          >
            {added ? '✓ Добавено'
              : groupReq ? `+ Добави ${pickedTotal || ''} бр.`
              : isBundleReq ? '+ Добави пакета' : '+ Добави'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Основен компонент ─────────────────────────────────────────────────────────
export default function OffersShowcase({
  offers, products, context, currentProductId, currentVariantId, currencySymbol = '€',
}: Props) {
  const cartItems = useLiveCartItems()
  const resolvedOffers = useSelfFetchedOffers(offers)

  const relevant = useMemo(() => {
    if (context === 'product') {
      if (!currentProductId) return []
      return offersForProduct(resolvedOffers, currentProductId)
    }
    return offersForHomepage(resolvedOffers)
  }, [resolvedOffers, context, currentProductId])

  if (relevant.length === 0) return null

  return (
    <section className={`mk-offers mk-offers--${context}`} aria-label="Активни оферти и пакети">
      <div className="mk-offers-head">
        <span className="mk-offers-head-emoji" aria-hidden>🎁</span>
        <h3 className="mk-offers-head-title">
          {context === 'product' ? 'Още по-изгодно с тази поръчка' : 'Активни оферти и пакети'}
        </h3>
      </div>
      <div className="mk-offers-grid">
        {relevant.map(offer => (
          <OfferPromoCard
            key={offer.id}
            offer={offer}
            products={products}
            context={context}
            currentProductId={currentProductId}
            currentVariantId={currentVariantId}
            sym={currencySymbol}
            cartItems={cartItems}
          />
        ))}
      </div>
    </section>
  )
}
