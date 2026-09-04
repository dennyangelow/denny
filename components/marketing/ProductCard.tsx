'use client'
// components/marketing/ProductCard.tsx

import { FadeIn } from './FadeIn'
import { SafeImg } from '@/components/client/SafeImg'

// 1. Дефинираме ясен интерфейс, за да избегнем TypeScript грешките от липсващи данни
export interface Product {
  id: string
  name: string
  slug: string
  subtitle: string
  desc: string
  img: string
  link: string
  color: string
  badge: string
  tag: string
  features: string[]
  partner: string
}

interface Props { 
  p: Product; 
  idx: number 
}

export function ProductCard({ p, idx }: Props) {
  // 2. Оптимизирана функция за проследяване
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
        className="product-card-anchor"
      >
        <div className="product-card-container" style={{ '--card-color': p.color } as any}>
          
          {/* Горна част с изображение и баджове */}
          <div className="product-image-wrapper">
            <SafeImg
              src={p.img}
              alt={p.name}
              className="product-main-img"
              width={280}
              height={180}
              // ✅ ФИКС: суров <img> без width/height/optimization →
              // няма responsive srcset, няма автоматично AVIF/WebP,
              // няма LCP hint. SafeImg минава през next/image, генерира
              // правилния srcset спрямо реалната ширина на картата и пази
              // fallback емоджи при счупен URL. priority остава false —
              // тези карти не са LCP елементът на страницата (той е в
              // hero-то), затова lazy loading тук е коректен.
              sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 300px"
              quality={75}
              // ⚠️ SafeImg рендва <img> вътре в СВОЯ компонент (next/image),
              // не буквално вътре в JSX-а на ProductCard — затова styled-jsx
              // не може да прикачи скопирания си data-атрибут към него и
              // скопираните .product-main-img правила по-долу никога няма
              // да съвпаднат. Затова базовите размери се подават директно
              // inline тук, а hover transform-ът по-долу е маркиран :global().
              style={{ width: '100%', height: 180, objectFit: 'contain', transition: 'transform 0.5s ease' }}
            />

            <div className="badge-primary" style={{ backgroundColor: p.color }}>
              {p.badge}
            </div>
            
            <div className="badge-secondary" style={{ color: p.color, borderColor: `${p.color}33` }}>
              {p.tag}
            </div>
          </div>

          {/* Същинско съдържание */}
          <div className="product-content">
            <div className="product-subtitle" style={{ color: p.color }}>
              {p.subtitle}
            </div>
            
            <h3 className="product-title">
              {p.name}
            </h3>
            
            <p className="product-description">
              "{p.desc}"
            </p>

            {/* Списък с предимства - лимитиран до 3 за консистенция */}
            <ul className="product-features-list">
              {p.features?.slice(0, 3).map((f, i) => (
                <li key={i} className="feature-item">
                  <span className="feature-check" style={{ backgroundColor: p.color }}>
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            {/* Бутон за действие */}
            <div className="product-action-btn" style={{ backgroundColor: p.color }}>
              Виж повече детайли
              <span className="btn-arrow">→</span>
            </div>
          </div>
        </div>
      </a>

      {/* Капсулирани стилове за по-чист код */}
      <style jsx>{`
        .product-card-anchor {
          text-decoration: none;
          color: inherit;
          display: flex;
          flex-direction: column;
          height: 100%;
          outline: none;
        }

        .product-card-container {
          background: #fff;
          border-radius: 24px;
          border: 1.5px solid #f1f5f9;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          height: 100%;
          box-shadow: 0 4px 20px rgba(0,0,0,0.04);
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .product-card-container:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.08);
          border-color: var(--card-color);
        }

        .product-image-wrapper {
          position: relative;
          background: #f8fafc;
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 220px;
        }

        .product-card-container:hover :global(.product-main-img) {
          transform: scale(1.08);
        }

        .badge-primary {
          position: absolute;
          top: 16px;
          left: 16px;
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          padding: 5px 14px;
          border-radius: 30px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .badge-secondary {
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(255,255,255,0.9);
          font-size: 10px;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 30px;
          border: 1px solid;
          backdrop-filter: blur(4px);
        }

        .product-content {
          padding: 24px;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .product-subtitle {
          font-size: 11px;
          font-weight: 800;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .product-title {
          font-family: var(--font-cormorant), serif;
          font-size: 22px;
          font-weight: 800;
          margin: 0 0 12px;
          color: #0f172a;
          line-height: 1.2;
        }

        .product-description {
          font-size: 14px;
          color: #64748b;
          line-height: 1.6;
          margin-bottom: 20px;
          font-style: italic;
          flex: 1;
        }

        .product-features-list {
          margin: 0 0 24px;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .feature-item {
          font-size: 13px;
          color: #334155;
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .feature-check {
          color: #fff;
          width: 18px;
          height: 18px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 900;
          flex-shrink: 0;
        }

        .product-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          border-radius: 14px;
          padding: 14px;
          font-weight: 800;
          font-size: 14px;
          gap: 8px;
          transition: opacity 0.2s;
        }

        .product-action-btn:hover {
          opacity: 0.9;
        }

        .btn-arrow {
          transition: transform 0.2s;
        }

        .product-card-container:hover .btn-arrow {
          transform: translateX(4px);
        }
      `}</style>
    </FadeIn>
  )
}