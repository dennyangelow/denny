// app/blog/[slug]/page.tsx — v5
// ✅ ПРОМЯНА спрямо v4: [slug] вече обслужва ДВА различни типа страници:
//   1) Post — ако slug-ът съвпада с blog_posts.slug (старото поведение,
//      непроменено).
//   2) Category pillar hub — ако slug-ът съвпада с blog_categories.slug
//      (/blog/domati, /blog/krastavici...).
//   Категорийните slug-ове (domati, krastavici...) никога не се
//   пресичат с post slug-овете (винаги описателни, многодумни), значи
//   няма реален риск от конфликт — но категорията се проверява ПЪРВО във
//   всяка от трите функции по-долу, за да е детерминистично, ако все пак
//   някога се появи съвпадение. (BlogTab.tsx вече също пази при запис —
//   виж collision проверката в save().)
//
// ✅ НОВО v5: ResolvedEmbedProduct вече носи и 'partner' за affiliate
//    продукти — преди липсваше, а AffiliateTrackedLink.tsx разчиташе на
//    resolved.partner точно по коментар, който никога не се сбъдваше.
//    Резултат преди: всеки клик от статия пишеше partner='blog' в
//    affiliate_clicks вместо реалния търговец (напр. agroapteki) — сега
//    се пази реалната атрибуция, а откъде е кликнато носи отделното
//    поле 'source' (виж BlogPostBody.tsx → AffiliateTrackedLink).
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import BlogPostBody from './BlogPostBody'
import BlogCategoryHub from './BlogCategoryHub'
import type { BlogPost, BlogProductEmbedBlock, BlogCategory, BlogListPost } from '@/lib/blog'
import { deriveExcerpt, getAllPostImages, DEFAULT_BLOG_CATEGORIES } from '@/lib/blog'
import { richTextToPlain } from '@/lib/blogRichText'

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
  /** ✅ НОВО — реалният партньор/търговец (напр. "agroapteki") за
   *  affiliate продукти, за коректно tracking-attribution в
   *  AffiliateTrackedLink.tsx. undefined за "own" продукти (Atlas Terra). */
  partner?:    string
}

// ── НОВО: категория по slug — проверява се първо във всяка от трите
//    функции по-долу. maybeSingle() връща null тихо, ако няма съвпадение
//    (нормалният случай, когато slug-ът е реално post slug).
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

// ── НОВО: леки постове за категорийния hub — същите колони като
//    app/blog/page.tsx getPublishedPosts(), само филтрирани по category.
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
        // ✅ НОВО — виж коментара до ResolvedEmbedProduct по-горе.
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

// ✅ ПРОМЯНА: сега връща и post slug-овете, и категорийните slug-ове —
//    и двата типа страници се генерират статично.
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

  // ── НОВО: категория проверена първо ──────────────────────────────────
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

  // ── Съществуващата логика за post metadata, непроменена ──────────────
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

  // ── НОВО: категорийна pillar страница ────────────────────────────────
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

  // ── Съществуващата логика за пост, непроменена ───────────────────────
  const post = await getPost(slug)
  if (!post) notFound()

  const [related, resolvedProducts, categories] = await Promise.all([
    getRelatedPosts(post),
    resolveProductEmbeds(post),
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

      <BlogPostBody post={post} related={related} resolvedProducts={resolvedProducts} canonicalUrl={canonicalUrl} categories={categories} />
    </>
  )
}
