'use client'
// app/blog/BlogListClient.tsx — v1
// ✅ НОВ файл. Клиентски модел на /blog списъка, огледален на
//    app/produkti/ProduktCatalogClient.tsx:
//   - Категорийният филтър е чист client state (activeFilter) — инстантно
//     филтриране, без reload, без ?category= в URL-а.
//   - Infinite scroll batch reveal през същия getBoundingClientRect()
//     scroll listener подход като produkti (по-примитивно от
//     IntersectionObserver, но работи навсякъде без browser quirks).
//   - "Всички статии" блок долу — РЕАЛЕН, видим списък с всички заглавия,
//     независимо от активния филтър. Не е cloaking трик — вижда се, ако
//     скролнеш до долу, точно като .pk-all-links при produkti. Основният
//     discovery механизъм за Google е app/sitemap.ts, не този блок — той е
//     бърз преглед за реален потребител + допълнителна crawl подсигуровка.

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { SafeImg } from '@/components/client/SafeImg'
import type { BlogListPost, BlogCategory } from '@/lib/blog'
import { categoryLabel, categoryEmoji, deriveExcerpt } from '@/lib/blog'

const BATCH = 9

interface Props {
  posts:           BlogListPost[]
  categories:      BlogCategory[]
  initialVisible?: number
}

function SkeletonCard() {
  return (
    <div className="blog-card blog-skeleton" role="presentation" aria-hidden="true">
      <div className="blog-skel-img" />
      <div className="blog-card-body" style={{ gap: 8 }}>
        <div className="blog-skel-line" style={{ width: '40%', height: 10 }} />
        <div className="blog-skel-line" style={{ width: '85%', height: 18 }} />
        <div className="blog-skel-line" style={{ width: '95%', height: 12 }} />
        <div className="blog-skel-line" style={{ width: '60%', height: 12 }} />
      </div>
    </div>
  )
}

export default function BlogListClient({ posts, categories, initialVisible = BATCH }: Props) {
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [visible,       setVisible]     = useState(initialVisible)
  const [loading,       setLoading]     = useState(false)

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return posts
    return posts.filter(p => p.category === activeFilter)
  }, [posts, activeFilter])

  // ── Reset visible при смяна на филтър ────────────────────────────────────
  useEffect(() => {
    setVisible(initialVisible)
  }, [activeFilter, initialVisible])

  const loadMore = useCallback(() => {
    setVisible(v => v + BATCH)
  }, [])

  const visibleCards  = filtered.slice(0, visible)
  const hasMore       = visible < filtered.length
  const skeletonCount = hasMore ? Math.min(BATCH, filtered.length - visible) : 0

  // ── Infinite scroll (същия подход като ProduktCatalogClient) ─────────────
  const sentinelRef     = useRef<HTMLDivElement>(null)
  const loadingGuardRef = useRef(false)

  useEffect(() => {
    if (!hasMore) return

    const checkScroll = () => {
      if (loadingGuardRef.current) return
      const el = sentinelRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
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
    checkScroll()

    return () => {
      window.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [hasMore, loadMore])

  const handleFilter = useCallback((cat: string) => {
    setActiveFilter(cat)
    document.getElementById('blog-grid-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // ✅ Азбучно подредени за "Всички статии" — независимо от филтъра/scroll
  //    състоянието на грида по-горе.
  const allSorted = useMemo(
    () => [...posts].sort((a, b) => a.title.localeCompare(b.title, 'bg')),
    [posts]
  )

  return (
    <>
      <div className="blog-hero">
        <div className="blog-hero-inner">
          <nav className="blog-breadcrumb" aria-label="Breadcrumb">
            <a href="/">Начало</a><span>/</span><span>Блог</span>
          </nav>
          <h1 className="blog-hero-title">Блог за градинари и фермери</h1>
          <p className="blog-hero-sub">
            Практични съвети за домати, краставици, торене и оранжерии — изпробвани в реални условия, не преписани от интернет.
          </p>

          <div id="blog-grid-anchor" className="blog-cat-filters" role="group" aria-label="Филтър по категория">
            <button
              type="button"
              className={`blog-cat-chip${activeFilter === 'all' ? ' blog-cat-chip--active' : ''}`}
              onClick={() => handleFilter('all')}
            >
              Всички <span className="blog-chip-n">{posts.length}</span>
            </button>
            {categories.map(c => {
              const count = posts.filter(p => p.category === c.slug).length
              if (count === 0) return null
              return (
                <button
                  key={c.slug}
                  type="button"
                  className={`blog-cat-chip${activeFilter === c.slug ? ' blog-cat-chip--active' : ''}`}
                  onClick={() => handleFilter(c.slug)}
                >
                  {c.emoji} {c.label} <span className="blog-chip-n">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="blog-list-wrap">
        {filtered.length === 0 ? (
          <div className="blog-empty">
            <div style={{ fontSize: 40, marginBottom: 10 }}>🌱</div>
            Все още няма публикувани статии{activeFilter !== 'all' ? ` в „${categoryLabel(activeFilter, categories)}"` : ''}. Провери отново скоро.
          </div>
        ) : (
          <>
            <div className="blog-grid">
              {visibleCards.map((post, i) => (
                <a key={post.id} href={`/blog/${post.slug}`} className="blog-card">
                  <div className="blog-card-img-wrap">
                    {post.cover_image_url && (
                      <SafeImg
                        src={post.cover_image_url}
                        alt={post.cover_image_alt || post.title}
                        priority={activeFilter === 'all' && i === 0}
                        width={640}
                        height={360}
                        quality={70}
                        sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                    {post.category && <span className="blog-card-cat">{categoryEmoji(post.category, categories)} {categoryLabel(post.category, categories)}</span>}
                  </div>
                  <div className="blog-card-body">
                    <h2 className="blog-card-title">{post.title}</h2>
                    <p className="blog-card-excerpt">{deriveExcerpt(post)}</p>
                    <div className="blog-card-meta">
                      {post.published_at && (
                        <span>{new Date(post.published_at).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      )}
                      {post.reading_time_minutes && <span>· {post.reading_time_minutes} мин четене</span>}
                    </div>
                  </div>
                </a>
              ))}

              {loading && Array.from({ length: skeletonCount }).map((_, i) => (
                <SkeletonCard key={`sk-${i}`} />
              ))}

              {hasMore && (
                <div ref={sentinelRef} className="blog-sentinel" role="presentation" aria-hidden="true" style={{ gridColumn: '1/-1' }} />
              )}
            </div>

            {filtered.length > initialVisible && (
              <p className="blog-load-info" aria-live="polite">
                Показани {Math.min(visible, filtered.length)} от {filtered.length} статии
                {hasMore && (
                  <button type="button" className="blog-load-more-btn" onClick={loadMore} aria-label="Зареди още статии">
                    Зареди още ↓
                  </button>
                )}
              </p>
            )}
          </>
        )}

        {/* ── Всички статии — реален, видим списък, не скрит trick ──────── */}
        {posts.length > 0 && (
          <div className="blog-all-links">
            <h2 className="blog-all-links-title">Всички статии (А-Я)</h2>
            <div className="blog-all-links-grid">
              {allSorted.map(p => (
                <a key={p.id} href={`/blog/${p.slug}`} className="blog-all-links-item">
                  {p.title}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
