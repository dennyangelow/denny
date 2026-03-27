'use client'
// components/analytics/PageViewTracker.tsx
// Постави в app/layout.tsx - автоматично записва всяко посещение

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const params = searchParams
    fetch('/api/analytics/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: pathname,
        referrer: document.referrer || undefined,
        utm_source: params.get('utm_source') || undefined,
        utm_medium: params.get('utm_medium') || undefined,
        utm_campaign: params.get('utm_campaign') || undefined,
      }),
    }).catch(() => {})
  }, [pathname, searchParams])

  return null
}
