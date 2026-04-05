'use client'
// components/client/AffiliateSection.tsx
// Client Component — афилиейт продукти + category links с пълен tracking

import { trackAffiliateClick } from '@/lib/trackAffiliateClick'
import { SafeImg } from '@/components/client/SafeImg'
import { FadeIn } from '@/components/marketing/FadeIn'

interface AffiliateProduct {
  id: string
  slug: string
  name: string
  subtitle: string
  description: string
  bullets: string[]
  image_url: string
  affiliate_url: string
  partner: string
  emoji: string
  badge_text: string
  tag_text: string
  color: string
  badge_color: string
  category_label: string
}

const CAT_COLORS: Record<string, string> = {
  agroapteki:  '#16a34a',
  default:     '#16a34a',
}

interface Props {
  products: AffiliateProduct[]
}

export function AffiliateSection({ products }: Props) {
  const agroProducts = products.filter(p => p.partner === 'agroapteki')
  if (agroProducts.length === 0) return null

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
        {agroProducts.map((p, i) => {
          const cardColor  = p.color       || CAT_COLORS[p.partner] || '#16a34a'
          const badgeColor = p.badge_color || cardColor

          return (
            <FadeIn key={p.id} delay={i * 60}>
              <div
                className="product-card"
                style={{ '--card-color': cardColor } as React.CSSProperties}
              >
                {/* Снимка + badges */}
                <div style={{
                  position: 'relative',
                  background: '#f8f9fa',
                  minHeight: 220,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px 20px 0',
                }}>
                  {p.badge_text && (
                    <div style={{
                      position: 'absolute', top: 14, left: 14,
                      background: badgeColor, color: '#fff',
                      fontSize: 12, fontWeight: 800,
                      padding: '5px 12px', borderRadius: 30, zIndex: 2,
                    }}>
                      {p.badge_text}
                    </div>
                  )}
                  {p.tag_text && (
                    <div style={{
                      position: 'absolute', top: 14, right: 14,
                      background: 'rgba(255,255,255,0.95)', color: '#374151',
                      fontSize: 11.5, fontWeight: 700,
                      padding: '5px 11px', borderRadius: 30, zIndex: 2,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {p.emoji && <span style={{ fontSize: 13 }}>{p.emoji}</span>}
                      {p.tag_text}
                    </div>
                  )}
                  <SafeImg
                    src={p.image_url}
                    alt={p.name}
                    fallbackEmoji={p.emoji || '🌿'}
                    style={{ width: '100%', maxHeight: 180, objectFit: 'contain', display: 'block' }}
                  />
                </div>

                {/* Съдържание */}
                <div style={{ padding: '18px 22px 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {p.category_label && (
                    <div style={{
                      fontSize: 11, fontWeight: 800, color: cardColor,
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {p.emoji && <span style={{ fontSize: 13 }}>{p.emoji}</span>}
                      {p.category_label}
                    </div>
                  )}

                  <h3 style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 22, fontWeight: 800, color: '#111',
                    margin: '0 0 10px', lineHeight: 1.2,
                  }}>
                    {p.name}
                  </h3>

                  <p style={{
                    fontSize: 13.5, color: '#6b7280', lineHeight: 1.65,
                    marginBottom: 14, fontStyle: 'italic', flex: 0,
                  }}>
                    „{p.description}"
                  </p>

                  {p.bullets?.length > 0 && (
                    <ul style={{ margin: '0 0 20px', padding: 0, listStyle: 'none', flex: 1 }}>
                      {p.bullets.slice(0, 3).map((b, j) => (
                        <li key={j} style={{
                          fontSize: 13, color: '#374151',
                          padding: '5px 0', display: 'flex', gap: 9,
                          alignItems: 'flex-start',
                          borderBottom: '1px solid #f5f5f5',
                        }}>
                          <span style={{
                            background: cardColor, color: '#fff',
                            width: 16, height: 16, borderRadius: 4,
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: 8,
                            fontWeight: 900, flexShrink: 0, marginTop: 1,
                          }}>✓</span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* ── TRACKED LINK ── */}
                  <a
                    href={p.affiliate_url}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    onClick={() => trackAffiliateClick(p.partner, p.slug)}
                    style={{
                      display: 'block', textAlign: 'center',
                      background: cardColor, color: '#fff',
                      padding: '13px 20px', borderRadius: 12,
                      textDecoration: 'none', fontWeight: 800,
                      fontSize: 14.5, marginTop: 'auto',
                    }}
                    aria-label={`${p.name} — партньорски линк`}
                  >
                    Прочети повече →
                  </a>
                </div>
              </div>
            </FadeIn>
          )
        })}
      </div>
    </section>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// CategoryLinksSection — с пълен tracking на всеки клик
// Поддържа color директно от обекта (от базата данни) — не само от CAT_COLORS
// ─────────────────────────────────────────────────────────────────────────────

interface CategoryLink {
  id: string
  slug: string
  label: string
  href: string
  emoji: string
  partner: string | null
  color?: string
}

interface CatProps {
  links: CategoryLink[]
}

export function CategoryLinksSection({ links }: CatProps) {
  if (links.length === 0) return null

  return (
    <div className="categories-grid">
      {links.map((c, i) => {
        // Приоритет: color от базата → CAT_COLORS по partner → default
        const color = c.color || CAT_COLORS[c.partner || 'default'] || CAT_COLORS.default

        return (
          <FadeIn key={c.slug} delay={i * 55}>
            <a
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              className="cat-card cat-card--hover"
              style={{ '--cat-color': color } as React.CSSProperties}
              onClick={() => {
                // Slug: ако е UUID използваме label като slug
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(c.slug || "")
                const trackSlug = (!isUuid && c.slug)
                  ? c.slug
                  : c.label.toLowerCase().replace(/[^a-z0-9]+/gi, "-").slice(0, 40)
                trackAffiliateClick(c.partner || "category", trackSlug)
              }}
            >
              <span style={{
                fontSize: 20,
                background: color + '18',
                width: 44, height: 44,
                borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
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
