// app/robots.ts — финална версия
// ✅ Позволява индексиране на начална страница и наръчници
// ✅ Блокира /admin, /api, /unsubscribe от Google
// ✅ Блокира AI crawlers (GPTBot, Claude-Web, CCBot)
// ✅ Посочва sitemap.xml

import { MetadataRoute } from 'next'

const BASE_URL = 'https://dennyangelow.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Всички търсачки — Google, Bing, Yandex...
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',      // admin панел
          '/admin/',
          '/api/',       // всички API routes
          '/unsubscribe', // не е SEO страница
        ],
      },
      {
        // Блокира OpenAI crawler да учи от съдържанието ти
        userAgent: 'GPTBot',
        disallow: '/',
      },
      {
        // Блокира Anthropic crawler
        userAgent: 'Claude-Web',
        disallow: '/',
      },
      {
        // Блокира Common Crawl (използва се за AI training)
        userAgent: 'CCBot',
        disallow: '/',
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
