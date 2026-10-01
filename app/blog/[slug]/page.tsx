// app/blog/[slug]/page.tsx — v6
// ✅ ПРОМЯНА спрямо v5:
//   1) НОВО resolveHandbookEmbeds() — огледало на resolveProductEmbeds(),
//      тегли редовете от naruchnici таблицата за всеки 'handbook_embed'
//      block, срещнат в post.content (виж lib/blog.ts v5).
//   2) НОВО resolveFallbackHandbook() — ако постът НЯМА нито един ръчно
//      вграден handbook_embed, но категорията му има активен наръчник
//      (naruchnici.category === post.category), BlogPostBody показва
//      автоматична карта в края на статията вместо статията да остане
//      без нито един lead capture CTA. Приоритет: sort_order, после
//      created_at — ако в бъдеще има повече от 1 наръчник за категория.
//   (останалата част от v5 — категорийната pillar логика и т.н. — непроменена)

import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import BlogPostBody from './BlogPostBody'
import BlogCategoryHub from './BlogCategoryHub'
import type { BlogPost, BlogProductEmbedBlock, BlogHandbookEmbedBlock, BlogCategory, BlogListPost } from '@/lib/blog'
import { deriveExcerpt, getAllPostImages, DEFAULT_BLOG_CATEGORIES } from '@/lib/blog'
import { richTextToPlain } from '@/lib/blogRichText'
import type { ResolvedHandbook } from '@/components/blog/BlogHandbookEmbed'

export const revalidate = 300

const BASE_URL    = 'https://dennyangelow.com'
const AUTHOR_NAME = 'Denny Angelow'
const FALLBACK_OG = `${BASE_URL}/og-image.jpg`

export interface ResolvedEmbedProduct {
  key:         string
  name:        string
  description?: string
  image_url?:  string
  price?:      number
  price_currency?: string
  url:         string
  affiliate:   boolean
  partner?:    string
}

async function getCategoryBySlug(slug: string): Promise<BlogCategory | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('blog_categories')
      .select('*')
      .eq('slug', slug)
      .eq('active', true)
      .maybeSingle()
    if (error) throw error
    return data
  } catch (err) {
    console.error('[blog/[slug]/page] getCategoryBySlug:', err)
    return null
  }
}

async function getCategoryPosts(categorySlug: string): Promise<BlogListPost[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .select('id, slug, title, excerpt, cover_image_url, cover_image_alt, category, published_at, updated_at, reading_time_minutes')
      .eq('active', true)
      .eq('status', 'published')
      .eq('category', categorySlug)
      .order('published_at', { ascending: false })
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('[blog/[slug]/page] getCategoryPosts:', err)
    return []
  }
}

async function getPost(slug: string): Promise<BlogPost | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('active', true)
      .eq('status', 'published')
      .single()
    if (error) return null
    return data
  } catch (err) {
    console.error('[blog/[slug]/page] getPost:', err)
    return null
  }
}

async function getRelatedPosts(post: BlogPost): Promise<BlogPost[]> {
  try {
    const { data } = await supabaseAdmin
      .from('blog_posts')
      .select('*')
      .eq('active', true)
      .eq('status', 'published')
      .eq('category', post.category || '')
      .neq('slug', post.slug)
      .order('published_at', { ascending: false })
      .limit(3)
    return data || []
  } catch {
    return []
  }
}

async function resolveProductEmbeds(post: BlogPost): Promise<Record<string, ResolvedEmbedProduct>> {
  const embeds = post.content.filter((b): b is BlogProductEmbedBlock => b.type === 'product_embed')
  if (embeds.length === 0) return {}

  const affiliateSlugs = Array.from(new Set(embeds.filter(e => e.product_type === 'affiliate').map(e => e.slug)))
  const ownSlugs        = Array.from(new Set(embeds.filter(e => e.product_type === 'own').map(e => e.slug)))

  const result: Record<string, ResolvedEmbedProduct> = {}

  if (affiliateSlugs.length > 0) {
    const { data } = await supabaseAdmin.from('affiliate_products').select('*').in('slug', affiliateSlugs).eq('active', true)
    ;(data || []).forEach((p: any) => {
      result[`affiliate:${p.slug}`] = {
        key: `affiliate:${p.slug}`, name: p.name, description: p.subtitle || p.description,
        image_url: p.image_url, price: p.price, price_currency: p.price_currency,
        partner: p.partner,
        url: `/produkt/${p.slug}`, affiliate: true,
      }
    })
  }

  if (ownSlugs.length > 0) {
    const { data } = await supabaseAdmin.from('products').select('*').in('slug', ownSlugs).eq('active', true)
    ;(data || []).forEach((p: any) => {
      result[`own:${p.slug}`] = {
        key: `own:${p.slug}`, name: p.name, description: p.subtitle || p.description,
        image_url: p.image_url, price: p.price,
        url: `/products/${p.slug}`, affiliate: false,
      }
    })
  }

  return result
}

