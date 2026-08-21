'use client'
// components/client/DeferredStylesheet.tsx
//
// Зарежда CSS файл СЛЕД първия render, вместо чрез import '...css' в
// server component (което Next.js вкарва като render-blocking <link> в
// <head> и точно то вдига FCP/LCP — виж PageSpeed "Render-blocking
// requests"). Тук стилът се добавя динамично в браузъра, така че
// парсването/рисуването на страницата не го чака.
//
// Употреба (в page.tsx, вътре в <> фрагмента, все едно къде — не рендва нищо):
//   <DeferredStylesheet href="/css/homepage-deferred.css" />
//
// Файлът трябва да е в /public/css/homepage-deferred.css, за да е достъпен
// точно на този href (Next.js сервира /public/* от root).

import { useEffect } from 'react'

export function DeferredStylesheet({ href }: { href: string }) {
  useEffect(() => {
    if (document.querySelector(`link[data-deferred-css="${href}"]`)) return

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.setAttribute('data-deferred-css', href)
    document.head.appendChild(link)

    // По желание: ако искаш стиловете да се вкарат още по-рано (веднага
    // след първия paint, вместо да чакат пълна hydration на клиентските
    // компоненти по-надолу в дървото), премести <DeferredStylesheet/> да е
    // първият елемент в JSX-а на page.tsx — React hydrate-ва отгоре-надолу.
  }, [href])

  return null
}
