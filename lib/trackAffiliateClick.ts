// lib/trackAffiliateClick.ts
// Извиква се на ВСЕКИ клик върху афилиейт линк — от Client Components

export async function trackAffiliateClick(
  partner: string,
  productSlug: string,
): Promise<void> {
  try {
    await fetch('/api/analytics/affiliate-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // keepalive = изпраща дори ако страницата navigates away веднага
      keepalive: true,
      body: JSON.stringify({ partner, product_slug: productSlug }),
    })
  } catch {
    // Никога не блокираме потребителя заради tracking грешка
  }
}
