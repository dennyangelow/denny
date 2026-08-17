'use client'
// app/produkti/ProduktCatalogClient.tsx — v4
// ✅ НОВИ ФУНКЦИИ спрямо v3:
//   1. Autocomplete търсачка — instant dropdown с до 5 резултата при писане
//   2. Сортиране: "Популярни" (по кликове) / "По ред" (sort_order) / "А-Я" (азбучен)
//   3. sortedByClicks и clickCounts пропси от сървъра
//   4. "🔥 N клика" badge на картите (само ако > 0)
//   5. Запазено всичко от v3 — нищо не е премахнато

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import type { AffiliateProduct } from '@/lib/affiliate'
import { getRating } from '@/lib/affiliate'

const BATCH = 6

type SortMode = 'popular' | 'order' | 'alpha'

interface Props {
  products:        AffiliateProduct[]   // оригинален ред (sort_order)
  sortedByClicks?: AffiliateProduct[]   // наредени по кликове (от сървъра)
  clickCounts?:    Record<string, number> // брой кликове по slug
  categories:      string[]
  initialVisible?: number
  initialSort?:    SortMode
}

// ✅ Групиране на тесните SEO категории в 6 разбираеми "чадър" филтъра.
// category_label си остава детайлен (за SEO/картата), но филтърът горе
// показва само тези групи — иначе 28 чипа с count=1 задръстват страницата.
// ✅ Всяка category_label може да принадлежи на НЯКОЛКО групи (масив), не само
// на една — важно за 3-в-1/комбинирани продукти (напр. Прев-Голд е едновременно
// фунгицид, инсектицид И акарицид — трябва да излиза и в трите филтъра).
const CATEGORY_GROUPS: Record<string, string[]> = {
  'Системен фунгицид':                 ['Фунгициди'],
  'Меден фунгицид':                    ['Фунгициди'],
  'Системен фунгицид за почва':        ['Фунгициди'],
  'Комбиниран фунгицид':               ['Фунгициди'],
  'Широкоспектърен фунгицид':          ['Фунгициди'],
  'Комбиниран фунгицид за овощни':     ['Фунгициди'],
  'Комбиниран фунгицид за лозя':       ['Фунгициди'],
  'Системен DMI фунгицид':             ['Фунгициди'],
  'Комбиниран SDHI + QoI фунгицид':    ['Фунгициди'],
  'Комбиниран системен фунгицид':      ['Фунгициди'],
  'Комбиниран ботрицид':               ['Фунгициди'],
  'Комбиниран мулти-сайт фунгицид':    ['Фунгициди'],
  'Контактен био фунгицид':            ['Фунгициди'],

  'Биологичен инсектицид':             ['Инсектициди и Акарициди'],
  'Системен инсектицид':               ['Инсектициди и Акарициди'],
  'Акарицид и инсектицид':             ['Инсектициди и Акарициди'],

  'Тотален хербицид':                  ['Хербициди'],
  'Селективен хербицид':               ['Хербициди'],

  'NPK тор с микроелементи':           ['Торове'],
  'Органичен биотор':                  ['Торове'],
  'Органичен течен тор':               ['Торове'],
  'Фосфитен тор':                      ['Торове'],
  'Гранулиран NPK тор':                ['Торове'],
  'PK тор за качество на плода':       ['Торове'],

  'Биостимулатор за имунитет':         ['Биостимулатори'],
  'Калциев биостимулатор':             ['Биостимулатори'],
  'Биостимулатор от водорасли':        ['Биостимулатори'],

  // ✅ Прев-Голд и подобни истински 3-в-1 продукти — участват във всички
  // релевантни филтри, не само в отделен "Комбинирани" бъкет.
  'Био защита на растенията':          ['Фунгициди', 'Инсектициди и Акарициди', 'Комбинирани 3-в-1'],
}

const GROUP_ICONS: Record<string, string> = {
  'Фунгициди':                 '🍄',
  'Инсектициди и Акарициди':   '🐛',
  'Хербициди':                 '🌾',
  'Торове':                    '⭐',
  'Биостимулатори':            '🌿',
  'Комбинирани 3-в-1':         '🛡️',
  'Други':                     '📦',
}

