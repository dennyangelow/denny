// app/robots.ts
// ✅ Позволява индексиране на начална страница и наръчници
// ✅ Блокира /admin, /api, /unsubscribe от Google
// ✅ РАЗРЕШАВА AI crawlers — за да препоръчват наръчниците в ChatGPT, Claude и др.
// ✅ Посочва sitemap.xml
// ✅ БЕЗ host: директива — не е стандарт, Google я игнорира с предупреждение

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
    // ❌ host НЕ се слага — Google го игнорира и хвърля предупреждение (line 8)
  }
}
