// lib/trackAffiliateClick.ts
// Извиква се на ВСЕКИ клик върху афилиейт линк — от Client Components

export async function trackAffiliateClick(
  partner: string,
  productSlug: string,
  // ✅ НОВО — откъде е кликнато (напр. 'blog', 'produkt-page'). По избор,
  //    за да не чупи стари извиквания без трети аргумент. Позволява
  //    разграничаване в статистиката без да жертваме реалния partner
  //    (виж GET в app/api/analytics/affiliate-click/route.ts → bySource).
  source?: string,
): Promise<void> {
  try {
    await fetch('/api/analytics/affiliate-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // keepalive = изпраща дори ако страницата navigates away веднага
      keepalive: true,
      body: JSON.stringify({ partner, product_slug: productSlug, source }),
    })
  } catch {
    // Никога не блокираме потребителя заради tracking грешка
  }
}
