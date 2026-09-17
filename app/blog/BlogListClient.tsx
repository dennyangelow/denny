'use client'
// app/blog/BlogListClient.tsx — v3
// ✅ ПРОМЯНА спрямо v2: категорийното етикетче се върна като overlay
//    върху снимката (v2 го местеше на собствен ред НАД нея, но това
//    разтягаше картата визуално) — само че вече в ГОРНИЯ ДЕСЕН ъгъл,
//    не ляв (там повечето cover графики имат основния си заглавен
//    текст), с плътен фон вместо полупрозрачен, за четимост върху
//    каквото и да е зад него. Все още е истински <a href="/blog/[category]">
//    (не <span>), съседен на .blog-card-link (не вложен в него) —
//    .blog-card има position:relative, .blog-card-cat е absolute спрямо
//    него. Виж blog.css за съответните CSS промени.
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

  // ── Infinite scroll (IntersectionObserver) ────────────────────────────────
  // ✅ ПРОМЯНА: преди слушаше 'scroll'/'resize' и на всеки tick смяташе
  //    getBoundingClientRect() — форсира reflow при всяко scroll събитие,
  //    независимо колко далеч е сентинелът. IntersectionObserver тригерва
  //    само когато браузърът реално установи, че елементът е близо до
  //    viewport-а (rootMargin действа като предварителен буфер, аналог на
  //    старото "+500"), без ръчни изчисления на всеки frame.
  const sentinelRef     = useRef<HTMLDivElement>(null)
  const loadingGuardRef = useRef(false)
  const loadTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!hasMore) return

    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return
        if (loadingGuardRef.current) return

        loadingGuardRef.current = true
        setLoading(true)

        // ✅ posts вече са напълно заредени client-side (loadMore е просто
        //    local slice, не network заявка) — кратко изкуствено закъснение
        //    вместо мигновен скок, колкото потребителят да усети зареждане
        //    на следващата партида, а не рязко "изскачане" на 9 карти.
        loadTimeoutRef.current = setTimeout(() => {
          loadMore()
          setLoading(false)
          loadingGuardRef.current = false
        }, 250)
      },
      { rootMargin: '500px 0px' }
    )

    observer.observe(el)

    return () => {
      observer.disconnect()
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current)
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
                // ✅ ПРОМЯНА: .blog-card вече е <div>, не <a> — съдържа ДВЕ
                //    отделни, съседни връзки (не вложени!): малкото
                //    категорийно етикетче горе (сочи към новия pillar hub
                //    /blog/[category]) и голямата връзка към самата статия.
                //    Преди категорията беше <span> абсолютно позициониран
                //    В ГОРНИЯ ЛЯВ ъгъл на снимката — покриваше текста на
                //    самите cover графики (виж скрийншота). Сега е реален
                //    <a> (не <span>), пак overlay върху снимката, но в
                //    ГОРНИЯ ДЕСЕН ъгъл — по-безопасна зона за повечето
                //    от cover дизайните на Denny, плюс плътен (не
                //    полупрозрачен) фон за четимост върху каквото и да е
                //    зад него. Структурно е СЪСЕДЕН на .blog-card-link
                //    (не вложен в него) — .blog-card има position:relative,
                //    .blog-card-cat е absolute спрямо него, значи е валиден
                //    HTML (два съседни линка), не линк-в-линк.
                <div key={post.id} className="blog-card">
                  <a href={`/blog/${post.slug}`} className="blog-card-link">
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
                  {post.category && (
                    <a href={`/blog/${post.category}`} className="blog-card-cat">
                      {categoryEmoji(post.category, categories)} {categoryLabel(post.category, categories)}
                    </a>
                  )}
                </div>
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
