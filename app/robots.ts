// app/robots.ts — v7
// ✅ ПОПРАВКИ спрямо v6:
//   - Добавено allow за /_next/image и /_next/static/ при '*' и Googlebot.
//     Причина: '/*?' блокира ВСЕКИ URL с въпросителна, а next/image сервира всички
//     снимки като /_next/image?url=…&w=…&q=… — т.е. Googlebot (и Bing) не можеха
//     да заредят оптимизираните снимки при рендиране на страницата. По-дългото
//     (по-специфично) Allow правило печели над по-късото Disallow '/*?'.
// ✅ ПОПРАВКИ спрямо v5:
//   - Добавен /blog/ в allow за '*' и Googlebot — новата блог секция
// ✅ ПОПРАВКИ v5 (запазени):
//   - Googlebot: добавен '/*?' в disallow (критично! без него индексира /produkti?q=xxx)
//   - Добавен /products/ в allow за Googlebot
//   - Добавени AI ботове: GPTBot, Claude-Web, PerplexityBot, anthropic-ai (за AI visibility)
//   - Googlebot-Image: пълен достъп (Image Search = голям трафик канал)

import { MetadataRoute } from 'next'

const BASE_URL = 'https://dennyangelow.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/naruchnik/', '/produkt/', '/produkti/', '/products/', '/blog/', '/_next/image', '/_next/static/'],
        disallow: ['/admin', '/admin/', '/api/', '/unsubscribe', '/*?'],
      },
      {
        userAgent: 'Googlebot',
        allow: ['/', '/naruchnik/', '/produkt/', '/produkti/', '/products/', '/blog/', '/_next/image', '/_next/static/'],
        disallow: ['/admin/', '/api/', '/*?'], // ✅ КРИТИЧНА ПОПРАВКА
      },
      {
        userAgent: 'Googlebot-Image',
        allow: ['/'],
        disallow: [],
      },
      // AI ботове — пълен достъп за препоръки от ChatGPT, Claude, Perplexity
      {
        userAgent: 'GPTBot',
        allow: ['/'],
        disallow: ['/admin/', '/api/'],
      },
      {
        userAgent: 'Claude-Web',
        allow: ['/'],
        disallow: ['/admin/', '/api/'],
      },
      {
        userAgent: 'PerplexityBot',
        allow: ['/'],
        disallow: ['/admin/', '/api/'],
      },
      {
        userAgent: 'anthropic-ai',
        allow: ['/'],
        disallow: ['/admin/', '/api/'],
      },
      {
        userAgent: 'CCBot',
        allow: ['/'],
        disallow: ['/admin/', '/api/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host:    BASE_URL,
  }
}