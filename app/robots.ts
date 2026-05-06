// app/robots.ts — v4
// ✅ ПРОМЯНА спрямо v3: Добавен /products/ в allow списъка
//    /products/ = собствени Atlas Terra продуктови страници
// Запазени всички v3 поправки и подобрения

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
          '/produkti/',
          '/products/',    // ✅ НОВО: собствени Atlas Terra продуктови страници
        ],
        disallow: [
          '/admin',
          '/admin/',
          '/api/',
          '/unsubscribe',
          '/*?',           // Блокира всички URL-и с query params
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
