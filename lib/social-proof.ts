// lib/social-proof.ts — v1
// ✅ НОВ файл. Реален "на живо" feed за HandbooksPanel.tsx — заменя
//    randomDownloads()/SOCIAL_NAMES фалшивата логика, която генерираше
//    произволно число (10-49) и произволно избрано име от твърд списък.
//
// Два реални източника:
//   1) leads — кой е изтеглил кой наръчник (l.name, l.naruchnik_slug/
//      l.naruchnici, l.downloaded_at)
//   2) orders — кой е купил СОБСТВЕН продукт (Atlas Terra). Affiliate
//      поръчките (AgroApteki) НЕ участват тук — те се случват изцяло на
//      чужд сайт, никакви данни не се връщат към нас, значи е невъзможно
//      честно да твърдим "X купиха" за affiliate продукт.
//
// Показваме само ПЪРВОТО име (firstNameOf) — GDPR-съобразно: публично
// показване на нечие пълно име в маркетингов ticker без изрично съгласие
// е сива зона. Ако по-късно добавите opt-in чекбокс на формата, лесно се
// сменя тук на пълно име за съгласилите се.

import { supabaseAdmin } from '@/lib/supabase'

export interface ActivityEvent {
  type:      'download' | 'order'
  firstName: string
  label:     string   // напр. "наръчника за домати" или "Atlas Terra AMINO"
  timestamp: string
}

function firstNameOf(fullName?: string | null): string | null {
  if (!fullName) return null
  const trimmed = fullName.trim()
  if (!trimmed) return null
  return trimmed.split(/\s+/)[0]
}

// ✅ Slug → четимо име за ticker-а. Потвърдени реални slug-ове от
//    naruchnici_rows.sql export-а — 'krastavici-visoki-dobivy' беше грешно
//    предположение (взето от SLUG_EMOJI в LeadsTab.tsx, който само прави
//    partial match по 'krastavic', не точен slug) — реалният slug е
//    'krastavici-naruchnik'. Добавяй нов ред тук при нов наръчник —
//    иначе fallback-ва на generic "наръчник", което е грозно, но никога
//    не гърми рендъра.
const HANDBOOK_LABELS: Record<string, string> = {
  'super-domati':          'наръчника за едри домати',
  'krastavici-naruchnik':  'наръчника за краставици',
}
function handbookLabel(slug: string): string {
  return HANDBOOK_LABELS[slug] || 'наръчник'
}

function slugsOf(row: { naruchnik_slug?: string | null; naruchnici?: string[] | null }): string[] {
  if (row.naruchnici && row.naruchnici.length > 0) return row.naruchnici
  return row.naruchnik_slug ? [row.naruchnik_slug] : []
}

/**
 * Последните N реални събития (изтегляния + поръчки), смесени и
 * сортирани по време — за "🎉 [Име] току-що..." live ticker-а.
 */
export async function getRecentActivity(limit = 12): Promise<ActivityEvent[]> {
  const [{ data: leadsData, error: leadsErr }, { data: ordersData, error: ordersErr }] = await Promise.all([
    supabaseAdmin
      .from('leads')
      .select('name, naruchnik_slug, naruchnici, downloaded_at, created_at')
      .not('name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(40),
    // ✅ Само 'confirmed'/'shipped'/'delivered' се броят за реална продажба —
    //    'new' може да е недовършена/непотвърдена поръчка (плащане с
    //    наложен платеж = payment_status остава 'pending' до доставка, така
    //    че payment_status='paid' би изключил повечето легитимни поръчки).
    //    'cancelled' изрично изключена.
    supabaseAdmin
      .from('orders')
      .select('customer_name, created_at, status, order_items(product_name)')
      .in('status', ['confirmed', 'shipped', 'delivered'])
      .order('created_at', { ascending: false })
      .limit(40),
  ])

  if (leadsErr)  console.error('[social-proof] leads:', leadsErr.message)
  if (ordersErr) console.error('[social-proof] orders:', ordersErr.message)

  const downloadEvents: ActivityEvent[] = (leadsData || []).flatMap((l: any) => {
    const name = firstNameOf(l.name)
    const slugs = slugsOf(l)
    if (!name || slugs.length === 0) return []
    return [{
      type:      'download' as const,
      firstName: name,
      label:     handbookLabel(slugs[0]),
      timestamp: l.downloaded_at || l.created_at,
    }]
  })

  const orderEvents: ActivityEvent[] = (ordersData || []).flatMap((o: any) => {
    const name        = firstNameOf(o.customer_name)
    const fullProduct = o.order_items?.[0]?.product_name
    if (!name || !fullProduct) return []
    // ✅ Кратко име — "Atlas Terra AMINO — Аминокиселини за..." → "Atlas
    //    Terra AMINO". Същият патърн като shortName в BlogPostBody.tsx
    //    ProductEmbed — пълното име прелива popup-а в HandbooksPanel.tsx
    //    (fixed-height кутия, строена за кратко "наръчник" текстче).
    const productName = String(fullProduct).split(' — ')[0].trim()
    return [{
      type:      'order' as const,
      firstName: name,
      label:     productName,
      timestamp: o.created_at,
    }]
  })

  return [...downloadEvents, ...orderEvents]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit)
}

/**
 * Реален брой изтегляния по naruchnik slug — от leads таблицата, не от
 * naruchnici.downloads_count (потвърдено фиктивно, статично число) нито
 * naruchnici.downloads (непълен/скоро рестартиран брояч, много под
 * реалните лийдове). Идентична логика на slugCounts в LeadsTab.tsx —
 * това е числото, което вече виждаш в Email листа → Аналитики, и е
 * единственият източник, който не може да бъде ръчно подправен.
 *
 * ✅ ФИКС: преди беше един .select() без .range()/.limit() — Supabase/
 *    PostgREST има подразбиращ се таван от 1000 реда на заявка (max-rows),
 *    който мълчаливо отрязва резултата, без грешка. При 2554 реда в
 *    leads това връщаше само първите ~1000, откъдето и разминаването на
 *    живо (885/496 вместо реалните 2243/1331 — потвърдени 1:1 срещу SQL
 *    експорта). Сега страницира на батчове от 1000, докато не свършат
 *    редовете — LeadsTab.tsx явно вече го прави правилно през /api/leads
 *    пагинацията, затова там числата бяха верни от самото начало.
 */
export async function getHandbookDownloadCounts(): Promise<Record<string, number>> {
  try {
    const counts: Record<string, number> = {}
    const BATCH = 1000
    let from = 0

    while (true) {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .select('naruchnik_slug, naruchnici')
        .range(from, from + BATCH - 1)
      if (error) throw error

      ;(data || []).forEach((l: any) => {
        slugsOf(l).forEach(s => { counts[s] = (counts[s] || 0) + 1 })
      })

      if (!data || data.length < BATCH) break
      from += BATCH
    }

    return counts
  } catch (err) {
    console.error('[social-proof] getHandbookDownloadCounts:', err)
    return {}
  }
}
