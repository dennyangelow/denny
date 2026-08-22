// components/client/DeferredStylesheet.tsx — v2
// ⚠️ ПРОМЯНА спрямо v1: вече НЕ е 'use client' компонент с useEffect.
//
// Проблем с v1: <link> се добавяше едва след успешна React hydration
// (useEffect). Ако КАКВОТО И ДА Е друго нещо на страницата хвърли
// hydration грешка, React може да спре hydration-а на цялото поддърво
// под него — и useEffect-ът там просто никога не се изпълнява. Резултат:
// секциите под fold-а остават ТРАЙНО без CSS, не само за кратко.
//
// Решение в v2: обикновен server component, който рендва инлайн <script>.
// Скриптът се изпълнява веднага щом браузърът стигне до него при
// парсване на HTML-а — не чака JS бъндъла, не чака hydration, работи
// дори ако React изобщо не hydrate-не тази част от дървото.
// Добавен е и <noscript> fallback за browsers без JS / странни crawler-и.
//
// Употреба (в page.tsx, все едно къде в JSX-а — рендва само <script>/<noscript>):
//   <DeferredStylesheet href="/css/homepage-deferred.css" />
//
// Файлът трябва да е в /public/css/<име>.css, за да е достъпен точно на
// този href (Next.js сервира /public/* от root).

export function DeferredStylesheet({ href }: { href: string }) {
  // ✅ ФИКС v3: чакаме window 'load' вместо да инжектираме <link> веднага.
  //    Преди: скриптът се изпълняваше в мига, в който парсерът стигне до него
  //    (той е близо до върха на <body>) — това стартираше fetch на
  //    homepage-deferred.css В СЪЩИЯ МОМЕНТ като критичния homepage.css и
  //    next/font CSS-а/woff2, и трите се биеха за bandwidth на throttled
  //    мобилна връзка (виж PageSpeed "Render-blocking requests" / "Network
  //    dependency tree" — homepage-deferred.css отнемаше 600-1000ms+ само
  //    защото делеше честотната лента с критичните ресурси).
  //    Сега: чакаме документа + всички критични ресурси (CSS, шрифтове,
  //    LCP картинка) да приключат зареждане (window.load), и чак тогава
  //    искаме deferred CSS-а. Това освобождава пълния bandwidth за
  //    критичния render path и реално прави файла "deferred".
  const js = `
    (function(){
      function loadDeferredCss(){
        if (document.querySelector('link[data-deferred-css="${href}"]')) return;
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = '${href}';
        l.setAttribute('data-deferred-css', '${href}');
        document.head.appendChild(l);
      }
      if (document.readyState === 'complete') {
        loadDeferredCss();
      } else {
        window.addEventListener('load', loadDeferredCss, { once: true });
      }
    })();
  `

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: js }} />
      <noscript>
        <link rel="stylesheet" href={href} />
      </noscript>
    </>
  )
}
