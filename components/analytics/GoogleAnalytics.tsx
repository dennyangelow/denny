'use client'
// components/analytics/GoogleAnalytics.tsx
// Зарежда Google Analytics 4 скрипта само ако GA_ID е наличен
// Поставя се в app/layout.tsx вътре в <head>

import Script from 'next/script'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

export function GoogleAnalytics() {
  if (!GA_ID) return null

  return (
    <>
      {/* Инициализира dataLayer + gtag() веднага (0 мрежови заявки) — така
          ранни извиквания на window.gtag(...) (напр. от PageViewTracker при
          route промяна преди gtag.js да се е заредил) се опашкуват коректно
          вместо да хвърлят грешка. */}
      <Script id="google-analytics-init" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
          window.gtag('js', new Date());
        `}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="lazyOnload"
      />
      <Script id="google-analytics-config" strategy="lazyOnload">
        {`
          window.gtag('config', '${GA_ID}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  )
}
