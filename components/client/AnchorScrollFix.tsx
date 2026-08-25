// components/client/AnchorScrollFix.tsx — v6
// Сървър компонент (без 'use client'), рендва само <script> — не чака
// React hydration, работи дори ако hydration-ът другаде гръмне.
//
// ─── ИСТОРИЯ НА ПРОБЛЕМИТЕ (за поддръжка, за да не се преоткрива колелото) ──
//
// Проблем №1 (решен): #atlas/#ginegar/#testimonials/#faq скролваха на
// грешно място, защото .section-wrap/.atlas-section-wrap/.ginegar-section/
// .testimonials-section имат в homepage.css:
//   content-visibility:auto; contain-intrinsic-size:0 700px;
// Докато секция не е рендната поне веднъж, браузърът ѝ дава ФИКТИВНА
// височина от 700px — реалната е различна (900-1300px+). Скролът се
// изчислява спрямо тази грешна височина → underscoot.
// Фикс: форсираме content-visibility:visible + reflow ПРЕДИ да мерим
// позицията на целта (виж forceExpand/goToHash по-долу).
//
// Проблем №2 (решен, отделен бъг, не JS): href="/#ginegar" и
// href="/#produkti" в HeaderClient.tsx сочеха към ID-та, които изобщо
// НЕ съществуваха в HTML-а — Ginegar секциите взимат id={sec.slug} от
// базата (никога буквално "ginegar"), а "категории" секцията е с
// id="kategorii", не "produkti". Никаква JS корекция не помага, ако
// елементът просто не съществува. Фикс: добавен е обвиващ
// <div id="ginegar"> около целия map() в page.tsx, и hrefs в
// HeaderClient.tsx са сменени на реалните ID-та.
//
// Проблем №3 (решен): "бутонът се появява и всичко мърда надолу" СЛЕД
// кацането — <FadeIn> чака IntersectionObserver, който не гърми докато
// content-visibility:auto държи секцията нерендната. Форсирайки я видима
// и телепортирайки директно там, IntersectionObserver гърми ЗА ПЪРВИ ПЪТ
// точно след кацането → анимацията играе "на живо". Фикс: временно
// спираме всички CSS transitions/animations (виж raiseVeil) докато трае
// корекцията.
//
// Проблем №4 (този файл, v4): при F5 на /#faq понякога скролваше на
// грешно място и СПИРАШЕ ТАМ — "изобщо не изчаква CSS да зареди". Причина:
// предишният polling слагаше край веднага щом две поредни измервания
// съвпаднат — но между два тика (100ms) няма промяна и когато CSS
// ПРОСТО ОЩЕ НЕ Е ПОИСКАН (DeferredStylesheet го иска чак на window.load,
// доста след като този скрипт стартира), не само когато вече е приложен.
// "Нищо не мърда" ≠ "готово", ако причината е, че движещата сила
// (deferred CSS) още не е стартирала. Фикс: изчакваме конкретното
// събитие 'dc:deferred-css-loaded' от DeferredStylesheet.tsx (v4) —
// то гърми точно когато CSS файлът РЕАЛНО се е приложил — и чак ТОГАВА
// започваме да мерим/коригираме позицията (виж stableScrollTo).
//
// Проблем №5 (този файл, v5): на бавен интернет (Slow 4G, потвърдено с
// реален DevTools performance trace) корекцията изобщо не изчакваше
// CSS-а — 3-секундният HARD_TIMEOUT_MS fallback гърмеше ПРЕДИ window.load
// (което само по себе си отнема ~6.8s на Slow 4G), т.е. преди
// homepage-deferred.css изобщо да е бил поискан. Fallback-ът заключваше
// started=true и реалният 'dc:deferred-css-loaded' сигнал, когато най-сетне
// пристигнеше секунди по-късно, вече биваше игнориран. Фикс: fallback
// вдигнат на 12000ms — вече е истинска "последна издръжка" (счупен файл,
// adblock), не конкурент на нормалното бавно мрежово зареждане.
//
// Проблем №6 (този файл, v6): DeferredStylesheet мина на media=print→all
// техника (виж там v6) — вече CSS-ът реално се сваля и прилага. НО се
// появи нов ефект: "намира секцията правилно, после CSS-ът се зарежда и
// я избутва, не остава на върха". Две отделни причини:
//   (а) Браузърът има вградено "scroll anchoring" поведение — когато
//   layout-ът НАД viewport-а се промени (точно това правят padding-ите
//   на секциите, щом deferred CSS се приложи), браузърът САМ мести
//   скрола да "компенсира". Това е ВТОРИ, неконтролиран скок, отделен
//   от нашата собствена корекция. Фикс: overflow-anchor:none в raiseVeil.
//   (б) 'onload' на <link> означава файлът е свален, не непременно, че
//   браузърът вече е преизчислил layout-а с новите стилове — style
//   recalc/layout могат да се случат асинхронно, на следващия кадър.
//   Ако измерим позицията веднага, рискуваме да хванем "стари" (все
//   още без padding) стойности. Фикс: двоен requestAnimationFrame преди
//   първото измерване след 'dc:deferred-css-loaded'.

