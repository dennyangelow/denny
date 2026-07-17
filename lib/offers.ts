// lib/offers.ts — v1
// ─────────────────────────────────────────────────────────────────────────────
// Единствен източник на истина за маркетинг-офертната логика (upsell / cross-sell /
// bundle). Преди тази логика живееше дублирана само вътре в CartSystem.tsx.
// Сега CartSystem.tsx, OffersShowcase.tsx (homepage + продуктова страница) и всяко
// бъдещо място, което трябва да "разбира" офертите, викат ЕДНИ И СЪЩИ функции оттук —
// без риск номерата да се разминат между количката и промо секциите на страниците.
//
// ⚠️ Всички функции тук са ЧИСТИ (без React, без window/localStorage) — може да се
// ползват както на клиента, така и на сървъра (напр. в page.tsx за SSR подготовка).

// ─── Типове ────────────────────────────────────────────────────────────────────
export interface BundleRequirement {
  product_id: string
  variant_id: string
  qty: number
  product_ids?: string[]   // групово условие: сумира количествата на ВСИЧКИ изброени продукти
  size_liters?: number     // филтър по литри за групово условие
}

export type OfferType = 'cart_upsell' | 'cross_sell' | 'post_purchase' | 'bundle'
export type TriggerType = 'always' | 'product_in_cart' | 'cart_above' | 'cart_below' | 'bundle_requirements'

export interface UpsellOffer {
  id: string; type: OfferType; active: boolean
  title: string; description: string; emoji: string; image_url?: string
  badge_text?: string; badge_color?: string
  trigger_type: TriggerType
  trigger_value?: string; trigger_variant_id?: string
  offer_product_id?: string; offer_variant_id?: string
  reward_choice_product_ids?: string[]
  reward_choice_size_liters?: number
  discount_pct?: number; bundle_price?: number; sort_order: number
  bundle_requirements?: BundleRequirement[]
  reward_qty?: number
}

export interface MarketingSettings {
  upsell_enabled: boolean; cross_sell_enabled: boolean; post_purchase_enabled: boolean
  progress_bar_enabled: boolean; progress_goal_amount: number; progress_goal_label: string
  post_purchase_delay: number; offers: UpsellOffer[]
}

export interface OfferVariantLike {
  id: string; product_id: string; label: string; size_liters: number
  price: number; compare_price: number; price_per_liter: number; stock: number; active: boolean
}

// Минималният "ред от количката", от който тези функции имат нужда — CartSystem си
// има собствен по-богат CartItem, но той е структурно съвместим (structural typing).
export interface OfferCartItemLike {
  productId: string; variantId: string; qty: number; price: number; size_liters?: number
  fromOffer?: boolean; offerId?: string
}

// ─── Основни правила за match-ване на тригер ───────────────────────────────────
export function requirementsMet(reqs: BundleRequirement[] | undefined, items: OfferCartItemLike[]): boolean {
  if (!reqs || reqs.length === 0) return false
  return reqs.every(r => {
    const have = r.product_ids && r.product_ids.length > 0
      ? items
          .filter(i => r.product_ids!.includes(i.productId) && (!r.size_liters || Number(i.size_liters) === Number(r.size_liters)))
          .reduce((sum, i) => sum + i.qty, 0)
      : items
          .filter(i => i.productId === r.product_id && (!r.variant_id || i.variantId === r.variant_id))
          .reduce((sum, i) => sum + i.qty, 0)
    return have >= (r.qty || 1)
  })
}

export function offerMatches(offer: UpsellOffer, items: OfferCartItemLike[], subtotal: number): boolean {
  if (!offer.active) return false
  switch (offer.trigger_type) {
    case 'always':          return true
    case 'product_in_cart': return items.some(i =>
      i.productId === offer.trigger_value &&
      (!offer.trigger_variant_id || i.variantId === offer.trigger_variant_id)
    )
    case 'cart_above':      return subtotal > Number(offer.trigger_value || 0)
    case 'cart_below':      return subtotal < Number(offer.trigger_value || 999999)
    case 'bundle_requirements': return requirementsMet(offer.bundle_requirements, items)
    default:                return false
  }
}

// ✅ Bundle, чиято награда е СЪЩИЯТ продукт+вариант като едно от условията му
// (напр. купи 5×20л → получи +1×20л подарък).
export function isSelfRewardBundle(offer: UpsellOffer, variantId: string): boolean {
  if (offer.type !== 'bundle' || !offer.offer_product_id) return false
  return !!offer.bundle_requirements?.some(r =>
    r.product_ids && r.product_ids.length > 0
      ? r.product_ids.includes(offer.offer_product_id!)
      : r.product_id === offer.offer_product_id && (!r.variant_id || r.variant_id === variantId)
  )
}

