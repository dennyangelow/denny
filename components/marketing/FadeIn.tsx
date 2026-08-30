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

    // Ако елементът вече е в/над видимата зона на екрана в момента, в
    // който JS-ът най-накрая се е хидратирал — потребителят вероятно вече
    // го е видял (или тъкмо го вижда) като статично съдържание. Няма нужда
    // да го крием сега, само за да го "разкрием" веднага след това.
    const rect = el.getBoundingClientRect()
    const alreadyInView = rect.top < window.innerHeight
    if (alreadyInView) return

    // Елементът реално е под текущия скрол — тук вече е безопасно (JS е
    // хидратиран, IntersectionObserver ще реагира мигновено) да включим
    // анимацията "fade up при скрол", както преди.
    setState('pending')
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setState('visible'); observer.disconnect() } },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
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
