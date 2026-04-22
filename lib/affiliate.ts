// lib/affiliate.ts — v2
// ✅ ПОПРАВКИ спрямо v1:
//   - Добавено quarantine_note (нова колона в БД)
//   - rating: number | string (Supabase връща numeric като string!)
//   - Добавен helper getRating() в края

export interface DoseRow {
  phase:    string
  dose:     string
  interval: string
}

export interface VsRow {
  feature: string
  ours:    string
  theirs:  string
}

export interface VsCompetitor {
  competitor: string
  vs:         VsRow[]
}

export interface FaqItem {
  q: string
  a: string
}

export interface AffiliateProduct {
  id:              string
  slug:            string
  name:            string
  subtitle?:       string
  badge_text?:     string
  tag_text?:       string
  description?:    string
  full_content?:   string
  features?:       string[]
  bullets?:        string[]
  image_url?:      string
  image_alt?:      string
  emoji?:          string
  color?:          string
  badge_color?:    string
  category_label?: string
  affiliate_url:   string
  partner:         string
  section?:        string
  active:          boolean
  sort_order?:     number
  // SEO
  seo_title?:       string
  seo_description?: string
  seo_keywords?:    string
  // Технически данни
  price?:            number | string  // numeric от Supabase може да е string
  price_currency?:   string
  volume?:           string
  active_substance?: string
  quarantine_days?:  number
  quarantine_note?:  string           // ✅ НОВА КОЛОНА
  dosage?:           string
  crops?:            string[]
  warnings?:         string[]
  season?:           string
  social_proof?:     string
  youtube_url?:      string
  // JSON полета
  faq?:           FaqItem[]
  dose_table?:    DoseRow[]
  vs_competitor?: VsCompetitor
  // Как се използва — string от JSON array
  how_to_use?:   string   // "[\"стъпка 1\", \"стъпка 2\"]"
  combine_with?: string   // "slug1,slug2,slug3"
  // Рейтинг — numeric в Supabase се връща като string!
  rating?:       number | string
  review_count?: number
  date_published?: string
  // timestamps
  created_at?: string
  updated_at?: string
}

// ── Helper: безопасно конвертира rating към number ─────────────────────────
export function getRating(product: AffiliateProduct): number {
  const r = Number(product.rating)
  return isNaN(r) || r <= 0 ? 4.9 : r
}