export function offerIsSelfRewardAtOfferLevel(offer: UpsellOffer): boolean {
  if (!offer.offer_product_id) return false
  return !!offer.bundle_requirements?.some(r =>
    r.product_ids && r.product_ids.length > 0 ? r.product_ids.includes(offer.offer_product_id!) : r.product_id === offer.offer_product_id
  )
}

// ✅ Засича "огледален" чифт оферти (А отстъпва Б И Б отстъпва А едновременно) —
// печели тази с по-нисък sort_order (после по-малкото id).
export function reciprocalOfferLoses(offer: UpsellOffer, allOffers: UpsellOffer[]): boolean {
  if (offer.trigger_type !== 'product_in_cart' || !offer.offer_product_id) return false
  const mirror = allOffers.find(o2 =>
    o2.id !== offer.id && o2.active &&
    (o2.type === 'cross_sell' || o2.type === 'bundle') &&
    o2.trigger_type === 'product_in_cart' &&
    o2.trigger_value === offer.offer_product_id &&
    (!o2.trigger_variant_id || !offer.offer_variant_id || o2.trigger_variant_id === offer.offer_variant_id) &&
    o2.offer_product_id === offer.trigger_value &&
    (!o2.offer_variant_id || !offer.trigger_variant_id || o2.offer_variant_id === offer.trigger_variant_id)
  )
  if (!mirror) return false
  if (mirror.sort_order !== offer.sort_order) return mirror.sort_order < offer.sort_order
  return mirror.id < offer.id
}

// ✅ За всяко условие на bundle_requirements — колко има клиентът срещу колко трябват.
export function computeBundleProgress(
  offer: UpsellOffer, items: OfferCartItemLike[]
): { req: BundleRequirement; have: number; need: number }[] {
  return (offer.bundle_requirements || []).map(r => {
    const have = r.product_ids && r.product_ids.length > 0
      ? items.filter(i => r.product_ids!.includes(i.productId) && (!r.size_liters || Number(i.size_liters) === Number(r.size_liters))).reduce((s, i) => s + i.qty, 0)
      : items.filter(i => i.productId === r.product_id && (!r.variant_id || i.variantId === r.variant_id)).reduce((s, i) => s + i.qty, 0)
    return { req: r, have, need: r.qty || 1 }
  })
}

export function bundleHasProgress(offer: UpsellOffer, items: OfferCartItemLike[]): boolean {
  const progress = computeBundleProgress(offer, items)
  return progress.some(p => p.have > 0) && progress.some(p => p.have < p.need)
}

// ✅ Офертите, управлявани от количествено-ограниченото "чифтосване" в CartSystem.
export function isPairingManagedOffer(offer: UpsellOffer, allOffers: UpsellOffer[]): boolean {
  return offer.active &&
    (offer.type === 'cross_sell' || offer.type === 'bundle') &&
    (offer.trigger_type === 'product_in_cart' || offer.trigger_type === 'bundle_requirements') &&
    !!offer.offer_product_id &&
    !offer.reward_choice_product_ids?.length &&
    !offerIsSelfRewardAtOfferLevel(offer) &&
    !reciprocalOfferLoses(offer, allOffers)
}

// ✅ Колко бройки от офертния продукт могат да са на офертна цена в момента.
export function bundleFulfillmentQty(offer: UpsellOffer, items: OfferCartItemLike[]): number {
  if (offer.trigger_type === 'product_in_cart') {
    const triggerQty = items
      .filter(i => i.productId === offer.trigger_value && (!offer.trigger_variant_id || i.variantId === offer.trigger_variant_id))
      .reduce((s, i) => s + i.qty, 0)
    return triggerQty * (offer.reward_qty || 1)
  }
  if (offer.trigger_type === 'bundle_requirements' && offer.bundle_requirements?.length) {
    const progress = computeBundleProgress(offer, items)
    const sets = Math.min(...progress.map(p => Math.floor(p.have / p.need)))
    return isFinite(sets) && sets > 0 ? sets * (offer.reward_qty || 1) : 0
  }
  return 0
}

