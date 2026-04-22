// app/robots.ts — v3
// ПОПРАВКИ спрямо v2:
//   ✅ /*?* → /*? (правилен синтаксис за блокиране на query params)
//      /*?* не е валиден robots.txt синтаксис в повечето crawler-и
// ПОДОБРЕНИЯ:
//   ✅ Crawl-delay премахнат (Next.js не го поддържа в MetadataRoute.Robots)
//   ✅ Добавен /api/ disallow за всички ботове (не само Googlebot)
//   ✅ Добавен /admin/ disallow за всички

import { MetadataRoute } from 'next'

const BASE_URL = 'https://dennyangelow.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Всички ботове (включително AI: GPTBot, Claude-Web, PerplexityBot и др.)
        userAgent: '*',
        allow: [
          '/',
          '/naruchnik/',
          '/produkt/',
        ],
        disallow: [
          '/admin',
          '/admin/',
          '/api/',
          '/unsubscribe',
          '/*?',        // ✅ ПОПРАВКА: блокира всички URL-и с query params
        ],
      },
      // Googlebot — без ограничения (може да crawl-ва всичко позволено)
      {
        userAgent: 'Googlebot',
        allow: ['/'],
        disallow: ['/admin/', '/api/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host:    BASE_URL,
  }
}
