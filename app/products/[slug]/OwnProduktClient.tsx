'use client'
// app/products/[slug]/OwnProduktClient.tsx — v15
// ✅ ПОПРАВКИ спрямо v14:
//   - ProductSchema компонент: faqSchema ПРЕМАХНАТ — живее само в page.tsx (server)
//     Дублирането причиняваше "Дублиращо се поле FAQPage" в Google Search Console
//   - FAQ секция: itemScope/itemType="FAQPage" ПРЕМАХНАТИ от <section> тага
//     (inline microdata се дублираше с JSON-LD от page.tsx)
//   - FaqAccordion: itemScope/itemProp атрибутите ПРЕМАХНАТИ — дублираха schema
//   - review_count и avg_rating добавени в OwnProduct interface
//   - created_at и updated_at добавени в OwnProduct interface
//   - Рейтинг ред: показва реален брой отзиви ако има, иначе показва testimonial

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { HeaderClient } from '@/components/client/HeaderClient'
import { CartSystem }   from '@/components/client/CartSystem'
import SiteFooter       from '@/components/layout/SiteFooter'
import './own-produkt.css'

// ─── Types ──────────────────────────────────────────────────────────────────────
interface SiteSettings {
  shipping_econt:       number
  shipping_speedy:      number
  free_shipping_above:  number
  currency_symbol:      string
  site_phone:           string
  site_email:           string
  urgency_bar_text:     string
  urgency_bar_products: string
}
const SETTINGS_DEFAULTS: SiteSettings = {
  shipping_econt: 5, shipping_speedy: 5.5, free_shipping_above: 60,
  currency_symbol: '€', site_phone: '+359 876 238 623',
  site_email: 'info@dennyangelow.com', urgency_bar_text: '',
  urgency_bar_products: '🌱 **Atlas Terra** — Органичен биостимулант · 📦 **Безплатна доставка** при 10л+ · 💵 Само наложен платеж',
}

interface ProductVariant {
  id: string; product_id: string; label: string; size_liters: number
  price: number; compare_price: number; price_per_liter: number
  stock: number; active: boolean; sort_order: number
}
interface FaqItem      { q: string; a: string }
interface HowItem      { icon: string; title: string; text: string }
interface CropRow      { name: string; leaf: string; soil: string; seed?: string }
interface WhyItem      { icon: string; title: string; text: string }
interface EcoBadge     { label: string; color: 'green'|'blue'|'brown'|'gold' }
interface Testimonial  { name: string; location: string; text: string; rating?: number }
interface StatItem     { label: string; value: string; sub?: string }
interface CompItem     { name: string; value: string; pct?: number; note?: string }

interface OwnProduct {
  id: string; slug: string; name: string; subtitle?: string; description?: string
  badge?: string; emoji?: string; image_url?: string; image_alt?: string
  features?: string[]; usage_notes?: string; category?: string
  seo_title?: string; seo_description?: string; seo_keywords?: string
  stock: number; active: boolean; variants?: ProductVariant[]
  faq?: FaqItem[]; how_it_works?: HowItem[]; crops?: CropRow[]
  testimonial?: Testimonial; why_items?: WhyItem[]
  eco_badges?: EcoBadge[]; certifications?: string[]
  stats?: StatItem[]
  composition?: CompItem[]
  composition_ph?: string
  // ✅ Реални данни от БД
  review_count?: number
  avg_rating?: number
  created_at?: string
  updated_at?: string
}
interface Props {
  product: OwnProduct; related: OwnProduct[]
  outOfStock: boolean; initialSettings: SiteSettings
}

// ─── Cart item type (съвпада с CartSystem CartItem) ──────────────────────────
interface CartItemPayload {
  productId:    string
  variantId:    string
  productName:  string
  variantLabel: string
  price:        number
  comparePrice: number
  qty:          number
  emoji:        string
  img:          string
  size_liters:  number
}

// ─── Helpers ────────────────────────────────────────────────────────────────────
function dispatchAddToCart(payload: CartItemPayload) {
  window.dispatchEvent(new CustomEvent<CartItemPayload>('cart:add', { detail: payload }))
}

