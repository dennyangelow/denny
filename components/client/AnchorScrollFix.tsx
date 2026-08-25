// components/client/AnchorScrollFix.tsx — v8 (опростена версия)
// Сървър компонент (без 'use client'), рендва само <script>.
//
// ⚠️ v1-v7 се усложниха твърде много (polling на всеки 100ms, "stability"
// проверки, navToken race-guard...) в опит да покрият всеки ръб на
// проблема. Обратно към основната идея, максимално директно:
//
//   1. Ако е клик върху "#" линк → спри анимациите, скролни веднъж,
//      пусни анимациите обратно.
//   2. Ако страницата се зарежда с #hash в адреса → изчакай
//      homepage-deferred.css РЕАЛНО да се зареди (виж
//      DeferredStylesheet.tsx v6 — dispatchEvent при onload), после
//      направи същото — спри анимациите, скролни веднъж, пусни ги обратно.
//
// Никакъв polling цикъл, никакво "мери докато се стабилизира". Едно
// изчакване (CSS събитие или timeout), едно измерване, един скрол.
//
// ─── ЗАЩО ИЗОБЩО Е НУЖНО (кратко, за контекст) ─────────────────────────
// .section-wrap/.atlas-section-wrap/.ginegar-section/.testimonials-section
// имат content-visibility:auto — докато не са рендвани поне веднъж,
// браузърът им дава фиктивна placeholder височина, така че нативният
// browser scroll до #hash излиза на грешно място. Затова: форсираме
// content-visibility:visible + reflow точно преди да измерим позицията.
// overflow-anchor:none спира браузъра да "компенсира" сам скрола, когато
// layout-ът над viewport-а порасне (щом deferred CSS се приложи).
// transition:none/animation:none спира FadeIn компонента (той чака
// IntersectionObserver, който не гърми докато секцията е content-
// visibility-скрита) да "изскочи" видимо СЛЕД кацането.
//
// href="/#ginegar" и "/#produkti" в HeaderClient.tsx трябва да сочат
// към реално съществуващи id-та в page.tsx (id="ginegar" wrapper,
// id="kategorii") — никаква JS логика не помага, ако елементът просто
// не съществува.

export function AnchorScrollFix() {
  const js = `
    (function(){
      var SKIP_SELECTOR = '.section-wrap,.atlas-section-wrap,.ginegar-section,.testimonials-section';
      var VEIL_MS = 400; // колко дълго държим transitions/animations спрени около скока
      var cancelled = false; // ако потребителят кликне ръчно, отменя чакащата начална корекция

      function forceExpand(){
        var sections = document.querySelectorAll(SKIP_SELECTOR);
        var touched = [];
        for (var i = 0; i < sections.length; i++){
          var el = sections[i];
          if (el.style.contentVisibility !== 'visible'){
            el.style.contentVisibility = 'visible';
            touched.push(el);
          }
        }
        return touched;
      }

      function restoreExpand(touched){
        for (var i = 0; i < touched.length; i++){
          touched[i].style.contentVisibility = '';
        }
      }

      function computeTop(target){
        var header = document.querySelector('.site-header');
        var headerH = header ? header.offsetHeight : 60;
        var rect = target.getBoundingClientRect();
        var top = rect.top + window.pageYOffset - headerH - 12;
        return top < 0 ? 0 : top;
      }

      function raiseVeil(){
        var style = document.createElement('style');
        style.textContent = '*{transition:none!important;animation:none!important;scroll-behavior:auto!important;overflow-anchor:none!important}';
        document.head.appendChild(style);
        return function lowerVeil(){
          if (style.parentNode) style.parentNode.removeChild(style);
        };
      }

      // Едно измерване, един скрол. Спира анимациите → форсира реалните
      // височини → скролва → връща всичко след VEIL_MS.
      function scrollToHash(hash){
        var target = document.getElementById(hash);
        if (!target) return;
        var lowerVeil = raiseVeil();
        var touched = forceExpand();
        void document.body.offsetHeight; // форсиран reflow
        window.scrollTo({ top: computeTop(target), behavior: 'auto' });
        setTimeout(function(){
          restoreExpand(touched);
          lowerVeil();
        }, VEIL_MS);
      }

      function isSamePageHashLink(a){
        try {
          var url = new URL(a.href, location.href);
          return url.pathname === location.pathname && url.search === location.search && !!url.hash;
        } catch (e) {
          return false;
        }
      }

      document.addEventListener('click', function(e){
        var a = e.target && e.target.closest ? e.target.closest('a[href*="#"]') : null;
        if (!a || !isSamePageHashLink(a)) return;
        var hash = decodeURIComponent(new URL(a.href, location.href).hash.slice(1));
        if (!hash || !document.getElementById(hash)) return;
        e.preventDefault();
        cancelled = true; // спира чакащата начална корекция по-долу, ако има такава
        if (history.pushState) history.pushState(null, '', '#' + hash);
        scrollToHash(hash);
      }, false);

      // Начален deep-link (/#faq в нов таб / F5): изчакай deferred CSS-ът
      // РЕАЛНО да се приложи, после скролни веднъж. HARD_TIMEOUT_MS е
      // само предпазен fallback, ако събитието по някаква причина не
      // гръмне (счупен файл, adblock) — не е основният път.
      if (location.hash) {
        var initialHash = decodeURIComponent(location.hash.slice(1));
        var HARD_TIMEOUT_MS = 12000;
        var done = false;

        function runInitial(){
          if (done || cancelled) return;
          done = true;
          // Двоен requestAnimationFrame: 'onload' на <link> значи файлът
          // е свален, не непременно, че браузърът вече е преизчислил
          // layout-а с новите стилове (може да се случи на следващия
          // рендер кадър). Без това рискуваме да измерим "стари"
          // (все още без padding) стойности.
          requestAnimationFrame(function(){
            requestAnimationFrame(function(){
              if (!cancelled) scrollToHash(initialHash);
            });
          });
        }

        window.addEventListener('dc:deferred-css-loaded', runInitial, { once: true });
        setTimeout(runInitial, HARD_TIMEOUT_MS);
      }
    })();
  `

  return <script dangerouslySetInnerHTML={{ __html: js }} />
}
