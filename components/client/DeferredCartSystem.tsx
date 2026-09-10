'use client'
// components/client/DeferredCartSystem.tsx — v1
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
// никога не "освобождава" (максимум 3s чакане).
//
// ⚠️ Cart добавянията, кликнати ПРЕДИ CartSystem реално да се е монтирал
// (рядко — изисква потребителят да кликне "Добави" за <3s), не се губят:
// добавяме лек буфер тук, който пази 'cart:add' събития до mount-а, после
// ги preplay-ва към истинския CartSystem след като той се е закачил.

import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'

const RealCartSystem = dynamic(
  () => import('@/components/client/CartSystem').then(m => m.CartSystem),
  { ssr: false, loading: () => null }
)

const IDLE_TIMEOUT_MS = 3000

export function DeferredCartSystem(props: React.ComponentProps<typeof RealCartSystem>) {
  const [ready, setReady] = useState(false)
  const bufferedEvents = useRef<CustomEvent[]>([])

  useEffect(() => {
    // Буферираме 'cart:add' докато истинският CartSystem не се е закачил —
    // без това, клик в първите ~секунди преди idle mount-а би бил изгубен.
    const buffer = (e: Event) => bufferedEvents.current.push(e as CustomEvent)
    window.addEventListener('cart:add', buffer)

    const mount = () => {
      window.removeEventListener('cart:add', buffer)
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
      window.removeEventListener('cart:add', buffer)
      window.clearTimeout(timeoutId)
      if (ric && idleId !== undefined) (window as any).cancelIdleCallback?.(idleId)
    }
  }, [])

  if (!ready) return null
  return <RealCartSystem {...props} />
}