function getCategoryGroups(product: { category_label?: string | null; filter_groups?: string[] | null }): string[] {
  // ✅ Приоритет 1: ръчно избраните групи от админ панела (filter_groups в базата)
  if (Array.isArray(product.filter_groups) && product.filter_groups.length > 0) {
    return product.filter_groups
  }
  // Fallback: старото автоматично картиране по category_label — за продукти,
  // на които администраторът още не е задал filter_groups ръчно.
  const label = product.category_label
  if (!label) return ['Други']
  return CATEGORY_GROUPS[label] || ['Други']
}

// CAT_ICONS — детайлни икони, показвани на самата карта (не във филтъра)
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
  'Селективен хербицид':         '🌾',
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display:'inline-flex', gap:1 }} aria-label={`Рейтинг ${rating} от 5`} role="img">
      {[1,2,3,4,5].map(i => (
        <span key={i} aria-hidden="true"
          style={{ fontSize:13, color: i <= Math.round(rating) ? '#f59e0b' : '#e2e8f0', lineHeight:1 }}>★</span>
      ))}
    </span>
  )
}

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

// ── Autocomplete dropdown ────────────────────────────────────────────────────
function SearchDropdown({
  results,
  onSelect,
}: {
  results: AffiliateProduct[]
  onSelect: (p: AffiliateProduct) => void
}) {
  if (results.length === 0) return null
  return (
    <div style={{
      position: 'absolute',
      top: 'calc(100% + 6px)',
      left: 0, right: 0,
      background: '#fff',
      border: '1.5px solid #e2e8f0',
      borderRadius: 14,
      boxShadow: '0 8px 32px rgba(0,0,0,.12)',
      zIndex: 100,
      overflow: 'hidden',
    }}>
      {results.map(p => (
        <button
          key={p.id}
          onClick={() => onSelect(p)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            width: '100%',
            padding: '10px 14px',
            background: 'none',
            border: 'none',
            borderBottom: '1px solid #f1f5f9',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: "var(--font-dm-sans), sans-serif",
            transition: 'background .12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          {p.image_url ? (
            <img src={p.image_url} alt={p.name} width={36} height={36}
              style={{ width:36, height:36, objectFit:'contain', borderRadius:8, flexShrink:0, mixBlendMode:'multiply' }} />
          ) : (
            <span style={{ fontSize:22, flexShrink:0, width:36, textAlign:'center' }}>{p.emoji || '🌿'}</span>
          )}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13.5, fontWeight:700, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {p.name}
            </div>
            <div style={{ fontSize:11, color: p.color || '#16a34a', fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em', marginTop:1 }}>
              {p.category_label || p.subtitle}
            </div>
          </div>
          <span style={{ fontSize:11, color:'#9ca3af', flexShrink:0 }}>→</span>
        </button>
      ))}
      <div style={{ padding:'8px 14px', fontSize:11, color:'#9ca3af', textAlign:'center' }}>
        Натисни Enter за всички резултати
      </div>
    </div>
  )
}

export function ProduktCatalogClient({
  products,
  sortedByClicks,
  clickCounts = {},
  categories,
  initialVisible = BATCH,
  initialSort = 'popular',
}: Props) {
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [search,       setSearch]       = useState('')
  const [searchFocus,  setSearchFocus]  = useState(false)
  const [sortMode,     setSortMode]     = useState<SortMode>(initialSort)
  const [scrolled,     setScrolled]     = useState(false)
  const [mobileMenu,   setMobileMenu]   = useState(false)
  const [visible,      setVisible]      = useState(initialVisible)
  const [loading,      setLoading]      = useState(false)

  const searchRef    = useRef<HTMLInputElement>(null)
  const dropdownRef  = useRef<HTMLDivElement>(null)

  // ── Header scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  // ── Затваряне на dropdown при клик извън него ────────────────────────────
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (
        searchRef.current && !searchRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setSearchFocus(false)
      }
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  // ── Групирани категории (6 чадър-филтъра вместо 28 тесни) ────────────────
  const groupedCategories = useMemo(() => {
    const set = new Set<string>()
    products.forEach(p => getCategoryGroups(p).forEach(g => set.add(g)))
    // Фиксиран, логичен ред вместо случаен от Set-а
    const order = ['Фунгициди', 'Инсектициди и Акарициди', 'Хербициди', 'Торове', 'Биостимулатори', 'Комбинирани 3-в-1', 'Други']
    return order.filter(g => set.has(g))
  }, [products])

  // ── Базов списък спрямо sort mode ────────────────────────────────────────
  const baseList = useMemo(() => {
    if (sortMode === 'popular' && sortedByClicks) return sortedByClicks
    if (sortMode === 'alpha')  return [...products].sort((a, b) => a.name.localeCompare(b.name, 'bg'))
    return products  // 'order' — sort_order от DB
  }, [sortMode, products, sortedByClicks])

  // ── Автокомплийт резултати (max 5, само при focus + писане) ─────────────
  const autocompleteResults = useMemo(() => {
    if (!search.trim() || search.length < 2) return []
    const q = search.toLowerCase()
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.subtitle?.toLowerCase().includes(q) ||
      p.category_label?.toLowerCase().includes(q) ||
      p.active_substance?.toLowerCase().includes(q) ||
      (p.crops || []).some(c => c.toLowerCase().includes(q))
    ).slice(0, 5)
  }, [search, products])

  // ── Филтриране на основния grid ──────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = baseList
    if (activeFilter !== 'all') {
      list = list.filter(p => getCategoryGroups(p).includes(activeFilter))
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
  }, [baseList, activeFilter, search])

  // ── Reset visible при промяна ────────────────────────────────────────────
  useEffect(() => {
    setVisible(initialVisible)
  }, [search, initialVisible])

  // ── Lazy loading ─────────────────────────────────────────────────────────
  const loadMore = useCallback(() => {
    setVisible(v => v + BATCH)
  }, [])

  const visibleCards  = filtered.slice(0, visible)
  const hasMore       = visible < filtered.length
  const skeletonCount = hasMore ? Math.min(BATCH, filtered.length - visible) : 0

  // ✅ ПРЕМАХНАТ IntersectionObserver изцяло — заменен с обикновен scroll
  // listener + getBoundingClientRect(). По-примитивно, но не зависи от
  // observer semantics/browser quirks — сработва навсякъде без изключение.
  const sentinelElRef   = useRef<HTMLDivElement>(null)
  const loadingGuardRef = useRef(false)

  useEffect(() => {
    if (!hasMore) return

    const checkScroll = () => {
      if (loadingGuardRef.current) return
      const el = sentinelElRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      // Зарежда, когато sentinel-ът е на разстояние ≤500px от долния край на екрана
      if (rect.top <= window.innerHeight + 500) {
        loadingGuardRef.current = true
        setLoading(true)
        requestAnimationFrame(() => {
          loadMore()
          requestAnimationFrame(() => {
            setLoading(false)
            loadingGuardRef.current = false
          })
        })
      }
    }

    window.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    checkScroll()  // веднага при mount — за къси списъци, вече видими без скрол

    return () => {
      window.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [hasMore, loadMore])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleFilter = useCallback((cat: string) => {
    setActiveFilter(cat)
    setVisible(initialVisible)
    document.getElementById('pk-grid-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [initialVisible])

  const handleClearSearch = useCallback(() => {
    setSearch('')
    setActiveFilter('all')
    setSearchFocus(false)
  }, [])

  // При избор от dropdown — отиваме директно на продуктовата страница
  const handleAutocompleteSelect = useCallback((p: AffiliateProduct) => {
    window.location.href = `/produkt/${p.slug}`
  }, [])

  const showDropdown = searchFocus && search.length >= 2 && autocompleteResults.length > 0

  /* ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{
      fontFamily: "var(--font-dm-sans),-apple-system,sans-serif",
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

        {/* ── Search + Sort row ── */}
        <div style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:16, flexWrap:'wrap' }}>

          {/* ✅ AUTOCOMPLETE ТЪРСАЧКА */}
          <div className="pk-search-wrap" style={{ position:'relative', flex:'1 1 260px', marginBottom:0 }}>
            <span className="pk-search-icon" aria-hidden="true">🔍</span>
            <input
              ref={searchRef}
              type="search"
              className="pk-search"
              placeholder="Търси препарат, болест или култура..."
              value={search}
              onChange={e => { setSearch(e.target.value); setVisible(initialVisible) }}
              onFocus={() => setSearchFocus(true)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setSearchFocus(false); setSearch('') }
                if (e.key === 'Enter')  { setSearchFocus(false) }
              }}
              aria-label="Търсене в продуктите"
              aria-autocomplete="list"
              aria-expanded={showDropdown}
              autoComplete="off"
            />
            {search && (
              <button className="pk-search-x" onClick={handleClearSearch} aria-label="Изчисти търсенето">✕</button>
            )}

            {/* ✅ DROPDOWN */}
            {showDropdown && (
              <div ref={dropdownRef}>
                <SearchDropdown
                  results={autocompleteResults}
                  onSelect={handleAutocompleteSelect}
                />
              </div>
            )}
          </div>

          {/* ✅ SORT DROPDOWN */}
          <div style={{ position:'relative', flexShrink:0 }}>
            <select
              value={sortMode}
              onChange={e => { setSortMode(e.target.value as SortMode); setVisible(initialVisible) }}
              style={{
                padding: '13px 36px 13px 14px',
                border: '1.5px solid #e2e8f0',
                borderRadius: 14,
                fontSize: 13.5,
                fontFamily: "var(--font-dm-sans), sans-serif",
                fontWeight: 600,
                color: '#374151',
                background: '#fff',
                cursor: 'pointer',
                outline: 'none',
                appearance: 'none',
                WebkitAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239ca3af' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                minWidth: 150,
              }}
              aria-label="Сортиране"
            >
              <option value="popular">🔥 Популярни</option>
              <option value="order">📋 По ред</option>
              <option value="alpha">🔤 А-Я</option>
            </select>
          </div>
        </div>

        {/* ── Филтри ── */}
        <div id="pk-grid-anchor" className="pk-filters" role="group" aria-label="Филтър по категория">
          <button
            className={`pk-chip${activeFilter === 'all' ? ' pk-chip--on' : ''}`}
            onClick={() => handleFilter('all')}
          >
            🌱 Всички <span className="pk-chip-n">{products.length}</span>
          </button>
          {groupedCategories.map(cat => {
            const count = products.filter(p => getCategoryGroups(p).includes(cat)).length
            return (
              <button
                key={cat}
                className={`pk-chip${activeFilter === cat ? ' pk-chip--on' : ''}`}
                onClick={() => handleFilter(cat)}
              >
                {GROUP_ICONS[cat] || '🌿'} {cat}
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
                const color    = p.color || '#16a34a'
                const rating   = getRating(p)
                const pageUrl  = `/produkt/${p.slug}`
                const bullets  = Array.isArray(p.bullets) && p.bullets.length
                  ? p.bullets
                  : Array.isArray(p.features) ? p.features : []
                const imgLoading = idx < initialVisible ? 'eager' : 'lazy'

                return (
                  <article key={p.id} className="pk-card" role="listitem">

                    {/* Снимка */}
                    <a href={pageUrl} className="pk-card-img-wrap" tabIndex={-1} aria-hidden="true">
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
                          loading={imgLoading}
                          decoding={idx < initialVisible ? 'sync' : 'async'}
                          width={220} height={180}
                          className="pk-card-img"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <span style={{ fontSize:64 }} aria-hidden="true">{p.emoji || '🌿'}</span>
                      )}
                    </a>

                    {/* Тяло */}
                    <div className="pk-card-body">
                      {(p.badge_text || p.tag_text) && (
                        <div className="pk-mobile-badges">
                          {p.badge_text && (
                            <span className="pk-mobile-badge" style={{ background: p.badge_color || color }}>
                              {p.badge_text}
                            </span>
                          )}
                          {p.tag_text && (
                            <span className="pk-mobile-tag">{p.emoji} {p.tag_text}</span>
                          )}
                        </div>
                      )}

                      {p.category_label && (
                        <div className="pk-card-cat" style={{ color }}>
                          {CAT_ICONS[p.category_label] || p.emoji || '🌿'}{' '}{p.category_label}
                        </div>
                      )}

                      <a href={pageUrl} style={{ textDecoration:'none' }}>
                        <h2 className="pk-card-title">{p.name}</h2>
                      </a>

                      {p.subtitle && <p className="pk-card-sub">{p.subtitle}</p>}

                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                        <Stars rating={rating} />
                        <span style={{ fontSize:12, fontWeight:700, color:'#374151' }}>{rating}/5</span>
                        {p.review_count && (
                          <span style={{ fontSize:11, color:'#9ca3af' }}>({p.review_count})</span>
                        )}
                      </div>

                      {bullets.slice(0, 2).length > 0 && (
                        <ul className="pk-bullets">
                          {bullets.slice(0, 2).map((b, j) => (
                            <li key={j} className="pk-bullet">
                              <span className="pk-bullet-dot" style={{ background: color }} aria-hidden="true">✓</span>
                              {b}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="pk-chips-row">
                        {p.quarantine_days === 0 && (
                          <span className="pk-chip-meta pk-chip-green">✓ 0 дни карантина</span>
                        )}
                        {typeof p.quarantine_days === 'number' && p.quarantine_days > 0 && (
                          <span className="pk-chip-meta pk-chip-orange">{p.quarantine_days}д. карантина</span>
                        )}
                        {p.volume && <span className="pk-chip-meta">{p.volume}</span>}
                        {p.season && <span className="pk-chip-meta">🌤 {p.season}</span>}
                      </div>

                      {p.price && (
                        <div style={{ display:'flex', alignItems:'baseline', gap:4, margin:'6px 0 2px' }}>
                          <span style={{ fontFamily:"var(--font-cormorant),serif", fontSize:26, fontWeight:700, color:'#0f172a', lineHeight:1 }}>
                            {Number(p.price).toFixed(2)}
                          </span>
                          <span style={{ fontSize:13, fontWeight:700, color:'#374151' }}>
                            {p.price_currency || 'EUR'}
                          </span>
                        </div>
                      )}

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

              {loading && Array.from({ length: skeletonCount }).map((_, i) => (
                <SkeletonCard key={`sk-${i}`} />
              ))}

              {hasMore && (
                <div ref={sentinelElRef} className="pk-sentinel" aria-hidden="true" style={{ gridColumn:'1/-1' }} />
              )}
            </div>

            {filtered.length > initialVisible && (
              <p className="pk-load-info" aria-live="polite">
                Показани {Math.min(visible, filtered.length)} от {filtered.length} продукта
                {hasMore && (
                  <button className="pk-load-more-btn" onClick={loadMore} aria-label="Зареди още продукти">
                    Зареди още ↓
                  </button>
                )}
              </p>
            )}
          </>
        )}

        {/* ── Пълен списък — винаги в SSR HTML ─────────────────────────────
            ✅ ДОБАВЕНО: за разлика от .pk-grid по-горе (който показва само
            {initialVisible} продукта, докато остатъкът се разкрива при scroll/
            IntersectionObserver), този блок рендира РЕАЛЕН <a href> към ВСЕКИ
            продукт, независимо от filter/sort/visible състоянието. Google не
            скролва при обхождане — с този блок вече не разчита само на
            JSON-LD ItemList schema, за да намери линк тежест от /produkti към
            всяка от 81-те produkt страници. Полезен е и за реални
            потребители, които предпочитат бърз азбучен преглед. ── */}
        {products.length > 0 && (
          <div className="pk-all-links">
            <h2 className="pk-all-links-title">Всички продукти (А-Я)</h2>
            <div className="pk-all-links-grid">
              {[...products]
                .sort((a, b) => a.name.localeCompare(b.name, 'bg'))
                .map(p => (
                  <a key={p.id} href={`/produkt/${p.slug}`} className="pk-all-links-item">
                    {p.name}
                  </a>
                ))}
            </div>
          </div>
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
            <a href="/#handbooks" className="pk-bottom-btn-primary">🎁 Вземи безплатния наръчник</a>
            <a href="/" className="pk-bottom-btn-ghost">← Назад към началото</a>
          </div>
        </div>

      </div>

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
