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

// ✅ Едно "готово" визуално вариант на bundle-а — снимка + фиксирана комбинация
// продукти/бройки, показани като статична карта с 1 бутон "Добави", вместо
// интерактивните степъри. Няколко showcase_cards на ЕДНА оферта = няколко
// рекламни визии (напр. "1 база + 2 амино" И "1 база + 1 амино + 1 нитро"),
// които водят до СЪЩОТО bundle_requirements правило отдолу — така няма риск
// от двоен подарък, ако клиентът избере повече от 1 карта.
export interface ShowcaseCardPick { product_id: string; qty: number }
export interface ShowcaseCard { id: string; image_url: string; label?: string; featured?: boolean; preset_picks: ShowcaseCardPick[] }

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
  reward_mode?: 'choice' | 'proportional'  // undefined/'choice' = сегашното "избери сам" поведение,
                                            // 'proportional' = ново — авто-разбивка по съотношение
                                            // на платените бройки, повтарящо се на всеки нов праг
  show_on_homepage?: boolean       // ✅ undefined/true = вижда се във витрината "🎁 Оферти и пакети" на
                                    //    началната (ако иначе отговаря на offersForHomepage). false = офертата
                                    //    си остава напълно активна (в количката, продуктови страници), само
                                    //    не се показва на homepage витрината.
  display_style?: 'interactive' | 'showcase'  // ✅ 'interactive' (default) = степъри, клиентът сам разпределя
                                    //    бройки. 'showcase' = статични карти (виж showcase_cards).
  showcase_cards?: ShowcaseCard[]  // ✅ Само когато display_style === 'showcase'.
  urgency_text?: string            // ✅ Кратък текст за краен срок/спешност, показва се до всеки бутон
                                    //    "Добави в количката" (напр. "Валидно до 30.09.2026").
  cta_label?: string                // ✅ Текст на бутона на всяка showcase карта (default "🛒 Вземи пакета")
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
    .filter(o => o.active && o.show_on_homepage !== false &&
      (o.type === 'cross_sell' || o.type === 'bundle') &&
      (o.trigger_type === 'bundle_requirements' || o.trigger_type === 'always'))
    .sort((a, b) => a.sort_order - b.sort_order)
}

// ✅ Продуктовите имена в базата са от вида "Atlas Terra — Органичен подобрител
// на почвата" — пълно за продуктова страница, но твърде дълго за прогрес
// банери/подаръчни pill-ове в тясната количка. Взимаме частта преди тирето.
export function shortProductLabel(name: string): string {
  const idx = name.indexOf('—')
  return (idx > 0 ? name.slice(0, idx) : name).trim()
}

// ─── NEW: "Пропорционално съотношение" — за повтарящи се bundle прагове ──────
// (напр. 300Л → 120Л подарък, разпределен по съотношението на купеното, и пак
// на 600Л, 900Л... на всеки нов пълен праг).

// ✅ Обобщение на offerIsSelfRewardAtOfferLevel, което покрива и "избери сам"/
// "пропорционално" наградите (offer_product_id е празен там — наградата идва от
// reward_choice_product_ids вместо от 1 фиксиран продукт).
export function offerHasSelfRewardOverlap(offer: UpsellOffer): boolean {
  const rewardIds = offer.offer_product_id
    ? [offer.offer_product_id]
    : (offer.reward_choice_product_ids || [])
  if (rewardIds.length === 0) return false
  return !!offer.bundle_requirements?.some(r => {
    const pool = r.product_ids && r.product_ids.length > 0 ? r.product_ids : (r.product_id ? [r.product_id] : [])
    return rewardIds.some(id => pool.includes(id))
  })
}

// ✅ Колко туби подарък има право да вземе СЕГА (наработени − вече взети).
// Изключваме собствените вече раздадени подаръци на тази оферта от "наработеното" —
// иначе подарените туби биха се броили ВТОРИ ПЪТ към следващия праг.
export function selfRewardAvailableQty(offer: UpsellOffer, items: OfferCartItemLike[]): number {
  const paidItems = offerHasSelfRewardOverlap(offer)
    ? items.filter(i => !(i.fromOffer && i.offerId === offer.id))
    : items
  const earned = bundleFulfillmentQty(offer, paidItems)
  const claimed = items.filter(i => i.fromOffer && i.offerId === offer.id).reduce((s, i) => s + i.qty, 0)
  return Math.max(0, earned - claimed)
}

