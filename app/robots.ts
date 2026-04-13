// app/robots.ts
// ✅ Позволява индексиране на начална страница и наръчници
// ✅ Блокира /admin, /api, /unsubscribe от Google
// ✅ РАЗРЕШАВА AI crawlers — за да препоръчват наръчниците в ChatGPT, Claude и др.
// ✅ Посочва sitemap.xml

import { MetadataRoute } from 'next'

const BASE_URL = 'https://dennyangelow.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Всички търсачки И AI ботове
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/api/',
          '/unsubscribe',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
