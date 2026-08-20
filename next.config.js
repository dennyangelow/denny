/** @type {import('next').NextConfig} */
// next.config.js — v4
// ✅ ПОПРАВКА: ПРЕМАХНАТИ ВСИЧКИ redirects()
// www → non-www се решава от Vercel Dashboard (Domain Settings → Add www → redirect to apex)
// НЕ трябва да се прави в Next.js код когато си на Vercel

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'd1yei2z3i6k35z.cloudfront.net' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.r2.dev' },
    ],
  },
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://dennyangelow.com',
  },
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },

  // ✅ ФИКС render-blocking CSS (PageSpeed: "Render-blocking requests" — 450ms
  // на мобилно, за homepage.css → 777d33caba0b872e.css, 10.5 KiB).
  // optimizeCss автоматично инлайн-ва critical CSS в <head> и зарежда
  // останалото async, вместо блокиращ <link rel="stylesheet">.
  // ⚠️ Изисква инсталиран пакет "critters": npm install critters --save-dev
  experimental: {
    optimizeCss: true,
  },
}

module.exports = nextConfig
