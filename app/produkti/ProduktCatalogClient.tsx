'use client'
// app/produkti/ProduktCatalogClient.tsx — v2
// ✅ ПОПРАВКИ:
//   - Header използва homepage.css класове (site-header, header-logo, nav-link и т.н.)
//   - Филтрите са в 1 ред с overflow-x scroll на мобилно
//   - Картите са изчистени и консистентни
//   - Мобилен дизайн — 1 колона, компактни карти

import { useState, useMemo, useEffect } from 'react'
import type { AffiliateProduct } from '@/lib/affiliate'
import { getRating } from '@/lib/affiliate'

interface Props {
  products:   AffiliateProduct[]
  categories: string[]
}

const CAT_ICONS: Record<string, string> = {
  'Биостимулатор':               '🌿',
  'Биостимулатор за имунитет':   '🌿',
  'Калциев биостимулатор':       '💧',
  'Системен фунгицид':           '🍄',
  'Биологичен инсектицид':       '🐛',
  'Био защита на растенията':    '🛡️',
  'NPK тор с микроелементи':     '⭐',
  'Инсектицид':                  '🐛',
  'Фунгицид':                    '🍄',
  'Тор':                         '🌱',
  'Листно торене':               '🌱',
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display:'inline-flex', gap:1 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ fontSize:13, color: i <= Math.round(rating) ? '#f59e0b' : '#e2e8f0', lineHeight:1 }}>★</span>
      ))}
    </span>
  )
}

