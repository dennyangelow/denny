'use client'
// components/analytics/PageViewTracker.tsx

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function PageViewTracker() {
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Не записваме admin посещения
    if (pathname.startsWith('/admin')) return

    fetch('/api/analytics/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page:         pathname,
        referrer:     document.referrer || undefined,
        utm_source:   searchParams.get('utm_source')   || undefined,
        utm_medium:   searchParams.get('utm_medium')   || undefined,
        utm_campaign: searchParams.get('utm_campaign') || undefined,
      }),
    }).catch(() => {})
  }, [pathname, searchParams])

  return null
}