const fmt = (n: number, sym = '€') => `${Number(n).toFixed(2)} ${sym}`
const md  = (t: string) => t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
const pct = (p: number, c: number) => !c || c <= p ? 0 : Math.round((1 - p / c) * 100)

// ─── Schema.org (Product САМО) ────────────────────────────────────────────────
// ✅ FAQPage schema е ПРЕМАХНАТА от тук — живее само в page.tsx (server component)
// ✅ BreadcrumbList е ПРЕМАХНАТА от тук — живее само в page.tsx (server component)
// Дублирането на тези schemas причиняваше грешки в Google Search Console
function ProductSchema({
  product, variant, sym,
}: {
  product: OwnProduct; variant: ProductVariant | null; sym: string
}) {
  const oos = !variant || variant.stock === 0

  // ✅ AggregateRating само ако имаме РЕАЛЕН брой отзиви от БД
  const hasRealRating =
    typeof product.review_count === 'number' && product.review_count > 0 &&
    typeof product.avg_rating   === 'number' && product.avg_rating   > 0

  const schema = {
    '@context': 'https://schema.org',
    '@type':    'Product',
    name:        product.name,
    description: product.description || '',
    image:       product.image_url ? [product.image_url] : [],
    brand:       { '@type': 'Brand', name: 'Atlas Terra' },
    ...(product.seo_keywords ? { keywords: product.seo_keywords } : {}),
    offers: {
      '@type':        'Offer',
      priceCurrency:   sym === 'лв.' ? 'BGN' : 'EUR',
      price:           (variant?.price ?? 0).toFixed(2),
      availability:    oos ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      seller:          { '@type': 'Organization', name: 'Denny Angelow' },
      url:             `https://dennyangelow.com/products/${product.slug}`,
    },
    ...(hasRealRating ? {
      aggregateRating: {
        '@type':      'AggregateRating',
        ratingValue:   product.avg_rating!.toFixed(1),
        reviewCount:   product.review_count!,
        bestRating:    5,
        worstRating:   1,
      },
    } : {}),
  }

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────────
function Stars({ rating = 4.9 }: { rating?: number }) {
  return (
    <span className="op-stars" aria-label={`${rating} от 5 звезди`}>
      {[1,2,3,4,5].map(i => (
        <span key={i} className={i <= Math.round(rating) ? 'op-star op-star--on' : 'op-star'}>★</span>
      ))}
    </span>
  )
}

function RelatedCard({ r, fmtFn }: { r: OwnProduct; fmtFn: (n: number) => string }) {
  const v = (r.variants || []).find(v => v.active && v.stock > 0) || (r.variants || [])[0]
  const oos = !v || v.stock === 0
  return (
    <Link href={`/products/${r.slug}`} className="op-related-card">
      {r.image_url && <img src={r.image_url} alt={r.image_alt || r.name} className="op-related-img" width={54} height={54} />}
      <div className="op-related-info">
        <div className="op-related-name">{r.emoji} {r.name.split(' — ')[0]}</div>
        <div className="op-related-sub">{r.subtitle}</div>
        {v && <div className="op-related-price">{oos ? '⚠️ Изчерпан' : fmtFn(v.price)}</div>}
      </div>
      <span className="op-related-arrow" aria-hidden>→</span>
    </Link>
  )
}

// ✅ FaqAccordion: itemScope/itemProp атрибутите ПРЕМАХНАТИ
// Inline microdata се дублираше с JSON-LD от page.tsx → грешки в Search Console
function FaqAccordion({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="op-faq-item">
      <button className="op-faq-q" onClick={() => setOpen(v => !v)} type="button" aria-expanded={open}>
        <span>{q}</span>
        <span className={`op-faq-icon${open ? ' open' : ''}`} aria-hidden>+</span>
      </button>
      {open && (
        <div>
          <p className="op-faq-a">{a}</p>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────────
export default function OwnProduktClient({
  product, related, outOfStock, initialSettings,
}: Props) {
  const activeVariants = (product.variants || []).filter(v => v.active)
  const [selVariant, setSelVariant] = useState<ProductVariant | null>(
    activeVariants.find(v => v.stock > 0) || activeVariants[0] || null
  )
  const [added,     setAdded]     = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  const settings     = initialSettings
  const sym          = settings.currency_symbol
  const fmtFn        = (n: number) => fmt(n, sym)
  const freeAbove    = settings.free_shipping_above
  const freeAboveFmt = `${freeAbove} ${sym}`
  const shippingMin  = Math.min(settings.shipping_econt, settings.shipping_speedy)

  const variant      = selVariant
  const price        = variant?.price ?? 0
  const comparePrice = variant?.compare_price ?? 0
  const discount     = pct(price, comparePrice)
  const isOOS        = outOfStock || (variant ? variant.stock === 0 : true)

  const urgencyRaw = settings.urgency_bar_products?.trim() || SETTINGS_DEFAULTS.urgency_bar_products

  const handleAddToCart = useCallback(() => {
    if (!variant || isOOS) return
    const payload: CartItemPayload = {
      productId:    product.id,
      variantId:    variant.id,
      productName:  product.name,
      variantLabel: variant.label,
      price:        variant.price,
      comparePrice: variant.compare_price ?? 0,
      qty:          1,
      emoji:        product.emoji || '🌱',
      img:          product.image_url || '',
      size_liters:  variant.size_liters ?? 0,
    }
    dispatchAddToCart(payload)
    setAdded(true)
    setTimeout(() => setAdded(false), 2500)
  }, [variant, isOOS, product])

  const usageLines = (product.usage_notes || '')
    .split(/\.\s*/).map(s => s.replace(/^[^:]+:\s*/, '').trim()).filter(Boolean)

  const faq         = product.faq          || []
  const howItems    = product.how_it_works || []
  const crops       = product.crops        || []
  const whyItems    = product.why_items    || []
  const ecoBadges   = product.eco_badges   || []
  const testimonial = product.testimonial
  const stats       = product.stats        || []
  const composition = product.composition  || []

  // ✅ Рейтинг — реален от БД → testimonial → fallback
  const displayRating = product.avg_rating ?? testimonial?.rating ?? 4.9
  const displayReviewCount = product.review_count && product.review_count > 0
    ? `${product.review_count} отзива`
    : testimonial?.name
      ? '1+ отзива'
      : '124+ отзива'

  const badgeClass: Record<string, string> = {
    green: 'op-eco-badge--green', blue: 'op-eco-badge--blue',
    brown: 'op-eco-badge--brown', gold: 'op-eco-badge--gold',
  }

  return (
    <div className="op-page">
      {/* ✅ ProductSchema — само Product type, без FAQ/Breadcrumb (те са в page.tsx) */}
      <ProductSchema product={product} variant={variant} sym={sym} />

      {/* Urgency bar */}
      {urgencyRaw && (
        <div className="op-urgency-bar" role="banner"
          dangerouslySetInnerHTML={{ __html: md(urgencyRaw) }} />
      )}

      <HeaderClient
        shippingPrice={shippingMin}
        freeShippingAbove={freeAbove}
      />

      <CartSystem
        atlasProducts={[]}
        shippingPrice={shippingMin}
        freeShippingAbove={freeAbove}
        siteEmail={settings.site_email}
        sitePhone={settings.site_phone}
        currencySymbol={sym}
      />

      <main className="op-main">
        <div className="op-container">

          {/* Breadcrumb */}
          <nav className="op-breadcrumb" aria-label="Навигационна пътека">
            <Link href="/">Начало</Link>
            <span aria-hidden>›</span>
            <Link href="/produkti">Продукти</Link>
            <span aria-hidden>›</span>
            <strong aria-current="page">{product.name.split(' — ')[0]}</strong>
          </nav>

          {/* ══ MAIN GRID ══ */}
          <div className="op-grid">

            {/* LEFT: снимка */}
            <div className="op-left">
              <div className="op-img-card">
                {product.badge && (
                  <div className="op-img-badge">{product.emoji} {product.badge}</div>
                )}
                <div className={`op-img-wrap${imgLoaded ? ' op-img-wrap--loaded' : ''}`}>
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.image_alt || product.name}
                      className="op-img"
                      onLoad={() => setImgLoaded(true)}
                      width={500} height={500} fetchPriority="high"
                    />
                  ) : (
                    <div className="op-img-placeholder">{product.emoji || '🌱'}</div>
                  )}
                </div>

                {ecoBadges.length > 0 && (
                  <div className="op-eco-badges">
                    {ecoBadges.map((b, i) => (
                      <span key={i} className={`op-eco-badge ${badgeClass[b.color] || 'op-eco-badge--green'}`}>
                        {b.label}
                      </span>
                    ))}
                  </div>
                )}

                {product.certifications && product.certifications.length > 0 && (
                  <div className="op-certifications">
                    {product.certifications.map((c, i) => (
                      <span key={i} className="op-cert-item">🏅 {c}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Related — desktop */}
              {related.length > 0 && (
                <aside className="op-related op-related--desktop">
                  <h3 className="op-related-title">От същата гама</h3>
                  <div className="op-related-list">
                    {related.map(r => <RelatedCard key={r.slug} r={r} fmtFn={fmtFn} />)}
                  </div>
                </aside>
              )}
            </div>

            {/* RIGHT: sticky buy panel */}
            <div className="op-right">
              <div className="op-sticky">

                {/* Info card */}
                <div className="op-info-card">
                  <div className="op-category">
                    {product.emoji} Atlas Terra · {product.category || 'Биостимулант'}
                  </div>
                  <h1 className="op-title">{product.name}</h1>
                  {product.subtitle && <p className="op-subtitle">{product.subtitle}</p>}
                  <div className="op-rating-row">
                    <Stars rating={displayRating} />
                    <span className="op-rating-text">
                      {displayRating.toFixed(1)}
                      {' · '}
                      {displayReviewCount}
                    </span>
                    <span className="op-separator">·</span>
                    <span className={`op-instock-text${isOOS ? ' op-instock-text--oos' : ''}`}>
                      {isOOS ? '⚠️ Изчерпан' : '✓ В наличност'}
                    </span>
                  </div>
                </div>

                {/* Key stats */}
                {stats.length > 0 && (
                  <div className="op-stats-row">
                    {stats.slice(0, 3).map((s, i) => (
                      <div key={i} className="op-stat">
                        <div className="op-stat-value">{s.value}</div>
                        <div className="op-stat-label">{s.label}</div>
                        {s.sub && <div className="op-stat-sub">{s.sub}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Variant selector + cart */}
                {activeVariants.length > 0 && (
                  <div className="op-buy-card">
                    <div className="op-section-label">Изберете размер</div>

                    <div className="op-variants">
                      {activeVariants.map(v => {
                        const vDis = pct(v.price, v.compare_price)
                        return (
                          <button
                            key={v.id} type="button"
                            className={[
                              'op-variant-btn',
                              selVariant?.id === v.id ? 'op-variant-btn--selected' : '',
                              v.stock === 0            ? 'op-variant-btn--oos'      : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => v.stock > 0 && setSelVariant(v)}
                            aria-pressed={selVariant?.id === v.id}
                            aria-label={`${v.label} — ${fmtFn(v.price)}${v.stock === 0 ? ' (изчерпан)' : ''}`}
                          >
                            <span className="op-variant-label">{v.label}</span>
                            <span className="op-variant-price">{fmtFn(v.price)}</span>
                            {v.price_per_liter > 0 && (
                              <span className="op-variant-ppl">{fmtFn(v.price_per_liter)}/л</span>
                            )}
                            {vDis > 0 && <span className="op-variant-discount">-{vDis}%</span>}
                            {v.stock === 0 && <span className="op-variant-oos-label">Изчерпан</span>}
                          </button>
                        )
                      })}
                    </div>

                    {variant && (
                      <div className="op-price-row">
                        <span className="op-price">{fmtFn(price)}</span>
                        {discount > 0 && <>
                          <span className="op-compare-price">{fmtFn(comparePrice)}</span>
                          <span className="op-discount-badge">-{discount}%</span>
                        </>}
                      </div>
                    )}

                    <button
                      type="button"
                      className={['op-add-btn', isOOS ? 'op-add-btn--oos' : '', added ? 'op-add-btn--added' : ''].filter(Boolean).join(' ')}
                      onClick={handleAddToCart}
                      disabled={isOOS}
                      aria-label={isOOS ? 'Изчерпан' : `Добави ${variant?.label} в количката`}
                    >
                      {isOOS ? '⚠️ Изчерпан' : added ? '✓ Добавено в количката!' : `🛒 Добави — ${variant ? fmtFn(price) : ''}`}
                    </button>

                    <a href="#s-about" className="op-learn-link" aria-label="Прочети повече за продукта">
                      <span className="op-learn-icon" aria-hidden>📖</span>
                      <span className="op-learn-text">
                        Как се прилага и за какво е {product.name.split(' — ')[0]}?
                      </span>
                      <span className="op-learn-arrow" aria-hidden>↓</span>
                    </a>

                    <div className="op-trust">
                      <div className="op-trust-item">🚚 Безплатна доставка над {freeAboveFmt}</div>
                      <div className="op-trust-item">💵 Само наложен платеж</div>
                      <div className="op-trust-item">📞 Консултация при поръчка</div>
                    </div>
                  </div>
                )}

                {/* Author card */}
                <div className="op-author-card">
                  <div className="op-author-avatar">🧑‍🌾</div>
                  <div className="op-author-info">
                    <div className="op-author-name">Denny Angelow</div>
                    <div className="op-author-role">Агро Консултант · 8+ години опит</div>
                    <div className="op-author-text">
                      Лично тествах и препоръчвам Atlas Terra — видими резултати от първото приложение.
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>{/* /op-grid */}

          {/* ══ SEO CONTENT СЕКЦИИ ══ */}
          <div className="op-content">

            {/* 1. Описание + Features */}
            {product.description && (
              <section className="op-content-card" aria-labelledby="s-about">
                <h2 id="s-about" className="op-section-title">За продукта</h2>
                <p className="op-desc">{product.description}</p>
                {product.features && product.features.length > 0 && (
                  <ul className="op-features">
                    {product.features.map((f, i) => (
                      <li key={i} className="op-feature">
                        <span className="op-feature-check" aria-hidden>✓</span>{f}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* 2. Химичен състав */}
            {composition.length > 0 && (
              <section className="op-content-card op-content-card--composition" aria-labelledby="s-comp">
                <h2 id="s-comp" className="op-section-title">Химичен състав</h2>
                <div className="op-composition-grid">
                  {composition.map((c, i) => (
                    <div key={i} className="op-comp-item">
                      <div className="op-comp-name">{c.name}</div>
                      <div className="op-comp-value">{c.value}</div>
                      {c.note && <div className="op-comp-note">{c.note}</div>}
                      {c.pct !== undefined && (
                        <div className="op-comp-bar-wrap">
                          <div className="op-comp-bar" style={{ width: `${Math.min(c.pct, 100)}%` }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {product.composition_ph && (
                  <div className="op-comp-ph">
                    ⚗️ <strong>pH:</strong> {product.composition_ph} — неутрален, съвместим с всички системи
                  </div>
                )}
              </section>
            )}

            {/* 3. Как работи */}
            {howItems.length > 0 && (
              <section className="op-content-card op-content-card--how" aria-labelledby="s-how">
                <h2 id="s-how" className="op-section-title">Как работи</h2>
                <div className="op-how-grid">
                  {howItems.map((item, i) => (
                    <div key={i} className="op-how-item">
                      <div className="op-how-num" aria-hidden>{i + 1}</div>
                      <div className="op-how-icon" aria-hidden>{item.icon}</div>
                      <div className="op-how-title">{item.title}</div>
                      <div className="op-how-text">{item.text}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 4. Начин на употреба */}
            {usageLines.length > 0 && (
              <section className="op-content-card op-content-card--usage" aria-labelledby="s-usage">
                <h2 id="s-usage" className="op-section-title">Начин на употреба и дози</h2>
                <div className="op-usage-grid">
                  {[
                    { icon: '🌿', label: 'Листно приложение',   idx: 0 },
                    { icon: '🪣', label: 'Почвено приложение',  idx: 1 },
                    { icon: '🌱', label: 'Третиране на семена', idx: 2 },
                  ].filter(x => usageLines[x.idx]).map(x => (
                    <div key={x.idx} className="op-usage-item">
                      <div className="op-usage-icon" aria-hidden>{x.icon}</div>
                      <div className="op-usage-label">{x.label}</div>
                      <div className="op-usage-dose">{usageLines[x.idx]}</div>
                    </div>
                  ))}
                </div>
                <div className="op-usage-note">
                  💡 <strong>Забележка:</strong> Приложим през цялата година. Съвместим с всички продукти за растителна защита. Не запушва дюзи при фертигация.
                </div>
              </section>
            )}

            {/* 5. Дози по култура */}
            {crops.length > 0 && (
              <section className="op-content-card op-content-card--crops" aria-labelledby="s-crops">
                <h2 id="s-crops" className="op-section-title">Дози по култура</h2>
                <p className="op-crops-intro">
                  Препоръчителни норми при стандартни условия. При по-тежки почви, стресови условия или нарушен pH — използвайте горната граница.
                </p>
                <div className="op-crops-table-wrap">
                  <table className="op-crops-table">
                    <thead>
                      <tr>
                        <th scope="col">Култура</th>
                        <th scope="col">🌿 Листно (мл/дка)</th>
                        <th scope="col">🪣 Почвено (мл/дка)</th>
                        <th scope="col">🌱 Семена</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crops.map((c, i) => (
                        <tr key={i}>
                          <td><strong>{c.name}</strong></td>
                          <td>{c.leaf}</td>
                          <td>{c.soil}</td>
                          <td>{c.seed || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="op-crops-note">
                  💡 Съвместим с фертигационни системи (капково напояване). Не запушва дюзи.
                </p>
              </section>
            )}

            {/* 6. Testimonial */}
            {testimonial?.text && (
              <section className="op-content-card op-content-card--testimonial" aria-label="Отзив от клиент">
                <div className="op-testimonial">
                  <div className="op-testimonial-stars" aria-label={`${testimonial.rating ?? 5} звезди`}>
                    {'★'.repeat(Math.round(testimonial.rating ?? 5))}
                  </div>
                  <blockquote className="op-testimonial-text">{testimonial.text}</blockquote>
                  <div className="op-testimonial-author">
                    <strong>{testimonial.name}</strong>
                    {testimonial.location && <span>{testimonial.location}</span>}
                  </div>
                </div>
              </section>
            )}

            {/* 7. Защо */}
            {whyItems.length > 0 && (
              <section className="op-content-card op-content-card--why" aria-labelledby="s-why">
                <h2 id="s-why" className="op-section-title">Защо {product.name.split(' — ')[0]}?</h2>
                <div className="op-why-grid">
                  {whyItems.map((item, i) => (
                    <div key={i} className="op-why-item">
                      <div className="op-why-icon" aria-hidden>{item.icon}</div>
                      <div className="op-why-title">{item.title}</div>
                      <div className="op-why-text">{item.text}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 8. FAQ */}
            {/* ✅ itemScope/itemType="FAQPage" ПРЕМАХНАТИ — дублираха JSON-LD от page.tsx */}
            {faq.length > 0 && (
              <section
                className="op-content-card op-content-card--faq"
                aria-labelledby="s-faq"
              >
                <h2 id="s-faq" className="op-section-title">Въпроси и отговори</h2>
                <div className="op-faq-list">
                  {faq.map((item, i) => <FaqAccordion key={i} q={item.q} a={item.a} />)}
                </div>
              </section>
            )}

            {/* 9. Related — mobile */}
            {related.length > 0 && (
              <aside className="op-related op-related--mobile" aria-label="Свързани продукти">
                <h3 className="op-related-title">От същата гама</h3>
                <div className="op-related-list">
                  {related.map(r => <RelatedCard key={r.slug} r={r} fmtFn={fmtFn} />)}
                </div>
              </aside>
            )}

          </div>
        </div>
      </main>

      {/* Mobile sticky bar */}
      <div className="op-mobile-bar" role="complementary" aria-label="Бърза покупка">
        <div className="op-mobile-bar-info">
          <div className="op-mobile-bar-name">{product.name.split(' — ')[0]}</div>
          {variant && <div className="op-mobile-bar-price">{fmtFn(price)}</div>}
        </div>
        <button
          type="button"
          className={`op-mobile-bar-btn${isOOS ? ' op-mobile-bar-btn--oos' : ''}`}
          onClick={handleAddToCart}
          disabled={isOOS}
        >
          {isOOS ? 'Изчерпан' : added ? '✓ Добавено!' : '🛒 Купи сега'}
        </button>
      </div>

      <SiteFooter />
    </div>
  )
}
