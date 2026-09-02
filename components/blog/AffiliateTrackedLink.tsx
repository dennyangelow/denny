'use client'
// components/blog/AffiliateTrackedLink.tsx — v2
// ✅ ФИКС спрямо v1: href тук е ВИНАГИ вътрешна страница на самия сайт —
//    /produkt/[slug] (affiliate) или /products/[slug] (own) — bridge/landing
//    страница с описание, снимки, ревюта. Реалният external линк към
//    мърчанта (AgroApteki и т.н.) е СЪВСЕМ отделен механизъм: бутон
//    "Купи", който отваря product.affiliate_url през window.open() в
//    handleBuy() (виж AffiliateProduktClient.tsx) — не е <a href> изобщо,
//    значи Google дори не го вижда като линк и не се нуждае от rel=nofollow.
//
//    Преди v1 слагаше rel="sponsored nofollow" + target="_blank" и на тази
//    ВЪТРЕШНА навигация, все едно е директен external линк — това казваше
//    на Google "не давай SEO тежест на тази собствена страница от сайта",
//    режейки вътрешната linking структура без причина. Сега линкът е
//    обикновен вътрешен линк (follow, в същия таб) — точно като всеки
//    друг линк в статията. Click tracking-ът за affiliate product embed-и
//    е запазен, само вече е чисто за аналитика, не влияе на rel/target.
interface Props {
  href: string
  slug: string
  /** true = продуктът идва от affiliate таблицата → трекваме клика за
   *  аналитика. НЕ означава rel=nofollow — href винаги е вътрешна страница. */
  sponsored: boolean
  children: React.ReactNode
  className?: string
}

function trackAffiliateClick(slug: string) {
  try {
    fetch('/api/affiliate-clicks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ slug, source: 'blog' }),
    }).catch(() => {})
  } catch {
    /* noop */
  }
}

export function AffiliateTrackedLink({ href, slug, sponsored, children, className }: Props) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => sponsored && trackAffiliateClick(slug)}
    >
      {children}
    </a>
  )
}
