'use client'
// components/analytics/PageViewTracker.tsx
// ВАЖНО: Използвай САМО този компонент — изтрий usePageViewTracker.ts
// Endpoint: /api/analytics/page-view (с тире)

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const VISITOR_KEY = 'da_vid'  // localStorage — persistent
const SESSION_KEY = 'da_sid'  // sessionStorage — per tab/window

function getOrCreate(storage: Storage, key: string): string {
  let id = storage.getItem(key)
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    storage.setItem(key, id)
  }
  return id
}

export function PageViewTracker() {
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Не трекваме admin страниците
    if (pathname.startsWith('/admin')) return

    try {
      const visitorId = getOrCreate(localStorage,  VISITOR_KEY)
      const sessionId = getOrCreate(sessionStorage, SESSION_KEY)

      fetch('/api/analytics/page-view', {
        method:    'POST',
        headers:   { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          path:         pathname,
          visitor_id:   visitorId,
          session_id:   sessionId,
          referrer:     document.referrer || undefined,
          utm_source:   searchParams.get('utm_source')   || undefined,
          utm_medium:   searchParams.get('utm_medium')   || undefined,
          utm_campaign: searchParams.get('utm_campaign') || undefined,
        }),
      }).catch(() => {})
    } catch {
      // SSR или localStorage недостъпен
    }
  }, [pathname, searchParams])

  return null
}
