'use client'
// components/client/AffiliateSection.tsx — v3
// ✅ ПОДОБРЕНИЯ спрямо v2:
//   - Приема `products` (топ 6 по кликове) + `allProducts` (всички, за броячa)
//   - Показва "Показани 6 от X продукта" с реалния брой
//   - Добавен rel="nofollow sponsored noopener" на affiliate линковете (SEO!)
//   - Показва продукти от ВСИЧКИ партньори, не само 'agroapteki'
//   - Звездичен рейтинг под заглавието на всяка карта
//   - Малка "Виж страницата" → /produkt/slug навигация (не директно към affiliate)
//   - Карантина badge (0 дни = зелено)
//   - Цена ако е налична
//   - Fallback: ако top6 е празен → показва първите 6 от allProducts

import { trackAffiliateClick } from '@/lib/trackAffiliateClick'
import { SafeImg } from '@/components/client/SafeImg'
import { FadeIn } from '@/components/marketing/FadeIn'

interface AffiliateProduct {
  id:              string
  slug:            string
  name:            string
  subtitle?:       string
  description?:    string
  bullets?:        string[]
  image_url?:      string
  image_alt?:      string
  affiliate_url:   string
  partner:         string
  emoji?:          string
  badge_text?:     string
  tag_text?:       string
  color?:          string
  badge_color?:    string
  category_label?: string
  rating?:         number | string
  review_count?:   number
  price?:          number | string
  price_currency?: string
  quarantine_days?: number
}

interface Props {
  products:    AffiliateProduct[]   // топ 6 по кликове (подредени)
  allProducts: AffiliateProduct[]   // всички — за реалния брой в брояча
}

function getRating(p: AffiliateProduct): number {
  const r = Number(p.rating)
  return isNaN(r) || r <= 0 ? 4.9 : r
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ fontSize: 12, color: i <= Math.round(rating) ? '#f59e0b' : '#e2e8f0', lineHeight: 1 }}>★</span>
      ))}
    </span>
  )
}

