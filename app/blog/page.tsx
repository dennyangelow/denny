// app/blog/page.tsx — v4
// ✅ ПРОМЯНА спрямо v3: изцяло клиентски модел, огледален на
//    /produkti (ProduktCatalogClient.tsx):
//   - getPublishedPosts() тегли САМО леките колони (BlogListPost) — без
//     'content'. Преди .select('*') теглеше пълното тяло на всяка статия
//     (paragraphs/product_embeds/faq...) само за да покажем заглавие/
//     excerpt/корица в картата — излишен трансфер, който растеше с всяка
//     нова, по-богата статия.
//   - Категорийният филтър вече НЕ живее в URL-а (?category=) — премахнат
//     searchParams изцяло. Филтрирането е чист client state в
//     BlogListClient — инстантно, без reload. Премахва нуждата от
//     изключение в robots.txt за '/*?' правилото.
//   - Pagination (?page=) също отпада — заменено с infinite scroll batch
//     reveal в BlogListClient (същия getBoundingClientRect() подход като
//     ProduktCatalogClient).
//   - metadata вече е статичен export (не generateMetadata) — /blog е
//     винаги един и същ URL, без вариации, за които да генерираме различен
//     title/canonical.
//   - Discovery на статиите е изцяло през app/sitemap.ts (виж sitemap.ts
//     v11 за revalidate фикса) — "Всички статии" блокът в BlogListClient
//     е за реални посетители + допълнителна crawl подсигуровка, не
//     основен механизъм.
import { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import BlogListClient from './BlogListClient'
import type { BlogListPost, BlogCategory } from '@/lib/blog'
import { DEFAULT_BLOG_CATEGORIES } from '@/lib/blog'

export const revalidate = 300

const BASE_URL    = 'https://dennyangelow.com'
const AUTHOR_NAME = 'Denny Angelow'
const FALLBACK_OG = `${BASE_URL}/og-image.jpg`

const PAGE_TITLE = 'Блог — Съвети за домати, краставици и торене | Denny Angelow'
const PAGE_DESC  = 'Практични статии за отглеждане на домати и краставици, торене, болести и оранжерии — от агро консултант с 8+ години опит.'

// ✅ Статичен metadata export — /blog вече е винаги един и същ URL, без
//    ?category=/?page= варианти, значи няма нужда от generateMetadata().
export const metadata: Metadata = {
  title:       PAGE_TITLE,
  description: PAGE_DESC,
  alternates: { canonical: `${BASE_URL}/blog` },
  openGraph: {
    title: PAGE_TITLE, description: PAGE_DESC, url: `${BASE_URL}/blog`,
    siteName: 'Denny Angelow', locale: 'bg_BG', type: 'website',
    images: [{ url: FALLBACK_OG, width: 1200, height: 630, alt: PAGE_TITLE }],
  },
  twitter: { card: 'summary_large_image', title: PAGE_TITLE, description: PAGE_DESC, images: [FALLBACK_OG] },
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

// ✅ ЛЕКА заявка — само колоните, нужни за картите в списъка. 'content'
//    (пълното тяло на статията) НЕ се тегли тук.
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
    // ✅ до 20 в schema-та (не всичките, ако постовете станат стотици) —
    //    Google и без друго открива всяка статия през app/sitemap.ts.
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <BlogListClient posts={posts} categories={categories} initialVisible={9} />
    </>
  )
}
