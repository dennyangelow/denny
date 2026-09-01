// components/DeferredHomepageCSS.tsx — v2
// ✅ ПОПРАВКА спрямо v1: добавен suppressHydrationWarning на обвиващия div.
//    Ако /css/homepage-deferred.css се зареди много бързо (кеш, бърза мрежа),
//    onload="this.media='all'" може да смени media атрибута ПРЕДИ React да
//    завърши hydration-а. Тогава React сравнява server HTML-а (media="print")
//    с реалния DOM (media="all", вече сменен от браузъра) → "Prop
//    dangerouslySetInnerHTML did not match". Функционално нищо не е счупено
//    (CSS-ът се прилага правилно и в двата случая) — това само маха шумното
//    предупреждение в конзолата. Същият патърн вече се ползва в
//    SiteHeader.tsx/SiteFooter.tsx за идентични hydration edge cases.
export function DeferredHomepageCSS() {
  return (
    <>
      <div
        suppressHydrationWarning
        style={{ display: 'contents' }}
        dangerouslySetInnerHTML={{
          __html:
            `<link rel="stylesheet" href="/css/homepage-deferred.css" media="print" onload="this.media='all'" />`,
        }}
      />
      <noscript>
        <link rel="stylesheet" href="/css/homepage-deferred.css" />
      </noscript>
    </>
  )
}
