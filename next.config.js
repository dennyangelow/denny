/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'd1yei2z3i6k35z.cloudfront.net' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://dennyangelow.com',
  },
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },
}

module.exports = nextConfig