export function AnchorScrollFix() {
  const js = `
    (function(){
      var SKIP_SELECTOR = '.section-wrap,.atlas-section-wrap,.ginegar-section,.testimonials-section';
      var VEIL_MS = 450; // колко дълго държим transitions/animations спрени около скока

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

      // Временно спира всички CSS transitions/animations/scroll-behavior,
      // за да не се виждат "изскачащи" FadeIn ефекти по време на
      // програмния скрол. Премахва се сама след VEIL_MS.
      // ⚠️ v6: добавен overflow-anchor:none — браузърът има вградено
      // "scroll anchoring" поведение, което САМ мести скрола, когато
      // layout-ът над viewport-а се промени (точно каквото се случва
      // когато homepage-deferred.css се приложи и padding-ите на
      // секциите ПРЕДИ целта пораснат от 0 на реалните им стойности).
      // Това създаваше ВТОРИ, неконтролиран скок — отделен от нашата
      // собствена корекция — точно "избутва я и не застава на върха".
      // overflow-anchor:none изключва това нативно поведение, докато
      // веилът е вдигнат, оставяйки само нашата изчислена корекция да
      // мести скрола.
      function raiseVeil(){
        var style = document.createElement('style');
        style.setAttribute('data-anchor-scroll-fix-veil', '1');
        style.textContent = '*{transition:none!important;animation:none!important;scroll-behavior:auto!important;overflow-anchor:none!important}';
        document.head.appendChild(style);
        return function lowerVeil(){
          if (style.parentNode) style.parentNode.removeChild(style);
        };
      }

      // Скролва веднъж до текущо изчислената позиция на hash-а. Не е
      // "умен" сам по себе си — виж stableScrollTo по-долу за версията,
      // която се самокоригира докато layout-ът е нестабилен (шрифтове/
      // deferred CSS/картинки все още зареждат).
      function snapTo(hash){
        var target = document.getElementById(hash);
        if (!target) return false;
        var touched = forceExpand();
        void document.body.offsetHeight; // форсиран reflow
        var top = computeTop(target);
        window.scrollTo({ top: top, behavior: 'auto' });
        setTimeout(function(){ restoreExpand(touched); }, VEIL_MS + 50);
        return true;
      }

      // Използва се при клик върху "#" линк — страницата вече е напълно
      // заредена по това време, така че една коректна итерация стига.
      function goToHashOnClick(hash){
        var lowerVeil = raiseVeil();
        var ok = snapTo(hash);
        setTimeout(lowerVeil, VEIL_MS);
        return ok;
      }

      // Използва се при директен deep-link (/#ginegar в нов таб / F5).
      // ⚠️ v4: НЕ разчитаме само на "две поредни измервания съвпадат"
      // като сигнал за "готово" — това лъжеше, защото между два тика
      // (100ms) няма промяна и когато CSS файлът ПРОСТО ОЩЕ НЕ Е ПОИСКАН
      // (DeferredStylesheet го иска чак на window.load), не само когато
      // вече е приложен. "Нищо не мърда" ≠ "готово", ако причината е, че
      // движещата сила (deferred CSS) още не е стартирала изобщо.
      //
      // Сега: изчакваме конкретното събитие 'dc:deferred-css-loaded' от
      // DeferredStylesheet.tsx (v4) — то гърми точно когато
      // homepage-deferred.css РЕАЛНО се е приложил. Чак ТОГАВА почваме
      // да мерим/скролваме.
      //
      // ⚠️ v5: HARD_TIMEOUT_MS беше 3000ms — на бавна връзка (Slow 4G,
      // видяно в реален DevTools trace) самото window.load отнема ~6.8s,
      // значи homepage-deferred.css изобщо ОЩЕ НЕ Е ПОИСКАН на 3-тата
      // секунда. Fallback-ът гърмеше пръв, слагаше started=true, и
      // реалният сигнал (когато CSS-ът най-накрая се зареди секунди
      // по-късно) вече се игнорираше — 'begin' никога не се пускаше
      // втори път. Резултат: на бавен интернет корекцията изобщо не
      // изчакваше CSS-а. Вдигнат на 12000ms — вече е истински "последна
      // издръжка" fallback (счупен файл, adblock), не конкурент на
      // нормалното бавно зареждане.
      function stableScrollTo(hash){
        var lowerVeil = raiseVeil();
        var allTouched = [];
        var started = false;
        var HARD_TIMEOUT_MS = 12000;

        function begin(){
          if (started) return;
          started = true;
          var lastTop = null;
          var attempts = 0;
          var STABLE_READS_NEEDED = 2; // поредни съвпадащи измервания
          var stableCount = 0;
          var MAX_ATTEMPTS = 15; // ~1.5s допълнително след старта, за шрифтове/картинки

          function tick(){
            attempts++;
            var target = document.getElementById(hash);
            if (!target){
              if (attempts < MAX_ATTEMPTS) { setTimeout(tick, 100); return; }
              finish();
              return;
            }
            var touched = forceExpand();
            void document.body.offsetHeight;
            var top = computeTop(target);
            window.scrollTo({ top: top, behavior: 'auto' });
            allTouched = allTouched.concat(touched);

            if (lastTop !== null && Math.abs(top - lastTop) < 2) {
              stableCount++;
            } else {
              stableCount = 0;
            }
            lastTop = top;

            if (stableCount >= STABLE_READS_NEEDED || attempts >= MAX_ATTEMPTS){
              finish();
              return;
            }
            setTimeout(tick, 100);
          }

          function finish(){
            setTimeout(function(){ restoreExpand(allTouched); }, VEIL_MS + 50);
            setTimeout(lowerVeil, VEIL_MS);
          }

          // ⚠️ v6: не викаме tick() веднага при 'begin' — 'onload' на
          // <link> значи файлът е СВАЛЕН, не непременно, че браузърът
          // вече е преизчислил layout-а с новите стилове (style recalc/
          // layout могат да се случат асинхронно, на следващия рендер
          // кадър). Двоен requestAnimationFrame гарантира, че поне един
          // пълен layout/paint цикъл с новите стилове е минал, преди да
          // мерим позицията — иначе първото измерване рискува да хване
          // "стари" (все още без padding) стойности.
          requestAnimationFrame(function(){
            requestAnimationFrame(function(){
              tick();
            });
          });
        }

        window.addEventListener('dc:deferred-css-loaded', begin, { once: true });
        setTimeout(begin, HARD_TIMEOUT_MS); // fallback, ако събитието не гръмне
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
        if (history.pushState) history.pushState(null, '', '#' + hash);
        goToHashOnClick(hash);
      }, false);

      // Директен deep-link при начално зареждане на страницата.
      if (location.hash) {
        var initialHash = decodeURIComponent(location.hash.slice(1));
        stableScrollTo(initialHash);
      }
    })();
  `

  return <script dangerouslySetInnerHTML={{ __html: js }} />
}
