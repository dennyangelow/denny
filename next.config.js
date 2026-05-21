/** @type {import('next').NextConfig} */
// next.config.js — v2
// ✅ ПОПРАВКИ спрямо v1:
//   - async redirects(): www → non-www (301 Permanent) — КРИТИЧНО за canonical consistency
//     Без това Google вижда www.dennyangelow.com/produkt/xxx като различна страница
//     от dennyangelow.com/produkt/xxx → "Алтернативна страница с правилен каноничен маркер"
//   - HTTP → HTTPS redirect вече е покрит от хостинга (Vercel/Netlify),
//     но добавен и тук като допълнителна гаранция
//   - Всички v1 настройки запазени (images, env, typescript, eslint)

const nextConfig = {
  // ── www → non-www редиректи (301 Permanent) ─────────────────────────────
  // ЗАДЪЛЖИТЕЛНО: без тези редиректи Google индексира двойни URL-та
  // и хвърля "Алтернативна страница с правилен каноничен маркер"
  async redirects() {
    return [
      // www → non-www (покрива всички пътища: /, /produkt/xxx, /products/xxx, etc.)
      {
        source:      '/:path*',
        has: [{ type: 'host', value: 'www.dennyangelow.com' }],
        destination: 'https://dennyangelow.com/:path*',
        permanent:   true,   // 301 — казва на Google: "каноничният е без www"
      },
      // HTTP → HTTPS non-www (двойна гаранция)
      {
        source:      '/:path*',
        has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }],
        destination: 'https://dennyangelow.com/:path*',
        permanent:   true,
      },
    ]
  },

  // ── Next.js Image — позволени домейни ────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'd1yei2z3i6k35z.cloudfront.net' },
      { protocol: 'https', hostname: '*.supabase.co' },
      // Cloudflare R2 публичен домейн — задължително за next/image
      { protocol: 'https', hostname: '*.r2.dev' },
      // Ако имаш custom domain пред R2, добави и него:
      // { protocol: 'https', hostname: 'cdn.dennyangelow.com' },
    ],
  },

  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://dennyangelow.com',
  },

  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },
}

module.exports = nextConfig
