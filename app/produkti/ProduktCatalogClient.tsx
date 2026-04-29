'use client'
// app/produkti/ProduktCatalogClient.tsx — v3
// ✅ Lazy loading: IntersectionObserver sentinel → +6 карти при scroll
// ✅ Reset при filter/search промяна
// ✅ loading="eager" за първите 6 снимки, loading="lazy" за останалите
// ✅ useCallback за стабилни референции
// ✅ Запазено всичко от v2 — нищо не е премахнато

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import type { AffiliateProduct } from '@/lib/affiliate'
import { getRating } from '@/lib/affiliate'

const BATCH = 6  // брой карти при всяко зареждане

interface Props {
  products:       AffiliateProduct[]
  categories:     string[]
  initialVisible?: number  // по подразбиране = BATCH
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
  'Меден фунгицид':              '🟤',
  'Системен фунгицид за почва':  '💧',
  'Комбиниран фунгицид':         '🔵',
  'Органичен биотор':            '🪱',
  'Органичен течен тор':         '🌱',
  'Биостимулатор от водорасли':  '🌊',
  'Фосфитен тор':                '🔮',
  'Широкоспектърен фунгицид':    '🌿',
  'Комбиниран фунгицид за овощни': '🍑',
  'Комбиниран фунгицид за лозя': '🍇',
  'Системен инсектицид':         '🪲',
  'Акарицид и инсектицид':       '🕷️',
}

function Stars({ rating }: { rating: number }) {
  return (
    <span
      style={{ display:'inline-flex', gap:1 }}
      aria-label={`Рейтинг ${rating} от 5`}
      role="img"
    >
      {[1,2,3,4,5].map(i => (
        <span
          key={i}
          aria-hidden="true"
          style={{ fontSize:13, color: i <= Math.round(rating) ? '#f59e0b' : '#e2e8f0', lineHeight:1 }}
        >★</span>
      ))}
    </span>
  )
}

/* Skeleton card — показва се докато картите се зареждат */
function SkeletonCard() {
  return (
    <div className="pk-card pk-skeleton" aria-hidden="true">
      <div className="pk-skel-img" />
      <div className="pk-card-body" style={{ gap:8 }}>
        <div className="pk-skel-line" style={{ width:'40%', height:10 }} />
        <div className="pk-skel-line" style={{ width:'75%', height:18 }} />
        <div className="pk-skel-line" style={{ width:'90%', height:12 }} />
        <div className="pk-skel-line" style={{ width:'60%', height:12 }} />
        <div className="pk-skel-line" style={{ width:'100%', height:36, borderRadius:10, marginTop:8 }} />
      </div>
    </div>
  )
}

