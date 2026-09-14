// lib/reviews.ts — v1
// Единен слой за отзиви/тестимониали — заменя products.testimonial (единичен),
// affiliate_products.reviews[], naruchnici.testimonials[] и отделната
// testimonials таблица (началната страница). Всички четат/пишат оттук.
//
// Принцип, еднакъв навсякъде в проекта (виж lib/affiliate.ts, lib/offers.ts):
// НИКОГА не фабрикуваме fallback рейтинг/брой — при липса на реални данни,
// извикващият код трябва да скрие звездите/AggregateRating schema-та изцяло.

import { supabaseAdmin } from '@/lib/supabase'

export type EntityType = 'own_product' | 'affiliate_product' | 'handbook'
export type ReviewSource = 'site_form' | 'social_screenshot' | 'chat_screenshot' | 'imported'
export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export interface Review {
  id:              string
  entity_type:     EntityType
  entity_id:       string
  author_name:     string
  author_location?: string | null
  rating:          number
  text:            string
  source:          ReviewSource
  screenshot_url?: string | null
  verified:        boolean
  featured_home:   boolean
  home_sort_order?: number | null
  status:          ReviewStatus
  created_at:      string
  approved_at?:    string | null
}

export interface AggregateRating {
  avg:   number
  count: number
}

// ── Взима одобрените отзиви за конкретен продукт/наръчник ──────────────────
export async function getReviews(
  entityType: EntityType,
  entityId:   string,
): Promise<Review[]> {
  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  if (error) { console.error('[reviews] getReviews error:', error); return [] }
  return (data as Review[]) || []
}

// ── Взима избраните за началната страница отзиви (през всички типове) ──────
export async function getFeaturedHomeReviews(limit = 12): Promise<Review[]> {
  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('*')
    .eq('status', 'approved')
    .eq('featured_home', true)
    .order('home_sort_order', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error) { console.error('[reviews] getFeaturedHomeReviews error:', error); return [] }
  return (data as Review[]) || []
}

// ── Агрегатен рейтинг за конкретен продукт/наръчник — САМО от реални отзиви ─
export async function getAggregateRating(
  entityType: EntityType,
  entityId:   string,
): Promise<AggregateRating> {
  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('rating')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('status', 'approved')

  if (error || !data || data.length === 0) return { avg: 0, count: 0 }

  const sum = data.reduce((s, r: { rating: number }) => s + r.rating, 0)
  return {
    avg:   Math.round((sum / data.length) * 10) / 10,
    count: data.length,
  }
}

// ── Агрегатен рейтинг за МНОГО продукти наведнъж — една заявка вместо N ────
// Използва се в каталожни страници (/produkti), където правенето на отделна
// getAggregateRating() заявка на продукт (39+ продукта) би било разхищение.
export async function getAggregateRatingsBatch(
  entityType: EntityType,
  entityIds:  string[],
): Promise<Map<string, AggregateRating>> {
  const result = new Map<string, AggregateRating>()
  if (entityIds.length === 0) return result

  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('entity_id, rating')
    .eq('entity_type', entityType)
    .eq('status', 'approved')
    .in('entity_id', entityIds)

  if (error) { console.error('[reviews] getAggregateRatingsBatch error:', error); return result }

  const grouped = new Map<string, number[]>()
  for (const row of (data as { entity_id: string; rating: number }[]) || []) {
    const arr = grouped.get(row.entity_id) || []
    arr.push(row.rating)
    grouped.set(row.entity_id, arr)
  }
  for (const [id, ratings] of grouped) {
    const sum = ratings.reduce((s, r) => s + r, 0)
    result.set(id, { avg: Math.round((sum / ratings.length) * 10) / 10, count: ratings.length })
  }
  return result
}

// ── Има ли достатъчно реални данни, за да покажем рейтинг/schema ───────────
export function hasRealRating(agg: AggregateRating): boolean {
  return agg.avg > 0 && agg.count > 0
}

// ── Schema.org helper — AggregateRating + Review[] САМО от реални одобрени
//    редове с реален текст. Никога не се извиква с фабрикувани данни.
export function buildReviewSchema(agg: AggregateRating, reviews: Review[]) {
  if (!hasRealRating(agg)) return null

  return {
    aggregateRating: {
      '@type':    'AggregateRating',
      ratingValue: agg.avg,
      reviewCount: agg.count,
      bestRating:  5,
      worstRating: 1,
    },
    // ✅ Само отзиви с реален текст участват в schema — screenshot-базирани
    // записи без транскрибиран `text` не носят SEO стойност за Google
    // (не чете текст вътре в снимка) и не влизат тук.
    review: reviews
      .filter(r => r.text && r.text.trim().length > 0)
      .map(r => ({
        '@type': 'Review',
        reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
        author: { '@type': 'Person', name: r.author_name },
        reviewBody: r.text,
        ...(r.created_at ? { datePublished: new Date(r.created_at).toISOString().split('T')[0] } : {}),
      })),
  }
}

// ── Admin: създава нов отзив (ръчно въведен или от скрийншот) ──────────────
export async function createReview(input: {
  entity_type:     EntityType
  entity_id:       string
  author_name:     string
  author_location?: string
  rating:          number
  text:            string
  source?:         ReviewSource
  screenshot_url?: string
  verified?:       boolean
  featured_home?:  boolean
  home_sort_order?: number
  status?:         ReviewStatus
}): Promise<{ data: Review | null; error: string | null }> {
  const { data, error } = await supabaseAdmin
    .from('reviews')
    .insert({
      entity_type:     input.entity_type,
      entity_id:       input.entity_id,
      author_name:     input.author_name,
      author_location: input.author_location || null,
      rating:          input.rating,
      text:            input.text,
      source:          input.source || 'site_form',
      screenshot_url:  input.screenshot_url || null,
      verified:        input.verified ?? false,
      featured_home:   input.featured_home ?? false,
      home_sort_order: input.home_sort_order ?? null,
      status:          input.status || 'pending',
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Review, error: null }
}

// ── Admin: обновява съществуващ отзив (модерация, featured_home, edit) ─────
export async function updateReview(
  id:      string,
  updates: Partial<Omit<Review, 'id' | 'created_at'>>,
): Promise<{ data: Review | null; error: string | null }> {
  const patch: Record<string, unknown> = { ...updates }
  if (updates.status === 'approved' && !updates.approved_at) {
    patch.approved_at = new Date().toISOString()
  }

  const { data, error } = await supabaseAdmin
    .from('reviews')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Review, error: null }
}

// ── Admin: изтрива отзив ────────────────────────────────────────────────────
export async function deleteReview(id: string): Promise<{ error: string | null }> {
  const { error } = await supabaseAdmin.from('reviews').delete().eq('id', id)
  return { error: error?.message || null }
}
