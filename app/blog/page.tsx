// app/blog/page.tsx — v5
// ✅ ПРОМЯНА спрямо v4:
//   • <title>: "| Denny Angelow" е махнат от низа — root layout.tsx има
//     title.template '%s | Denny Angelow', така че преди заглавието излизаше
//     "... | Denny Angelow | Denny Angelow". OG/Twitter заглавията (не се
//     темплейтват) запазват марката.
//   • alternates.types → RSS feed-ът (/blog/rss.xml) е обявен в <head>.
//   • JSON-LD: '<' се escape-ва (\u003c) — </script> в заглавие не може да
//     счупи страницата.
// ✅ v4: изцяло клиентски модел, огледален на /produkti (ProduktCatalogClient):
//   - getPublishedPosts() тегли САМО леките колони (BlogListPost) — без 'content'.
//   - Категорийният филтър е чист client state (без ?category= в URL-а).
//   - Infinite scroll batch reveal вместо ?page=.
//   - metadata е статичен export.
//   - Discovery на статиите е през app/sitemap.ts.
//
// ⚠️ header-ът (SiteHeader) и количка-конфигурацията живеят в
//    app/blog/layout.tsx за целия /blog route group.
import { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import BlogListClient from './BlogListClient'
import type { BlogListPost, BlogCategory } from '@/lib/blog'
import { DEFAULT_BLOG_CATEGORIES } from '@/lib/blog'

export const revalidate = 300

const BASE_URL    = 'https://dennyangelow.com'
const AUTHOR_NAME = 'Denny Angelow'
const FALLBACK_OG = `${BASE_URL}/og-image.jpg`

// ✅ Без марка — добавя се от title.template в app/layout.tsx
const PAGE_TITLE    = 'Блог — Съвети за домати, краставици и торене'
const PAGE_TITLE_OG = `${PAGE_TITLE} | Denny Angelow`
const PAGE_DESC     = 'Практични статии за отглеждане на домати и краставици, торене, болести и оранжерии — от агро консултант с 8+ години опит.'

const jsonLd = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c')

export const metadata: Metadata = {
  title:       PAGE_TITLE,
  description: PAGE_DESC,
  alternates: {
    canonical: `${BASE_URL}/blog`,
    types: { 'application/rss+xml': `${BASE_URL}/blog/rss.xml` },
  },
  openGraph: {
    title: PAGE_TITLE_OG, description: PAGE_DESC, url: `${BASE_URL}/blog`,
    siteName: 'Denny Angelow', locale: 'bg_BG', type: 'website',
    images: [{ url: FALLBACK_OG, width: 1200, height: 630, alt: PAGE_TITLE_OG }],
  },
  twitter: { card: 'summary_large_image', title: PAGE_TITLE_OG, description: PAGE_DESC, images: [FALLBACK_OG] },
  robots: { index: true, follow: true },
}

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

// ✅ ЛЕКА заявка — само колоните, нужни за картите в списъка. 'content' НЕ се тегли.
async function getPublishedPosts(): Promise<BlogListPost[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .select('id, slug, title, excerpt, cover_image_url, cover_image_alt, category, published_at, updated_at, reading_time_minutes')
      .eq('active', true)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('[blog/page] getPublishedPosts:', err)
    return []
  }
}

export default async function BlogListPage() {
  const [posts, categories] = await Promise.all([getPublishedPosts(), getCategories()])

  const blogSchema = {
    '@context': 'https://schema.org',
    '@type':    'Blog',
    name:        'Denny Angelow — Блог',
    description: 'Статии за домати, краставици, торене и оранжерии.',
    url:          `${BASE_URL}/blog`,
    inLanguage:  'bg-BG',
    publisher: { '@type': 'Person', name: AUTHOR_NAME, url: BASE_URL },
    // до 20 в schema-та — Google открива всяка статия през app/sitemap.ts
    blogPost: posts.slice(0, 20).map(p => ({
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(blogSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema) }} />

      <BlogListClient posts={posts} categories={categories} initialVisible={9} />
    </>
  )
}