// ✅ НОВО — резолва всеки 'handbook_embed' block, срещнат в статията,
//    срещу naruchnici таблицата. Ключът е директно slug-ът (за разлика
//    от resolveProductEmbeds, тук няма affiliate/own разделение).
async function resolveHandbookEmbeds(post: BlogPost): Promise<Record<string, ResolvedHandbook>> {
  const embeds = post.content.filter((b): b is BlogHandbookEmbedBlock => b.type === 'handbook_embed')
  if (embeds.length === 0) return {}

  const slugs = Array.from(new Set(embeds.map(e => e.slug)))
  // ✅ ФИКС: select('*') вместо изрично изброени колони — ако реалната
  //    naruchnici схема няма точно 'subtitle'/'emoji'/'color' под тези
  //    имена, изричният select гърми с Postgres грешка ("column does not
  //    exist"), хваща се тихо по-долу и връща {} → нищо не се рендва, без
  //    видима грешка на страницата (точно симптомът, който докладва).
  //    select('*') е същият pattern, който вече работи доказано в
  //    /api/naruchnici (GET) и в BlogTab picker-а — няма начин да гръмне
  //    заради име на колона. mapRow() по-долу е "отбранителен" точно
  //    защото различни места в кода досега са предполагали различни имена
  //    (виж бележката в mapRow).
  const { data, error } = await supabaseAdmin
    .from('naruchnici')
    .select('*')
    .in('slug', slugs)
    .eq('active', true)

  if (error) {
    console.error('[blog/[slug]/page] resolveHandbookEmbeds:', error)
    return {}
  }

  const result: Record<string, ResolvedHandbook> = {}
  ;(data || []).forEach((h: any) => { result[h.slug] = mapRow(h) })
  return result
}

// ✅ НОВО — "отбранително" мапване на суров naruchnici ред към
//    ResolvedHandbook. Различни места в кодовата база исторически са
//    предполагали различни имена за коричната снимка (sitemap.ts очаква
//    cover_image_url, HandbooksPanel.tsx Handbook интерфейсът очаква
//    image_url) — вместо да гадаем кое е вярно, поддържаме и двете.
function mapRow(h: any): ResolvedHandbook {
  return {
    slug:             h.slug,
    title:            h.title,
    subtitle:         h.subtitle ?? h.description ?? undefined,
    cover_image_url:  h.cover_image_url ?? h.image_url ?? undefined,
    emoji:            h.emoji ?? undefined,
    color:            h.color ?? undefined,
  }
}

// ✅ НОВО — ако постът няма НИТО ЕДИН ръчно вграден handbook_embed,
//    проверяваме дали категорията му има свързан активен наръчник
//    (naruchnici.category === post.category, вече използвано поле — виж
//    app/page.tsx handbooks мапинга). Ако да, BlogPostBody показва
//    компактна fallback карта в края на статията — така никоя статия не
//    остава без нито един lead capture CTA, дори авторът да забрави да
//    вгради ръчно.
async function resolveFallbackHandbook(post: BlogPost): Promise<ResolvedHandbook | null> {
  const hasManualEmbed = post.content.some(b => b.type === 'handbook_embed')
  if (hasManualEmbed || !post.category) return null

  try {
    const { data, error } = await supabaseAdmin
      .from('naruchnici')
      .select('*')
      .eq('category', post.category)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data ? mapRow(data) : null
  } catch (err) {
    console.error('[blog/[slug]/page] resolveFallbackHandbook:', err)
    return null
  }
}

async function getCategories(): Promise<BlogCategory[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('blog_categories').select('*').eq('active', true).order('sort_order', { ascending: true })
    if (error) throw error
    return data && data.length > 0 ? data : DEFAULT_BLOG_CATEGORIES
  } catch {
    return DEFAULT_BLOG_CATEGORIES
  }
}

