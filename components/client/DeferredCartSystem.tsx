'use client'
// components/client/DeferredCartSystem.tsx — v2
// ✅ ФИКС v2 (спрямо v1): v1 буферираше САМО 'cart:add' — но header-ът на
// сайта хвърля 'cart:open' при клик на бутона "Количка" (виж CartSystem.tsx,
// слуша за 'cart:open'/'cart:sync'/'cart:add'). Резултат: клик на "Количка"
// в първите ~3с след зареждане (преди requestIdleCallback/timeout mount-а)
// не правеше нищо — бутонът изглеждаше развален. Сега:
//   1. Буферират се ВСИЧКИ три типа събития, не само 'cart:add'.
//   2. 'cart:open' е изричен "покажи МИ ГО СЕГА" на потребителя — вместо
//      да чака idle/timeout прозореца, принуждава незабавен mount.
//
// ✅ ФИКС (PageSpeed "Minimize main-thread work" 5.3s / LCP element render
// delay 1,770ms): CartSystem (2574 реда) е dynamic(ssr:false), но Next.js
// пак го СВАЛЯ И МОНТИРА веднага след hydration — ssr:false спира само
// server рендъра, не отлага client mount-а. Drawer-ът реално не е видим,
// докато потребителят не кликне "Количка"/"Добави в количка", затова
// няма причина 2500-те реда pricing/offer логика да се изпълняват в
// същия critical-path прозорец, в който браузърът се опитва да нарисува
// .urgency-bar-а.
//
// Решение: монтираме истинския CartSystem едва след requestIdleCallback (браузърът
// вече е свободен от критична работа) — с timeout fallback за браузъри
// без requestIdleCallback (Safari) и за случай, в който main thread-ът
// никога не "освобождава" (максимум 3s чакане), ОСВЕН ако потребителят сам
// не поиска количката по-рано (виж 'cart:open' по-долу).
//
// ⚠️ Cart событията, хвърлени ПРЕДИ CartSystem реално да се е монтирал, не
// се губят: буферираме ги тук и ги preplay-ваме към истинския CartSystem
// веднага след mount-а.

import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'

const RealCartSystem = dynamic(
  () => import('@/components/client/CartSystem').then(m => m.CartSystem),
  { ssr: false, loading: () => null }
)

const IDLE_TIMEOUT_MS = 3000

// ✅ ФИКС v2: трите събития, за които CartSystem реално слуша — не само 'cart:add'.
const BUFFERED_EVENTS = ['cart:add', 'cart:open', 'cart:sync'] as const

export function DeferredCartSystem(props: React.ComponentProps<typeof RealCartSystem>) {
  const [ready, setReady] = useState(false)
  const bufferedEvents = useRef<CustomEvent[]>([])

  useEffect(() => {
    let mounted = false

    const mount = () => {
      if (mounted) return
      mounted = true
      BUFFERED_EVENTS.forEach(type => window.removeEventListener(type, buffer))
      setReady(true)
      // Preplay-ваме буферираните събития СЛЕД mount (следващ microtask —
      // истинският CartSystem вече трябва да е закачил своя listener).
      if (bufferedEvents.current.length > 0) {
        queueMicrotask(() => {
          bufferedEvents.current.forEach(e => window.dispatchEvent(e))
          bufferedEvents.current = []
        })
      }
    }

    // Буферираме докато истинският CartSystem не се е закачил — без това,
    // клик в първите ~секунди преди idle mount-а би бил изгубен. 'cart:open'
    // (бутона "Количка" в header-а) е изрично "покажи МИ ГО СЕГА" — вместо
    // да чака idle/timeout, принуждава незабавен mount.
    const buffer = (e: Event) => {
      bufferedEvents.current.push(e as CustomEvent)
      if (e.type === 'cart:open' && !mounted) mount()
    }
    BUFFERED_EVENTS.forEach(type => window.addEventListener(type, buffer))

    const ric: typeof window.requestIdleCallback | undefined =
      typeof window !== 'undefined' ? (window as any).requestIdleCallback : undefined

    let idleId: number | undefined
    const timeoutId = window.setTimeout(mount, IDLE_TIMEOUT_MS)

    if (ric) {
      idleId = ric(() => { window.clearTimeout(timeoutId); mount() }, { timeout: IDLE_TIMEOUT_MS })
    } else {
      // Safari няма requestIdleCallback — timeout-ът по-горе е единственият път.
    }

    return () => {
      BUFFERED_EVENTS.forEach(type => window.removeEventListener(type, buffer))
      window.clearTimeout(timeoutId)
      if (ric && idleId !== undefined) (window as any).cancelIdleCallback?.(idleId)
    }
  }, [])

  if (!ready) return null
  return <RealCartSystem {...props} />
}
