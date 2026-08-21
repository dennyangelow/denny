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

  // ❌ ПРЕМАХНАТО (v6): experimental.optimizeCss / critters.
  //    Доказано от PageSpeed network trace, че никога не е инлайн-вал
  //    homepage.css реално (продължаваше да излиза като нормален
  //    render-blocking <link>) — точно предупреждението в стария коментар
  //    ("ПРОВЕРИ след build дали реално инлайн-ва") се сбъдна. Вместо това
  //    критичният CSS вече се чете с fs.readFileSync и се инжектира ръчно
  //    като <style> директно в app/page.tsx — 100% гарантирано инлайн,
  //    без зависимост от build-time heuristic. Маха се и build dependency-то
  //    "critters", което е нестабилно в по-новите Next версии.
}

module.exports = nextConfig
