// app/blog/[slug]/page.tsx — v3
// ✅ ПРОМЯНА спрямо v2: FAQ schema вече минава през richTextToPlain() от
//    '@/lib/blogRichText' — маха [текст](линк) markdown синтаксиса преди
//    да влезе в JSON-LD, за да не изтече суров синтаксис в Google
//    structured data (виж коментара в lib/blogRichText.tsx).
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import BlogPostBody from './BlogPostBody'
import type { BlogPost, BlogProductEmbedBlock, BlogCategory } from '@/lib/blog'
import { deriveExcerpt, getAllPostImages, DEFAULT_BLOG_CATEGORIES } from '@/lib/blog'
import { richTextToPlain } from '@/lib/blogRichText'

export const revalidate = 300

const BASE_URL    = 'https://dennyangelow.com'
const AUTHOR_NAME = 'Denny Angelow'
const FALLBACK_OG = `${BASE_URL}/og-image.jpg`

export interface ResolvedEmbedProduct {
  key:         string   // `${product_type}:${slug}`
  name:        string
  description?: string
  image_url?:  string
  price?:      number
  price_currency?: string
  url:         string   // /produkt/slug или /products/slug
  affiliate:   boolean
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

// ✅ Разрешаваме product_embed блоковете към реални продуктови данни
//    server-side — по-бързо (без клиентски fetch-и) и ISR-friendly.
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

export async function generateStaticParams() {
  try {
    const { data } = await supabaseAdmin.from('blog_posts').select('slug').eq('active', true).eq('status', 'published')
    return (data || []).map(p => ({ slug: p.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
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

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
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
