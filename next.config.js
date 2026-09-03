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
    // ✅ v6: deviceSizes вече е ЯВНО зададен (преди липсваше → Next ползваше
    //    default-а [640,750,828,1080,1200,1920,2048,3840]). Дупката между
    //    imageSizes max (384) и default deviceSizes min (640) означаваше,
    //    че всяко изображение с нужна ширина 385–639px скачаше директно на
    //    640px бъкет. Точно това удряше OffersShowcase snimките: displayed
    //    284×310px на мобилно × ~1.8 DPR ≈ 511px нужни → Next искаше 640px,
    //    не можеше да ъпскейлва оригинала (511×558) → сервираше го цял,
    //    двойно по-голям от нужното (виж PageSpeed "49.1 KiB Est Savings").
    //    440/500 запълват точно тази дупка.
    deviceSizes: [440, 500, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],
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