// ✅ Ценова логика на офертния ред (bundle_price взима превес над discount_pct).
export function computeOfferItemPricing(offer: UpsellOffer, variant: OfferVariantLike, cartItems: OfferCartItemLike[]) {
  const variantPrice   = Number(variant.price)
  const variantCompare = Number(variant.compare_price ?? 0)
  const triggerItem = offer.trigger_type === 'product_in_cart'
    ? cartItems.find(i => i.productId === offer.trigger_value && (!offer.trigger_variant_id || i.variantId === offer.trigger_variant_id))
    : undefined
  const hasBundlePrice  = !!(offer.bundle_price && offer.bundle_price > 0 && triggerItem)
  const bundleItemPrice = hasBundlePrice ? +Math.max(0, offer.bundle_price! - triggerItem!.price).toFixed(2) : 0
  const hasPctDiscount  = !hasBundlePrice && !!(offer.discount_pct && offer.discount_pct > 0)
  const discountedPrice = hasBundlePrice ? bundleItemPrice
    : hasPctDiscount ? +(variantPrice * (1 - offer.discount_pct! / 100)).toFixed(2) : variantPrice
  const oldPrice = hasBundlePrice ? variantPrice
    : hasPctDiscount ? variantPrice : variantCompare > variantPrice ? variantCompare : 0
  return { variantPrice, variantCompare, hasBundlePrice, hasPctDiscount, discountedPrice, oldPrice }
}

// ─── NEW: helper-и специално за показване на оферти НА СТРАНИЦАТА (не в drawer-а) ──

// Всички ID-та на продукти, участващи в тригера или наградата на една оферта —
// ползва се и за "за кой продукт е релевантна тази оферта", и за резолвване на
// снимки/имена при рендер на картата.
export function offerRelatedProductIds(offer: UpsellOffer): string[] {
  const ids = new Set<string>()
  if (offer.trigger_value && offer.trigger_type === 'product_in_cart') ids.add(offer.trigger_value)
  if (offer.offer_product_id) ids.add(offer.offer_product_id)
  if (offer.reward_choice_product_ids) offer.reward_choice_product_ids.forEach(id => ids.add(id))
  ;(offer.bundle_requirements || []).forEach(r => {
    if (r.product_id) ids.add(r.product_id)
    ;(r.product_ids || []).forEach(id => ids.add(id))
  })
  return Array.from(ids)
}

/**
 * Офертите, които има смисъл да се рекламират на страницата на КОНКРЕТЕН продукт —
 * т.е. продуктът участва в тригера или в условията на bundle-а. Подредени с
 * по-специфичните (product_in_cart / bundle_requirements за точно този продукт)
 * преди общите "always" промоции.
 */
export function offersForProduct(offers: UpsellOffer[], productId: string): UpsellOffer[] {
  const relevant = offers.filter(o => {
    if (!o.active || o.type === 'post_purchase') return false
    if (o.trigger_type === 'product_in_cart') return o.trigger_value === productId
    if (o.trigger_type === 'bundle_requirements') {
      return !!o.bundle_requirements?.some(r =>
        r.product_ids && r.product_ids.length > 0 ? r.product_ids.includes(productId) : r.product_id === productId
      )
    }
    if (o.trigger_type === 'always') return true
    return false
  })
  return relevant.sort((a, b) => {
    const specificity = (o: UpsellOffer) => o.trigger_type === 'always' ? 1 : 0
    return specificity(a) - specificity(b) || a.sort_order - b.sort_order
  })
}

/**
 * Офертите за общата "🎁 Оферти и пакети" секция на началната страница —
 * САМО общи промоции, които имат смисъл БЕЗ анкор към конкретен продукт:
 * 'bundle_requirements' ("събери 100Л от каквото и да е") и 'always'.
 * ⚠️ Изрично изключваме 'product_in_cart' тук — тези оферти са дефинирани
 * като чифт "продукт А → продукт Б" и имат смисъл само когато вече знаем
 * кой е "текущият" продукт (продуктова страница) или вече е в количката
 * (drawer-а). На homepage няма такъв анкор — освен объркващо, реципрочен
 * чифт (А→Б отстъпва Б, И Б→А отстъпва А) би се показал като ДВЕ отделни
 * карти за едно и също нещо. offersForProduct() и CartSystem продължават
 * да ги показват напълно нормално на правилните места.
 */
export function offersForHomepage(offers: UpsellOffer[]): UpsellOffer[] {
  return offers
    .filter(o => o.active && (o.type === 'cross_sell' || o.type === 'bundle') &&
      (o.trigger_type === 'bundle_requirements' || o.trigger_type === 'always'))
    .sort((a, b) => a.sort_order - b.sort_order)
}
