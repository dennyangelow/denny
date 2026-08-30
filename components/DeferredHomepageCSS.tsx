// components/DeferredHomepageCSS.tsx — SERVER COMPONENT
// Зарежда homepage-deferred.css (всичко под сгъва: trust strip, категории,
// продуктови карти, Atlas Terra, Ginegar, отзиви, FAQ, footer, cart drawer,
// naruchnik стилове и т.н. — реда 277–1197 от старото homepage.css)
// АСИНХРОННО, без да блокира първия рендър на страницата.
//
// Техника (media swap): <link media="print"> кара браузъра да НЕ
// render-block-ва first paint заради този стил (защото не е "screen"
// media), но пак го тегли на заден план. `onload="this.media='all'"`
// превключва media обратно към 'all' веднага щом файлът пристигне, и
// стиловете се прилагат — обикновено доста преди потребителят да е
// скролнал до тези секции. <noscript> е fallback за хора без JS.
//
// Рендерирано през dangerouslySetInnerHTML нарочно: React-ovият onLoad
// prop очаква JS функция (за synthetic events), а тук ни трябва истинският
// HTML атрибут onload="…", затова тагът се инжектира като суров HTML.
// display:'contents' на обвивката гарантира, че тя самата не влияе на
// layout-а (не added никакъв кутия в DOM flow-а).
export function DeferredHomepageCSS() {
  return (
    <>
      <div
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
