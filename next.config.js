/** @type {import('next').NextConfig} */
// next.config.js — v5
// ✅ v4 → v5: добавен imageSizes bucket (164px) за да не скача Next/Image
//    директно на 256px за малките корици на наръчниците (HandbooksPanel).
//    Виж PageSpeed "Improve image delivery" — 50 KiB спестявания.
// www → non-www се решава от Vercel Dashboard (Domain Settings → Add www → redirect to apex)
// НЕ трябва да се прави в Next.js код когато си на Vercel

const nextConfig = {
  images: {
    imageSizes: [16, 32, 48, 64, 96, 128, 164, 256, 384],
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

  // ✅ ФИКС render-blocking CSS (PageSpeed: "Render-blocking requests" — 500ms
  // на мобилно, за homepage.css → 10.3 KiB).
  // optimizeCss автоматично инлайн-ва critical CSS в <head> и зарежда
  // останалото async, вместо блокиращ <link rel="stylesheet">.
  // ⚠️ Изисква инсталиран пакет "critters": npm install critters --save-dev
  // ⚠️ ПРОВЕРИ след build дали реално инлайн-ва — виж инструкциите по-долу.
  experimental: {
    optimizeCss: true,
  },
}

module.exports = nextConfig
