/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'd1yei2z3i6k35z.cloudfront.net' },
      { protocol: 'https', hostname: '*.supabase.co' },
      // ✅ Cloudflare R2 публичен домейн — задължително за next/image
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
