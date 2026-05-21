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
}

module.exports = nextConfig