export function ProduktCatalogClient({
  products,
  categories,
  initialVisible = BATCH,
}: Props) {
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [search,       setSearch]       = useState('')
  const [scrolled,     setScrolled]     = useState(false)
  const [mobileMenu,   setMobileMenu]   = useState(false)
  const [visible,      setVisible]      = useState(initialVisible)
  const [loading,      setLoading]      = useState(false)

  // Sentinel ref — IntersectionObserver го наблюдава
  const sentinelRef = useRef<HTMLDivElement>(null)

  /* ── Header scroll ─────────────────────────────────────────────── */
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  /* ── Филтриране ────────────────────────────────────────────────── */
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

  /* ── Reset visible при search промяна ──────────────────────────── */
  // Fix: filter reset е директно в handleFilter за да няма race condition
  // Тук пазим само search reset
  useEffect(() => {
    setVisible(initialVisible)
  }, [search, initialVisible])

  /* ── IntersectionObserver за lazy loading ───────────────────────── */
  const loadMore = useCallback(() => {
    setVisible(v => v + BATCH)
  }, [])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        if (!entry.isIntersecting) return
        // Fix: setLoading(true) преди rAF, false в следващ frame
        // така skeleton картите реално се виждат между двата render-а
        setLoading(true)
        requestAnimationFrame(() => {
          loadMore()
          requestAnimationFrame(() => setLoading(false))
        })
      },
      {
        rootMargin: '0px',  // Fix: 200px причиняваше зареждане преди scroll
        threshold:  0,
      }
    )

    observer.observe(el)
    return () => observer.disconnect()
    // Fix: НЕ слагай filtered.length в deps — re-attach при всяка партида
    // причиняваше зацикляне (observer се disconnect/re-attach докато sentinel е visible)
  }, [loadMore])

  /* ── Видими карти ───────────────────────────────────────────────── */
  const visibleCards  = filtered.slice(0, visible)
  const hasMore       = visible < filtered.length
  const skeletonCount = hasMore ? Math.min(BATCH, filtered.length - visible) : 0

  /* ── Handlers ───────────────────────────────────────────────────── */
  const handleFilter = useCallback((cat: string) => {
    setActiveFilter(cat)
    setVisible(initialVisible)  // Fix: reset веднага, не в useEffect след ре-рендер
    document.getElementById('pk-grid-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [initialVisible])

  const handleClearSearch = useCallback(() => {
    setSearch('')
    setActiveFilter('all')
  }, [])

  /* ════════════════════════════════════════════════════════════════ */
  return (
    <div style={{
      fontFamily: "'DM Sans',-apple-system,sans-serif",
      background: '#fafaf8',
      minHeight:  '100vh',
      overflowX:  'hidden',
    }}>

      {/* ══ HEADER ══ */}
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
          ] as [string, string][]).map(([h, l]) => (
            <a key={h} href={h} className="mob-nav-link" onClick={() => setMobileMenu(false)}>{l}</a>
          ))}
        </div>
      )}

      {/* ══ HERO ══ */}
      <div className="pk-hero">
        <div className="pk-hero-line" />
        <div className="pk-hero-inner">
          <nav className="pk-bc" aria-label="Навигация">
            <a href="/">Начало</a>
            <span aria-hidden="true">›</span>
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

        {/* ── Search ── */}
        <div className="pk-search-wrap">
          <span className="pk-search-icon" aria-hidden="true">🔍</span>
          <input
            type="search"
            className="pk-search"
            placeholder="Търси продукт, болест, активно вещество..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Търсене в продуктите"
            autoComplete="off"
          />
          {search && (
            <button className="pk-search-x" onClick={handleClearSearch} aria-label="Изчисти търсенето">
              ✕
            </button>
          )}
        </div>

        {/* ── Филтри ── */}
        {/* id="pk-grid-anchor" — scroll target при смяна на филтър */}
        <div id="pk-grid-anchor" className="pk-filters" role="group" aria-label="Филтър по категория">
          <button
            className={`pk-chip${activeFilter === 'all' ? ' pk-chip--on' : ''}`}
            onClick={() => handleFilter('all')}
          >
            🌱 Всички <span className="pk-chip-n">{products.length}</span>
          </button>
          {categories.map(cat => {
            const count = products.filter(p => p.category_label === cat).length
            return (
              <button
                key={cat}
                className={`pk-chip${activeFilter === cat ? ' pk-chip--on' : ''}`}
                onClick={() => handleFilter(cat)}
              >
                {CAT_ICONS[cat] || '🌿'} {cat}
                <span className="pk-chip-n">{count}</span>
              </button>
            )
          })}
        </div>

        {/* ── Брой резултати ── */}
        {(search || activeFilter !== 'all') && filtered.length > 0 && (
          <p className="pk-count" role="status" aria-live="polite">
            {filtered.length} продукт{filtered.length !== 1 ? 'а' : ''}
            {activeFilter !== 'all' && ` · ${activeFilter}`}
            {search && ` · „${search}"`}
          </p>
        )}

        {/* ── Empty state ── */}
        {filtered.length === 0 && (
          <div className="pk-empty" role="status">
            <div style={{ fontSize:48, marginBottom:14 }}>🌿</div>
            <p style={{ fontSize:15, color:'#6b7280', marginBottom:18 }}>
              Няма продукти за <strong>„{search}"</strong>
            </p>
            <button className="pk-empty-btn" onClick={handleClearSearch}>
              Покажи всички
            </button>
          </div>
        )}

        {/* ══ GRID ══ */}
        {filtered.length > 0 && (
          <>
            <div className="pk-grid" role="list" aria-label="Продуктов каталог">
              {visibleCards.map((p, idx) => {
                const color   = p.color || '#16a34a'
                const rating  = getRating(p)
                const pageUrl = `/produkt/${p.slug}`
                const bullets = Array.isArray(p.bullets) && p.bullets.length
                  ? p.bullets
                  : Array.isArray(p.features) ? p.features : []

                // Първите BATCH снимки → eager (above-the-fold), останалите → lazy
                const imgLoading = idx < initialVisible ? 'eager' : 'lazy'

                return (
                  <article key={p.id} className="pk-card" role="listitem">

                    {/* Снимка */}
                    <a
                      href={pageUrl}
                      className="pk-card-img-wrap"
                      tabIndex={-1}
                      aria-hidden="true"
                    >
                      {p.badge_text && (
                        <span
                          className="pk-badge"
                          style={{ background: p.badge_color || color }}
                        >
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
                          loading={imgLoading}
                          decoding={idx < initialVisible ? 'sync' : 'async'}
                          width={220}
                          height={180}
                          className="pk-card-img"
                          onError={e => {
                            ;(e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <span style={{ fontSize:64 }} aria-hidden="true">
                          {p.emoji || '🌿'}
                        </span>
                      )}
                    </a>

                    {/* Тяло */}
                    <div className="pk-card-body">

                      {/* Мобилен ред с badge + tag */}
                      {(p.badge_text || p.tag_text) && (
                        <div className="pk-mobile-badges">
                          {p.badge_text && (
                            <span
                              className="pk-mobile-badge"
                              style={{ background: p.badge_color || color }}
                            >
                              {p.badge_text}
                            </span>
                          )}
                          {p.tag_text && (
                            <span className="pk-mobile-tag">
                              {p.emoji} {p.tag_text}
                            </span>
                          )}
                        </div>
                      )}

                      {p.category_label && (
                        <div className="pk-card-cat" style={{ color }}>
                          {CAT_ICONS[p.category_label] || p.emoji || '🌿'}{' '}
                          {p.category_label}
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
                        <span style={{ fontSize:12, fontWeight:700, color:'#374151' }}>
                          {rating}/5
                        </span>
                        {p.review_count && (
                          <span style={{ fontSize:11, color:'#9ca3af' }}>
                            ({p.review_count})
                          </span>
                        )}
                      </div>

                      {/* Bullets — само 2 */}
                      {bullets.slice(0, 2).length > 0 && (
                        <ul className="pk-bullets">
                          {bullets.slice(0, 2).map((b, j) => (
                            <li key={j} className="pk-bullet">
                              <span
                                className="pk-bullet-dot"
                                style={{ background: color }}
                                aria-hidden="true"
                              >✓</span>
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
                          <span className="pk-chip-meta pk-chip-orange">
                            {p.quarantine_days}д. карантина
                          </span>
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
                        <div style={{
                          display: 'flex', alignItems: 'baseline',
                          gap: 4, margin: '6px 0 2px',
                        }}>
                          <span style={{
                            fontFamily: "'Cormorant Garamond',serif",
                            fontSize: 26, fontWeight: 700,
                            color: '#0f172a', lineHeight: 1,
                          }}>
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
                          boxShadow:  `0 6px 20px ${color}33`,
                        }}
                      >
                        Прочети повече →
                      </a>
                    </div>
                  </article>
                )
              })}

              {/* Skeleton placeholders — само когато loading */}
              {loading && Array.from({ length: skeletonCount }).map((_, i) => (
                <SkeletonCard key={`sk-${i}`} />
              ))}

              {/* ── Sentinel за IntersectionObserver — вътре в grid-а ── */}
              {/* Fix: трябва да е grid child за да работи grid-column: 1/-1 */}
              {hasMore && (
                <div
                  ref={sentinelRef}
                  className="pk-sentinel"
                  aria-hidden="true"
                  style={{ gridColumn: '1 / -1' }}
                />
              )}
            </div>

            {/* ── Показани X от N ── */}
            {filtered.length > initialVisible && (
              <p className="pk-load-info" aria-live="polite">
                Показани {Math.min(visible, filtered.length)} от {filtered.length} продукта
                {hasMore && (
                  <button
                    className="pk-load-more-btn"
                    onClick={loadMore}
                    aria-label="Зареди още продукти"
                  >
                    Зареди още ↓
                  </button>
                )}
              </p>
            )}
          </>
        )}

        {/* ── Bottom CTA ── */}
        <div className="pk-bottom-cta">
          <div style={{ fontSize:40, marginBottom:12 }}>🍅</div>
          <h2 className="pk-bottom-title">Не знаеш кое е подходящо за теб?</h2>
          <p className="pk-bottom-desc">
            Изтегли безплатния наръчник — там ще намериш пълен план за отглеждане и кой
            продукт кога да приложиш.
          </p>
          <div className="pk-bottom-btns">
            <a href="/#handbooks" className="pk-bottom-btn-primary">
              🎁 Вземи безплатния наръчник
            </a>
            <a href="/" className="pk-bottom-btn-ghost">← Назад към началото</a>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer style={{
        textAlign: 'center', padding: '20px 24px',
        fontSize: 12.5, color: '#9ca3af',
        borderTop: '1px solid #f1f5f9',
      }}>
        © 2025–2026 Denny Angelow ·{' '}
        <a href="/" style={{ color:'#16a34a', textDecoration:'none', fontWeight:600 }}>
          dennyangelow.com
        </a>
      </footer>

    </div>
  )
}
