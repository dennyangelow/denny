/** @type {import('next').NextConfig} */
// next.config.js — v3
// ✅ ПОПРАВКА спрямо v2:
//   - ПРЕМАХНАТ HTTP → HTTPS redirect — Vercel го прави автоматично
//     и x-forwarded-proto проверката причиняваше ERR_TOO_MANY_REDIRECTS loop
//   - Запазен само www → non-www (301) — решава canonical проблема в Search Console

const nextConfig = {
  async redirects() {
    return [
      // www → non-www (покрива всички пътища)
      // Решава: "Алтернативна страница с правилен каноничен маркер" (20 стр.)
      {
        source:      '/:path*',
        has: [{ type: 'host', value: 'www.dennyangelow.com' }],
        destination: 'https://dennyangelow.com/:path*',
        permanent:   true,
      },
    ]
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'd1yei2z3i6k35z.cloudfront.net' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.r2.dev' },
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