export async function generateStaticParams() {
  try {
    const [postsResult, categoriesResult] = await Promise.all([
      supabaseAdmin.from('blog_posts').select('slug').eq('active', true).eq('status', 'published'),
      supabaseAdmin.from('blog_categories').select('slug').eq('active', true),
    ])
    const postParams     = (postsResult.data || []).map(p => ({ slug: p.slug }))
    const categoryParams = (categoriesResult.data || []).map(c => ({ slug: c.slug }))
    return [...postParams, ...categoryParams]
  } catch {
    return []
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params

  const category = await getCategoryBySlug(slug)
  if (category) {
    const title       = `${category.label} — Блог | Denny Angelow`
    const description = category.intro_text || `Статии за ${category.label} от Denny Angelow.`
    const canonicalUrl = `${BASE_URL}/blog/${category.slug}`
    return {
      title,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title, description, url: canonicalUrl, siteName: 'Denny Angelow', locale: 'bg_BG', type: 'website',
        images: [{ url: FALLBACK_OG, width: 1200, height: 630, alt: title }],
      },
      twitter: { card: 'summary_large_image', title, description, images: [FALLBACK_OG] },
      robots: { index: true, follow: true },
    }
  }

  const post = await getPost(slug)
  if (!post) return { title: 'Статията не е намерена' }

  const title       = post.seo_title || `${post.title} | Denny Angelow`
  const description = post.seo_description || deriveExcerpt(post, 160)
  const canonicalUrl = post.canonical_url || `${BASE_URL}/blog/${post.slug}`
  const images       = getAllPostImages(post)
  const ogImage       = images[0]?.url || FALLBACK_OG

  return {
    title,
    description,
    keywords: [post.title, ...(post.tags || []), 'Denny Angelow', 'агро съвети'].filter(Boolean) as string[],
    alternates: { canonical: canonicalUrl, languages: { 'bg-BG': canonicalUrl } },
    openGraph: {
      title, description, url: canonicalUrl, siteName: 'Denny Angelow', locale: 'bg_BG', type: 'article',
      images: images.length > 0 ? images.map(img => ({ url: img.url, width: 1200, height: 630, alt: img.alt })) : [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      authors: [post.author_name || AUTHOR_NAME],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage], creator: '@dennyangelow' },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1 } },
  }
}

export default async function BlogSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const category = await getCategoryBySlug(slug)
  if (category) {
    const posts = await getCategoryPosts(category.slug)
    const canonicalUrl = `${BASE_URL}/blog/${category.slug}`

    const collectionSchema = {
      '@context': 'https://schema.org',
      '@type':    'CollectionPage',
      name:        `${category.label} — Блог`,
      description: category.intro_text || `Статии за ${category.label}`,
      url:          canonicalUrl,
      inLanguage:  'bg-BG',
      hasPart: posts.map(p => ({
        '@type':      'BlogPosting',
        headline:      p.title,
        url:           `${BASE_URL}/blog/${p.slug}`,
      })),
    }

    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type':    'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Начало', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: 'Блог',    item: `${BASE_URL}/blog` },
        { '@type': 'ListItem', position: 3, name: category.label, item: canonicalUrl },
      ],
    }

    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
        <BlogCategoryHub category={category} posts={posts} />
      </>
    )
  }

  const post = await getPost(slug)
  if (!post) notFound()

  const [related, resolvedProducts, resolvedHandbooks, fallbackHandbook, categories] = await Promise.all([
    getRelatedPosts(post),
    resolveProductEmbeds(post),
    resolveHandbookEmbeds(post),
    resolveFallbackHandbook(post),
    getCategories(),
  ])

  const canonicalUrl = post.canonical_url || `${BASE_URL}/blog/${post.slug}`
  const images        = getAllPostImages(post)
  const ogImage        = images[0]?.url || FALLBACK_OG

  const articleSchema = {
    '@context':   'https://schema.org',
    '@type':      'BlogPosting',
    headline:      post.seo_title || post.title,
    description:   post.seo_description || deriveExcerpt(post, 160),
    image:         images.length > 0 ? images.map(img => img.url) : ogImage,
    url:           canonicalUrl,
    datePublished: post.published_at || post.created_at,
    dateModified:  post.updated_at || post.published_at,
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.bp-content p:first-of-type'] },
    author: { '@type': 'Person', name: post.author_name || AUTHOR_NAME, url: BASE_URL, jobTitle: 'Агро Консултант' },
    publisher: {
      '@type': 'Organization', name: AUTHOR_NAME, url: BASE_URL,
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630 },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    articleSection: post.category,
    keywords: (post.tags || []).join(', '),
    inLanguage: 'bg-BG',
  }

  const faqBlocks = post.content.filter(b => b.type === 'faq') as { type: 'faq'; items: { q: string; a: string }[] }[]
  const allFaqItems = faqBlocks.flatMap(b => b.items).filter(i => i.q?.trim() && i.a?.trim())
  const faqSchema = allFaqItems.length > 0 ? {
    '@context': 'https://schema.org', '@type': 'FAQPage', '@id': canonicalUrl, url: canonicalUrl,
    mainEntity: allFaqItems.map(i => ({ '@type': 'Question', name: i.q.trim(), acceptedAnswer: { '@type': 'Answer', text: richTextToPlain(i.a.trim()) } })),
  } : null

  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Начало', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Блог',    item: `${BASE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: canonicalUrl },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <BlogPostBody
        post={post}
        related={related}
        resolvedProducts={resolvedProducts}
        resolvedHandbooks={resolvedHandbooks}
        fallbackHandbook={fallbackHandbook}
        canonicalUrl={canonicalUrl}
        categories={categories}
      />
    </>
  )
}
