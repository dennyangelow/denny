'use client'
// components/marketing/FadeIn.tsx — v2
// ⚠️ ФИКС (Chrome Performance trace, Slow 4G): старата версия имаше
// `useState(false)` по подразбиране → секцията излиза с opacity:0 ДИРЕКТНО
// в HTML-а от сървъра, и остава невидима, докато useEffect-ът по-долу не се
// изпълни. Но useEffect никога не тръгва преди React hydration — а
// hydration чака целия JS бъндъл (main-app.js + app/page.js) да пристигне
// и да се изпълни. На бавна мрежа трейсът показа window.onload на 12s —
// значи ВСИЧКО под сгъва (продукти, отзиви, FAQ, категории — навсякъде,
// където се ползва FadeIn) е стояло невидимо цели 12 секунди, докато
// текстът реално вече е бил в DOM-а. Оттам усещането "надолу всичко
// излиза много забавено" — не е забавено зареждане на данните, а
// невидимо съдържание, чакащо JS.
//
// Нов подход — content-ът е ВИДИМ ПО ПОДРАЗБИРАНЕ, анимацията е чист
// progressive enhancement:
//   - Сървърът и първият клиентски рендър винаги показват opacity:1 —
//     ако JS изобщо не пристигне/закъснее, потребителят просто вижда
//     статично съдържание, никога празно място.
//   - Едва в useEffect (след hydration) проверяваме дали елементът В
//     МОМЕНТА е под видимата част на екрана. Ако вече е видим/подминат —
//     оставяме го както си е (opacity:1), без анимация — няма смисъл да
//     скриваме нещо, което потребителят вече е видял.
//   - Само ако елементът РЕАЛНО е под фолда в момента на hydration, го
//     скриваме и включваме IntersectionObserver — тогава анимацията играе
//     нормално при скрол, точно както преди, но никога не блокира
//     видимостта на съдържанието само защото JS закъснява.

import { useEffect, useRef, useState } from 'react'

interface Props {
  children: React.ReactNode
  delay?: number
  className?: string
  style?: React.CSSProperties
}

export function FadeIn({ children, delay = 0, className, style }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  // 'visible' по подразбиране — HTML/CSS сами по себе си вече показват
  // готовото съдържание, без да чакат JS.
  const [state, setState] = useState<'visible' | 'pending'>('visible')

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // ✅ ФИКС (Lighthouse "Forced reflow" — потвърдено от PageSpeed 595ms
    // total reflow time): el.getBoundingClientRect() тук се изпълняваше
    // СИНХРОННО, веднага при hydration, за ВСЯКА FadeIn инстанция на
    // страницата (продукти, отзиви, FAQ, блог — обикновено 20-30+ броя).
    // React хидратира всички тия компоненти почти едновременно; ако между
    // кои да е два getBoundingClientRect() извиквания има pending style
    // промяна от друг компонент, браузърът е принуден да flush-не layout-а
    // синхронно — read/write interleaving между много инстанции = класически
    // "layout thrashing". requestAnimationFrame отлага четенето до момента,
    // в който браузърът вече Е ЗАВЪРШИЛ естествения си layout pass за тоя
    // кадър — четенето вече не e "forced", а обикновено. Функционално нищо
    // не се променя (все така инстанции, вече видими на екрана, не играят
    // fade анимация), само моментът на проверката се мести с 1 кадър.
    let cancelled = false
    let observer: IntersectionObserver | null = null
    const raf = requestAnimationFrame(() => {
      if (cancelled) return
      const rect = el.getBoundingClientRect()
      const alreadyInView = rect.top < window.innerHeight
      if (alreadyInView) return

      setState('pending')
      observer = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) { setState('visible'); observer?.disconnect() } },
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
      )
      observer.observe(el)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      observer?.disconnect()
    }
  }, [])

  const hidden = state === 'pending'

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity:    hidden ? 0 : 1,
        transform:  hidden ? 'translateY(22px)' : 'translateY(0)',
        transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