// ✅ Прогрес към СЛЕДВАЩИЯ праг (модуло — след 1-ви достигнат праг, "имаш 16/15"
// няма смисъл; вместо това показва "имаш 1/15 към следващия подарък").
export function bundleProgressIntoCurrentSet(
  offer: UpsellOffer, items: OfferCartItemLike[]
): { have: number; need: number } | null {
  if (!offer.bundle_requirements?.length) return null
  const paidItems = offerHasSelfRewardOverlap(offer)
    ? items.filter(i => !(i.fromOffer && i.offerId === offer.id))
    : items
  const progress = computeBundleProgress(offer, paidItems)
  const p = progress[0]
  if (!p || p.need <= 0) return null
  return { have: p.have % p.need, need: p.need }
}

// ✅ Разпределя X туби подарък пропорционално на СЪОТНОШЕНИЕТО на платените
// бройки в количката (largest-remainder закръгляне — сборът винаги излиза точно
// X; при равен remainder печели продуктът с най-много купени бройки).
export interface ProportionalRewardPick { product_id: string; qty: number }

export function computeProportionalRewardSplit(
  offer: UpsellOffer, qtyToDistribute: number, items: OfferCartItemLike[]
): ProportionalRewardPick[] {
  const pool = offer.reward_choice_product_ids || []
  if (pool.length === 0 || qtyToDistribute <= 0) return []
  const sizeLiters = offer.reward_choice_size_liters

  // ✅ Всяка предходна награда е "изяла" част от платения пул — реконструираме
  // колко точно, като мащабираме обратно нагоре състава на ВЕЧЕ взетите
  // подаръци (те бяха изчислени пропорционално на платеното в момента на
  // взимането им, така че обратното мащабиране възстановява точно тази част
  // от пула). Изваждаме я, за да не "тежат" старите покупки в съотношението
  // на СЛЕДВАЩата награда — иначе по-новите покупки се размиват от историята.
  const req = offer.bundle_requirements?.[0]
  const setSize = req?.qty || 0
  const rewardPerSet = offer.reward_qty || 1
  const scale = rewardPerSet > 0 ? setSize / rewardPerSet : 0
  const claimedByProduct = new Map<string, number>()
  if (scale > 0) {
    for (const i of items) {
      if (i.fromOffer && i.offerId === offer.id) {
        claimedByProduct.set(i.productId, (claimedByProduct.get(i.productId) || 0) + i.qty)
      }
    }
  }

  const haveByProduct = pool.map(pid => {
    const paid = items
      .filter(i => i.productId === pid && !i.fromOffer && (!sizeLiters || Number(i.size_liters) === Number(sizeLiters)))
      .reduce((s, i) => s + i.qty, 0)
    const consumed = (claimedByProduct.get(pid) || 0) * scale
    return { pid, have: Math.max(0, paid - consumed) }
  })
  const totalHave = haveByProduct.reduce((s, p) => s + p.have, 0)
  if (totalHave <= 0) return []

  const withFloors = haveByProduct.map(p => {
    const exact = (p.have / totalHave) * qtyToDistribute
    return { pid: p.pid, have: p.have, floor: Math.floor(exact), remainder: exact - Math.floor(exact) }
  })
  const assigned = withFloors.reduce((s, f) => s + f.floor, 0)
  const remaining = qtyToDistribute - assigned

  const order = [...withFloors].sort((a, b) => b.remainder - a.remainder || b.have - a.have)
  const result = new Map(withFloors.map(f => [f.pid, f.floor]))
  for (let i = 0; i < remaining && i < order.length; i++) {
    result.set(order[i].pid, (result.get(order[i].pid) || 0) + 1)
  }
  return pool.map(pid => ({ product_id: pid, qty: result.get(pid) || 0 })).filter(r => r.qty > 0)
}
