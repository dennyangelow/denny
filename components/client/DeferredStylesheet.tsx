// components/client/DeferredStylesheet.tsx — v6
// Сървър компонент (без 'use client'), рендва само <script>.
//
// ⚠️ СМЯНА НА ЦЕЛИЯ ПОДХОД спрямо v2-v5.
//
// v2-v5 чакаха window.load, ПРЕДИ да инжектират <link> през JS
// (document.createElement + appendChild). Идеята беше правилна на
// теория (не се бий за bandwidth с критичните ресурси), но на практика,
// потвърдено с 4 отделни DevTools performance trace-а на реалната
// страница, request-ът към homepage-deferred.css НИКОГА не се появяваше
// в Network таба — дори когато window.load стрелваше навреме (~1-2s).
// Причината остава недиагностицирана отдалечено (вероятно нещо
// специфично за конкретния dev/build setup), но резултатът е ясен:
// подходът е крехък и не си заслужава риска.
//
// v6 — "media=print → media=all" техника (загрявана от Filament Group /
// web.dev "Defer non-critical CSS"): рендваме РЕАЛЕН <link rel="stylesheet">
// В САМИЯ HTML отговор (не през JS по-късно), но с media="print". Браузърът
// сам решава да НЕ го третира като render-blocking за екрана (media
// mismatch → не блокира FCP/LCP — същата PageSpeed печалба като преди),
// НО заявката тръгва веднага щом браузърът стигне до тага при парсване
// на HTML-а — не чака window.load. Щом файлът се свали, onload превключва
// media на "all" и стиловете се прилагат. По-просто, по-стандартно,
// не зависи от JS timing race-ове.
//
// Все още dispatchEvent('dc:deferred-css-loaded') при onload — за
// AnchorScrollFix.tsx (виж там).
//
// Употреба: <DeferredStylesheet href="/css/homepage-deferred.css" />

export function DeferredStylesheet({ href }: { href: string }) {
  const js = `
    (function(){
      if (document.querySelector('link[data-deferred-css="${href}"]')) return;
      function notifyLoaded(){
        try { window.dispatchEvent(new CustomEvent('dc:deferred-css-loaded')); } catch (e) {}
      }
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = '${href}';
      l.media = 'print'; // не блокира render на екрана, но fetch-ва СЕГА, не при window.load
      l.setAttribute('data-deferred-css', '${href}');
      l.onload = function(){ l.media = 'all'; notifyLoaded(); };
      l.onerror = notifyLoaded; // не блокираме fallback логиката, ако файлът гръмне
      document.head.appendChild(l);
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