export function AffiliateSection({ products, allProducts }: Props) {
  // Ако top6 е празен (напр. affiliate_clicks таблицата е нова/празна), показваме първите 6
  const displayProducts = products.length > 0 ? products : allProducts.slice(0, 6)
  const totalCount      = allProducts.length

  if (displayProducts.length === 0) return null

  return (
    <section id="produkti" className="section-wrap" style={{ paddingTop: 0 }}>
      <FadeIn>
        <div className="section-head">
          <span className="s-tag">Препоръчани продукти</span>
          <h2 className="s-title">Проверени от Практиката</h2>
          <p className="s-desc">Продуктите, които лично използвам и препоръчвам</p>
        </div>
      </FadeIn>

      <div className="products-grid">
        {displayProducts.map((p, i) => {
          const cardColor  = p.color       || '#16a34a'
          const badgeColor = p.badge_color || cardColor
          const pageUrl    = `/produkt/${p.slug}`
          const rating     = getRating(p)
          const bullets    = p.bullets || []

          return (
            <FadeIn key={p.id} delay={i * 60}>
              <article className="pk-card">

                {/* ── Снимка ── */}
                <a href={pageUrl} className="pk-card-img-wrap">
                  {p.badge_text && (
                    <span className="pk-badge" style={{ background: badgeColor }}>
                      {p.badge_text}
                    </span>
                  )}
                  {p.tag_text && (
                    <span className="pk-tag">
                      {p.emoji && <span>{p.emoji}</span>}
                      {p.tag_text}
                    </span>
                  )}
                  <SafeImg
                    src={p.image_url ?? ''}
                    alt={p.image_alt || p.name}
                    fallbackEmoji={p.emoji || '🌿'}
                    className="pk-card-img"
                  />
                </a>

                {/* ── Тяло ── */}
                <div className="pk-card-body">

                  {/* МОБИЛЕН: badge + tag горе в body (badge/tag са скрити върху снимката) */}
                  {(p.badge_text || p.tag_text) && (
                    <div className="pk-mobile-badges">
                      {p.badge_text && (
                        <span className="pk-mobile-badge" style={{ background: badgeColor }}>
                          {p.badge_text}
                        </span>
                      )}
                      {p.tag_text && (
                        <span className="pk-mobile-tag">
                          {p.emoji && <span>{p.emoji}</span>}
                          {p.tag_text}
                        </span>
                      )}
                    </div>
                  )}

                  {p.category_label && (
                    <div className="pk-card-cat" style={{ color: cardColor }}>
                      {p.emoji && <span>{p.emoji}</span>}
                      {p.category_label}
                    </div>
                  )}

                  <a href={pageUrl} style={{ textDecoration: 'none' }}>
                    <h3 className="pk-card-title">{p.name}</h3>
                  </a>

                  {/* Рейтинг */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Stars rating={rating} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{rating}/5</span>
                    {p.review_count && (
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>({p.review_count})</span>
                    )}
                  </div>

                  {p.subtitle && (
                    <p className="pk-card-sub">{p.subtitle}</p>
                  )}

                  {p.description && (
                    <p className="pk-card-desc">„{p.description}"</p>
                  )}

                  {/* Bullets — 3 */}
                  {bullets.slice(0, 3).length > 0 && (
                    <ul className="pk-bullets">
                      {bullets.slice(0, 3).map((b, j) => (
                        <li key={j} className="pk-bullet">
                          <span className="pk-bullet-dot" style={{ background: cardColor }}>✓</span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Meta chips: карантина + volume + season */}
                  <div className="pk-chips-row">
                    {p.quarantine_days === 0 && (
                      <span className="pk-chip-meta pk-chip-green">✓ 0 дни карантина</span>
                    )}
                    {typeof p.quarantine_days === 'number' && p.quarantine_days > 0 && (
                      <span className="pk-chip-meta pk-chip-orange">{p.quarantine_days}д. карантина</span>
                    )}
                  </div>

                  {/* Цена */}
                  {p.price && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, margin: '4px 0 8px' }}>
                      <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
                        {Number(p.price).toFixed(2)}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                        {p.price_currency || 'EUR'}
                      </span>
                    </div>
                  )}

                  {/* CTA — сочи към продуктовата страница, не директно към affiliate_url */}
                  <a
                    href={pageUrl}
                    onClick={() => trackAffiliateClick(p.partner, p.slug)}
                    className="pk-cta-btn"
                    style={{
                      background: `linear-gradient(135deg,${cardColor},${cardColor}dd)`,
                      boxShadow: `0 6px 20px ${cardColor}33`,
                    }}
                    aria-label={`${p.name} — прочети повече`}
                  >
                    Прочети повече →
                  </a>
                </div>
              </article>
            </FadeIn>
          )
        })}
      </div>
      {/* Бутон "Виж всички продукти" → /produkti */}
      <FadeIn delay={400}>
        <div style={{
          textAlign: 'center',
          marginTop: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}>
          {totalCount > displayProducts.length && (
            <p style={{ fontSize: 13.5, color: '#6b7280', margin: 0 }}>
              Показани <strong>{displayProducts.length}</strong> от <strong>{totalCount}</strong> препоръчани продукта
            </p>
          )}
          <a
            href="/produkti"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#fff',
              color: '#16a34a',
              border: '2px solid #16a34a',
              borderRadius: 13,
              padding: '13px 28px',
              fontWeight: 800,
              fontSize: 15,
              textDecoration: 'none',
              transition: 'all .2s',
              boxShadow: '0 2px 12px rgba(22,163,74,.12)',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLAnchorElement
              el.style.background = '#16a34a'
              el.style.color = '#fff'
              el.style.transform = 'translateY(-2px)'
              el.style.boxShadow = '0 8px 24px rgba(22,163,74,.3)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLAnchorElement
              el.style.background = '#fff'
              el.style.color = '#16a34a'
              el.style.transform = 'translateY(0)'
              el.style.boxShadow = '0 2px 12px rgba(22,163,74,.12)'
            }}
          >
            📦 Виж всички {totalCount > 0 ? `${totalCount} продукта` : 'продукти'} →
          </a>
        </div>
      </FadeIn>

      {/* Mobile layout CSS */}
      <style>{`
        @media (max-width: 640px) {
          /* Показваме мобилните елементи */
          .aff-mobile-meta-row { display: flex !important; }
          .aff-badge-mobile    { display: flex !important; }
          /* Скриваме desktop-only елементите */
          .aff-badge-desktop   { display: none !important; }
          .aff-tag-desktop     { display: none !important; }
          .aff-quarantine-desktop { display: none !important; }
          /* img wrap на мобилен — flex-col, justify-start */
          .aff-img-wrap {
            min-height: unset !important;
            padding: 14px 10px 10px !important;
            align-items: center !important;
            justify-content: flex-start !important;
          }
        }
      `}</style>
    </section>
  )
}

// ─── CategoryLinksSection ────────────────────────────────────────────────────
interface CategoryLink {
  id: string; slug: string; label: string
  href: string; emoji: string; partner: string | null; color?: string
}
interface CatProps { links: CategoryLink[] }

function getCategorySlug(c: CategoryLink): string {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(c.slug || '')
  if (c.slug && !isUuid && c.slug.trim().length >= 2) {
    return c.slug.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
  }
  if (c.href) {
    try {
      const url = new URL(c.href)
      const segments = url.pathname.split('/').map(s => s.trim()).filter(s => s.length > 1)
      if (segments.length > 0) {
        const clean = segments.slice(-2).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
        if (clean.length >= 2) return clean
      }
    } catch {}
  }
  return `cat-${c.id.slice(0, 8)}`
}

export function CategoryLinksSection({ links }: CatProps) {
  if (links.length === 0) return null
  const CAT_COLORS: Record<string, string> = { agroapteki: '#16a34a', default: '#16a34a' }
  return (
    <div className="categories-grid">
      {links.map((c, i) => {
        const color     = c.color || CAT_COLORS[c.partner || 'default'] || CAT_COLORS.default
        const trackSlug = getCategorySlug(c)
        return (
          <FadeIn key={c.id || c.slug} delay={i * 55}>
            <a
              href={c.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="cat-card cat-card--hover"
              style={{ '--cat-color': color } as React.CSSProperties}
              onClick={() => trackAffiliateClick(c.partner || 'category', trackSlug)}
            >
              <span style={{ fontSize: 20, background: color + '18', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {c.emoji}
              </span>
              <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{c.label}</span>
              <span style={{ color, fontSize: 16, opacity: 0.7 }}>→</span>
            </a>
          </FadeIn>
        )
      })}
    </div>
  )
}
