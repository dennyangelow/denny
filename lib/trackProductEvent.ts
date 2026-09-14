// lib/trackProductEvent.ts
// Проследява funnel събития за СОБСТВЕНИ продукти (Atlas Terra), паралелно
// на trackAffiliateClick.ts (който е само за affiliate продукти).
// Ползва същия visitor_id, който PageViewTracker.tsx вече пази в
// localStorage ('da_vid') — така по-късно можем да JOIN-нем event-и към
// посещения по един и същ човек, не само по агрегирани дневни бройки.

export type ProductEventType = 'add_to_cart' | 'checkout_started'

const VISITOR_KEY = 'da_vid'

function getVisitorId(): string | undefined {
  try {
    return localStorage.getItem(VISITOR_KEY) || undefined
  } catch {
    return undefined
  }
}

export async function trackProductEvent(
  eventType: ProductEventType,
  productSlug: string,
): Promise<void> {
  try {
    await fetch('/api/analytics/product-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        event_type:   eventType,
        product_slug: productSlug,
        visitor_id:   getVisitorId(),
      }),
    })
  } catch {
    // Никога не блокираме потребителя заради tracking грешка
  }
}
