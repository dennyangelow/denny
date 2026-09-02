// app/blog/page.tsx — v3
// ✅ ПРОМЯНА спрямо v2: SafeImg width/height 640x400 → 640x360 (16:9, вместо
//    16:10) — съвпада с новия aspect-ratio на .blog-card-img-wrap (виж
//    blog.css) и с .bp-cover на единичния пост, за да реже еднакво навсякъде.
//    Добавен quality={70} — PageSpeed отчете 13.8 KiB спестими компресия за
//    тези card thumbnails, default 75 е излишно високо за този размер.
import { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { SafeImg } from '@/components/client/SafeImg'
import type { BlogPost, BlogCategory } from '@/lib/blog'
import { DEFAULT_BLOG_CATEGORIES, categoryLabel, categoryEmoji, deriveExcerpt } from '@/lib/blog'

export const revalidate = 300

const BASE_URL    = 'https://dennyangelow.com'
const AUTHOR_NAME = 'Denny Angelow'
const FALLBACK_OG = `${BASE_URL}/og-image.jpg`

async function getCategories(): Promise<BlogCategory[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('blog_categories')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return data && data.length > 0 ? data : DEFAULT_BLOG_CATEGORIES
  } catch (err) {
    console.error('[blog/page] getCategories:', err)
    return DEFAULT_BLOG_CATEGORIES
  }
}

async function getPublishedPosts(category?: string): Promise<BlogPost[]> {
  try {
    let query = supabaseAdmin
      .from('blog_posts')
      .select('*')
      .eq('active', true)
      .eq('status', 'published')
      .order('published_at', { ascending: false })

    if (category) query = query.eq('category', category)

    const { data, error } = await query
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('[blog/page] getPublishedPosts:', err)
    return []
  }
}

export async function generateMetadata(
  { searchParams }: { searchParams: Promise<{ category?: string }> }
): Promise<Metadata> {
  const { category } = await searchParams
  const canonicalUrl = category ? `${BASE_URL}/blog?category=${category}` : `${BASE_URL}/blog`

  const title = category
    ? `${categoryLabel(category)} — Блог | Denny Angelow`
    : 'Блог — Съвети за домати, краставици и торене | Denny Angelow'

  const description = category
    ? `Статии за ${categoryLabel(category).toLowerCase()} от агро консултант Denny Angelow — практични съвети, изпробвани в реални оранжерии.`
    : 'Практични статии за отглеждане на домати и краставици, торене, болести и оранжерии — от агро консултант с 8+ години опит.'

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title, description, url: canonicalUrl, siteName: 'Denny Angelow',
      locale: 'bg_BG', type: 'website',
      images: [{ url: FALLBACK_OG, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [FALLBACK_OG] },
    robots: { index: true, follow: true },
  }
}

export default async function BlogListPage(
  { searchParams }: { searchParams: Promise<{ category?: string }> }
) {
  const { category } = await searchParams
  const [posts, categories] = await Promise.all([getPublishedPosts(category), getCategories()])
  const canonicalUrl = category ? `${BASE_URL}/blog?category=${category}` : `${BASE_URL}/blog`

  const blogSchema = {
    '@context': 'https://schema.org',
    '@type':    'Blog',
    name:        'Denny Angelow — Блог',
    description: 'Статии за домати, краставици, торене и оранжерии.',
    url:          canonicalUrl,
    inLanguage:  'bg-BG',
    publisher: { '@type': 'Person', name: AUTHOR_NAME, url: BASE_URL },
    blogPost: posts.slice(0, 12).map(p => ({
      '@type':       'BlogPosting',
      headline:       p.title,
      url:            `${BASE_URL}/blog/${p.slug}`,
      datePublished:  p.published_at,
      dateModified:   p.updated_at,
    })),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Начало', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Блог',    item: `${BASE_URL}/blog` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div className="blog-hero">
        <div className="blog-hero-inner">
          <nav className="blog-breadcrumb" aria-label="Breadcrumb">
            <a href="/">Начало</a><span>/</span><span>Блог</span>
          </nav>
          <h1 className="blog-hero-title">
            {category ? `${categoryEmoji(category, categories)} ${categoryLabel(category, categories)}` : 'Блог за градинари и фермери'}
          </h1>
          <p className="blog-hero-sub">
            Практични съвети за домати, краставици, торене и оранжерии — изпробвани в реални условия, не преписани от интернет.
          </p>
          <div className="blog-cat-filters">
            <a href="/blog" aria-current={!category ? 'page' : undefined} className={`blog-cat-chip${!category ? ' blog-cat-chip--active' : ''}`}>Всички</a>
            {categories.map(c => (
              <a key={c.slug} href={`/blog?category=${c.slug}`} aria-current={category === c.slug ? 'page' : undefined}
                className={`blog-cat-chip${category === c.slug ? ' blog-cat-chip--active' : ''}`}>
                {c.emoji} {c.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="blog-list-wrap">
        {posts.length === 0 ? (
          <div className="blog-empty">
            <div style={{ fontSize: 40, marginBottom: 10 }}>🌱</div>
            Все още няма публикувани статии{category ? ` в „${categoryLabel(category, categories)}"` : ''}. Провери отново скоро.
          </div>
        ) : (
          <div className="blog-grid">
            {posts.map((post, i) => (
              <a key={post.id} href={`/blog/${post.slug}`} className="blog-card">
                <div className="blog-card-img-wrap">
                  {post.cover_image_url && (
                    <SafeImg
                      src={post.cover_image_url}
                      alt={post.cover_image_alt || post.title}
                      priority={i === 0}
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
          </div>
        )}
      </div>
    </>
  )
}