export function ProduktCatalogClient({ products, categories }: Props) {
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [search,       setSearch]       = useState('')
  const [scrolled,     setScrolled]     = useState(false)
  const [mobileMenu,   setMobileMenu]   = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const filtered = useMemo(() => {
    let list = products
    if (activeFilter !== 'all') {
      list = list.filter(p => p.category_label === activeFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.subtitle?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.category_label?.toLowerCase().includes(q) ||
        p.active_substance?.toLowerCase().includes(q) ||
        (p.crops || []).some(c => c.toLowerCase().includes(q))
      )
    }
    return list
  }, [products, activeFilter, search])

  return (
    <div style={{ fontFamily:"'DM Sans',-apple-system,sans-serif", background:'#fafaf8', minHeight:'100vh', overflowX:'hidden' }}>

      {/* ══ HEADER — използва homepage.css класове ══ */}
      <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
        <a href="/" className="header-logo">
          <span style={{ fontSize:24 }}>🍅</span>
          <div>
            <div className="logo-name">Denny Angelow</div>
            <div className="logo-sub">Агро Консултант</div>
          </div>
        </a>
        <nav className="header-nav">
          <a href="/"              className="nav-link">Начало</a>
          <a href="/produkti"      className="nav-link" style={{ color:'#16a34a', fontWeight:700 }}>Продукти</a>
          <a href="/#atlas"        className="nav-link">Atlas Terra</a>
          <a href="/#testimonials" className="nav-link">Отзиви</a>
          <a href="/#faq"          className="nav-link">Въпроси</a>
        </nav>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <a href="/" className="cart-btn" style={{ textDecoration:'none' }}>← Начало</a>
          <button className="mob-btn" onClick={() => setMobileMenu(v=>!v)} aria-label="Меню">
            {mobileMenu ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {/* Мобилно меню */}
      {mobileMenu && (
        <div className="mob-nav">
          {([
            ['/', 'Начало'],
            ['/produkti', '📦 Всички продукти'],
            ['/#atlas', 'Atlas Terra'],
            ['/#testimonials', 'Отзиви'],
            ['/#faq', 'Въпроси'],
          ] as [string,string][]).map(([h, l]) => (
            <a key={h} href={h} className="mob-nav-link" onClick={() => setMobileMenu(false)}>{l}</a>
          ))}
        </div>
      )}

      {/* ══ HERO ══ */}
      <div className="pk-hero">
        <div className="pk-hero-line" />
        <div className="pk-hero-inner">
          <nav className="pk-bc">
            <a href="/">Начало</a>
            <span>›</span>
            <strong>Продукти</strong>
          </nav>
          <div style={{ textAlign:'center', paddingBottom:8 }}>
            <p className="pk-hero-tag">Препоръчани продукти</p>
            <h1 className="pk-hero-title">Проверени от Практиката</h1>
            <p className="pk-hero-desc">
              {products.length} продукта — лично тествани и препоръчани от Denny Angelow
            </p>
          </div>
        </div>
      </div>

      {/* ══ СЪДЪРЖАНИЕ ══ */}
      <div className="pk-content">

        {/* Search */}
        <div className="pk-search-wrap">
          <span className="pk-search-icon">🔍</span>
          <input
            type="text"
            className="pk-search"
            placeholder="Търси продукт, болест, активно вещество..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="pk-search-x" onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        {/* Филтри */}
        <div className="pk-filters">
          <button
            className={`pk-chip${activeFilter === 'all' ? ' pk-chip--on' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            🌱 Всички <span className="pk-chip-n">{products.length}</span>
          </button>
          {categories.map(cat => {
            const count = products.filter(p => p.category_label === cat).length
            return (
              <button
                key={cat}
                className={`pk-chip${activeFilter === cat ? ' pk-chip--on' : ''}`}
                onClick={() => setActiveFilter(cat)}
              >
                {CAT_ICONS[cat] || '🌿'} {cat} <span className="pk-chip-n">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Брой резултати */}
        {(search || activeFilter !== 'all') && filtered.length > 0 && (
          <p className="pk-count">
            {filtered.length} продукт{filtered.length !== 1 ? 'а' : ''}
            {activeFilter !== 'all' && ` · ${activeFilter}`}
            {search && ` · „${search}"`}
          </p>
        )}

        {/* ── Empty state ── */}
        {filtered.length === 0 && (
          <div className="pk-empty">
            <div style={{ fontSize:48, marginBottom:14 }}>🌿</div>
            <p style={{ fontSize:15, color:'#6b7280', marginBottom:18 }}>
              Няма продукти за <strong>„{search}"</strong>
            </p>
            <button className="pk-empty-btn" onClick={() => { setSearch(''); setActiveFilter('all') }}>
              Покажи всички
            </button>
          </div>
        )}

        {/* ── Grid ── */}
        {filtered.length > 0 && (
          <div className="pk-grid">
            {filtered.map(p => {
              const color   = p.color || '#16a34a'
              const rating  = getRating(p)
              const pageUrl = `/produkt/${p.slug}`
              const bullets = p.bullets || p.features || []

              return (
                <article key={p.id} className="pk-card">

                  {/* Снимка */}
                  <a href={pageUrl} className="pk-card-img-wrap">
                    {p.badge_text && (
                      <span className="pk-badge" style={{ background: p.badge_color || color }}>
                        {p.badge_text}
                      </span>
                    )}
                    {p.tag_text && (
                      <span className="pk-tag">
                        {p.emoji} {p.tag_text}
                      </span>
                    )}
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.image_alt || p.name}
                        loading="lazy"
                        className="pk-card-img"
                        onError={e => { (e.target as HTMLImageElement).style.display='none' }}
                      />
                    ) : (
                      <span style={{ fontSize:64 }}>{p.emoji || '🌿'}</span>
                    )}
                  </a>

                  {/* Тяло */}
                  <div className="pk-card-body">
                    {p.category_label && (
                      <div className="pk-card-cat" style={{ color }}>
                        {CAT_ICONS[p.category_label] || p.emoji || '🌿'} {p.category_label}
                      </div>
                    )}

                    <a href={pageUrl} style={{ textDecoration:'none' }}>
                      <h2 className="pk-card-title">{p.name}</h2>
                    </a>

                    {p.subtitle && (
                      <p className="pk-card-sub">{p.subtitle}</p>
                    )}

                    {/* Рейтинг */}
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                      <Stars rating={rating} />
                      <span style={{ fontSize:12, fontWeight:700, color:'#374151' }}>{rating}/5</span>
                      {p.review_count && (
                        <span style={{ fontSize:11, color:'#9ca3af' }}>({p.review_count})</span>
                      )}
                    </div>

                    {/* Bullets — само 2 */}
                    {bullets.slice(0,2).length > 0 && (
                      <ul className="pk-bullets">
                        {bullets.slice(0,2).map((b,j) => (
                          <li key={j} className="pk-bullet">
                            <span className="pk-bullet-dot" style={{ background:color }}>✓</span>
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Meta chips */}
                    <div className="pk-chips-row">
                      {p.quarantine_days === 0 && (
                        <span className="pk-chip-meta pk-chip-green">✓ 0 дни карантина</span>
                      )}
                      {typeof p.quarantine_days === 'number' && p.quarantine_days > 0 && (
                        <span className="pk-chip-meta pk-chip-orange">{p.quarantine_days}д. карантина</span>
                      )}
                      {p.volume && (
                        <span className="pk-chip-meta">{p.volume}</span>
                      )}
                      {p.season && (
                        <span className="pk-chip-meta">🌤 {p.season}</span>
                      )}
                    </div>

                    {/* Цена */}
                    {p.price && (
                      <div style={{ display:'flex', alignItems:'baseline', gap:4, margin:'6px 0 2px' }}>
                        <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:700, color:'#0f172a', lineHeight:1 }}>
                          {Number(p.price).toFixed(2)}
                        </span>
                        <span style={{ fontSize:13, fontWeight:700, color:'#374151' }}>
                          {p.price_currency || 'EUR'}
                        </span>
                      </div>
                    )}

                    {/* CTA */}
                    <a
                      href={pageUrl}
                      className="pk-cta-btn"
                      style={{
                        background: `linear-gradient(135deg,${color},${color}dd)`,
                        boxShadow: `0 6px 20px ${color}33`,
                      }}
                    >
                      Прочети повече →
                    </a>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* ── Bottom CTA ── */}
        <div className="pk-bottom-cta">
          <div style={{ fontSize:40, marginBottom:12 }}>🍅</div>
          <h2 className="pk-bottom-title">Не знаеш кое е подходящо за теб?</h2>
          <p className="pk-bottom-desc">
            Изтегли безплатния наръчник — там ще намериш пълен план за отглеждане и кой продукт кога да приложиш.
          </p>
          <div className="pk-bottom-btns">
            <a href="/#handbooks" className="pk-bottom-btn-primary">🎁 Вземи безплатния наръчник</a>
            <a href="/"           className="pk-bottom-btn-ghost">← Назад към началото</a>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer style={{ textAlign:'center', padding:'20px 24px', fontSize:12.5, color:'#9ca3af', borderTop:'1px solid #f1f5f9' }}>
        © 2025–2026 Denny Angelow ·{' '}
        <a href="/" style={{ color:'#16a34a', textDecoration:'none', fontWeight:600 }}>dennyangelow.com</a>
      </footer>

    </div>
  )
}
