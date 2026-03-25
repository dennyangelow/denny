'use client'
// components/marketing/ProductCard.tsx

import { FadeIn } from './FadeIn'
import type { PRODUCTS } from '@/lib/marketing-data'

type Product = typeof PRODUCTS[number]

interface Props {
  p: Product
  idx: number
}

export function ProductCard({ p, idx }: Props) {
  const trackAffiliate = (partner: string, slug: string) => {
    fetch('/api/analytics/affiliate-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner, product_slug: slug }),
    }).catch(() => {})
  }

  return (
    <FadeIn delay={idx * 80}>
      <a
        href={p.link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackAffiliate(p.partner, p.id)}
        className="product-card-link"
        style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        <div
          className="product-card"
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.transform = 'translateY(-5px)'
            el.style.boxShadow = `0 16px 48px ${p.color}22`
            el.style.borderColor = p.color + '66'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.transform = ''
            el.style.boxShadow = '0 2px 16px rgba(0,0,0,0.06)'
            el.style.borderColor = '#e5e7eb'
          }}
          style={{
            background: '#fff',
            borderRadius: 20,
            border: '1.5px solid #e5e7eb',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
            transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {/* Image */}
          <div style={{ position: 'relative', background: '#f9fafb', overflow: 'hidden' }}>
            <img
              src={p.img}
              alt={p.name}
              loading="lazy"
              style={{ width: '100%', height: 200, objectFit: 'contain', padding: '12px 24px', display: 'block' }}
            />
            <span style={{
              position: 'absolute', top: 12, left: 12,
              background: p.color, color: '#fff',
              fontSize: 11, fontWeight: 800, padding: '4px 12px',
              borderRadius: 20, letterSpacing: '0.04em',
            }}>
              {p.badge}
            </span>
            <span style={{
              position: 'absolute', top: 12, right: 12,
              background: 'rgba(255,255,255,0.95)', color: p.color,
              fontSize: 11, fontWeight: 700, padding: '4px 10px',
              borderRadius: 20, border: `1px solid ${p.color}33`,
            }}>
              {p.tag}
            </span>
          </div>

          {/* Body */}
          <div style={{ padding: '20px 22px 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 12, color: p.color, fontWeight: 700, marginBottom: 5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {p.subtitle}
            </div>
            <h3 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 19,
              fontWeight: 800,
              margin: '0 0 10px',
              color: '#111',
              lineHeight: 1.2,
            }}>
              {p.name}
            </h3>
            <p style={{ fontSize: 13.5, color: '#6b7280', lineHeight: 1.65, marginBottom: 14, fontStyle: 'italic', flex: 1 }}>
              "{p.desc}"
            </p>
            <ul style={{ margin: '0 0 18px', padding: 0, listStyle: 'none' }}>
              {p.features.slice(0, 3).map(f => (
                <li key={f} style={{ fontSize: 12.5, color: '#374151', padding: '4px 0', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{
                    background: p.color, color: '#fff',
                    width: 15, height: 15, borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 900, flexShrink: 0, marginTop: 1,
                  }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: p.color, color: '#fff',
              borderRadius: 12, padding: '11px 16px',
              fontWeight: 800, fontSize: 14,
              gap: 6,
            }}>
              Прочети повече →
            </div>
          </div>
        </div>
      </a>
    </FadeIn>
  )
}
