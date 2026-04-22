// app/layout.tsx — SEO максимум + Affiliate Preloader
// ПРОМЕНИ спрямо оригинала:
//   ✅ metadataBase — ЗАДЪЛЖИТЕЛНО за og:image да работи (липсваше изцяло)
//   ✅ title template — автоматично добавя "| Denny Angelow" към всяка страница
//   ✅ title default — поправен (беше title на наръчник, не на сайта!)
//   ✅ description — покрива всички теми: домати, краставици, Atlas Terra, Ginegar
//   ✅ keywords — разширени от 9 на 45+ ключови думи за всички теми
//   ✅ og:image — добавен (напълно липсваше)
//   ✅ og:locale, og:siteName — добавени
//   ✅ Person Schema — Denny като E-E-A-T авторитет с knowsAbout
//   ✅ Organization Schema — с телефон, имейл, социални мрежи от сайта
//   ✅ WebSite Schema — с about темите на сайта
//   ✅ Geo мета тагове — локално SEO за България
//   ✅ theme-color — зелен бранд цвят
//   ✅ AffiliatePreloader — закача AgroApteki tracking cookie при всяко посещение

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageViewTracker } from '@/components/analytics/PageViewTracker'
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics'
import { AffiliatePreloader } from '@/components/AffiliatePreloader'


const BASE_URL = 'https://dennyangelow.com'

export const metadata: Metadata = {

  // ── metadataBase — ЗАДЪЛЖИТЕЛНО за og:image да работи правилно ────────────
  // Без него Next.js не знае base URL-а и og:image не се генерира правилно
  metadataBase: new URL(BASE_URL),

  // ── Title ──────────────────────────────────────────────────────────────────
  // ВАЖНО: template-ът автоматично добавя " | Denny Angelow" към всяка страница
  // Например: "Домати — Безплатен PDF | Denny Angelow"
  title: {
    default: 'Denny Angelow — Домати, Краставици, Торове и Агро Наръчници',
    template: '%s | Denny Angelow',
  },

  // ── Description ────────────────────────────────────────────────────────────
  description: 'Безплатни PDF наръчници за домати и краставици. Торове, биостимулатори Atlas Terra, Ginegar найлон за оранжерии. Над 6 500 фермери вече използват съветите на Дени Ангелов — агро консултант с 8+ години опит.',

  // ── Keywords — всички теми на сайта ───────────────────────────────────────
  keywords: [
    // Домати (главна тема)
    'домати', 'отглеждане на домати', 'торене на домати', 'болести по домати',
    'мана по домати', 'Tuta absoluta', 'върхово гниене на домати',
    'домати в оранжерия', 'домати добив от декар', 'наръчник за домати',
    'как да отгледам домати', 'домати без болести',
    // Краставици
    'краставици', 'отглеждане на краставици', 'торене на краставици',
    'краставици в оранжерия', 'наръчник за краставици',
    'краставици високи добиви', 'краставици болести',
    // Биостимулатори и торове
    'Atlas Terra', 'биостимулатори', 'органично торене', 'течни торове',
    'хуминови киселини', 'аминокиселини за растения', 'NPK торове',
    'Амалгерол', 'Калитех', 'Кристалон зелен', 'Турбо Рут',
    // Препарати
    'Ридомил Голд', 'Синейс 480', 'мана по растения', 'трипс по домати',
    'фунгицид за домати', 'инсектицид биологичен',
    // Оранжерии
    'оранжерия', 'найлон за оранжерия', 'Ginegar', 'израелски найлон',
    'полиетилен за оранжерия', 'поливни системи', 'капково напояване',
    // Общо земеделие
    'земеделие България', 'агро консултант', 'Denny Angelow',
    'безплатен агро наръчник', 'рекордна реколта', 'органично земеделие',
    'биологично земеделие', 'защита от болести по растенията',
    'фермери България', 'градина', 'зеленчуци',
  ],

  // ── Canonical ──────────────────────────────────────────────────────────────
  alternates: {
    canonical: BASE_URL,
    languages: { 'bg-BG': BASE_URL },
  },

  // ── Open Graph — Facebook, Viber, WhatsApp ─────────────────────────────────
  // ⚠️ Постави og-image.jpg (1200x630px) в /public/ папката
  // Препоръка: снимка на домати/краставици с лого на Denny Angelow
  openGraph: {
    title: 'Denny Angelow — Безплатни Наръчници за Домати и Краставици',
    description: 'Изтегли безплатно и научи как да отгледаш едри, здрави домати и краставици. Над 6 500 фермери вече го използват.',
    url: BASE_URL,
    siteName: 'Denny Angelow',
    locale: 'bg_BG',
    type: 'website',
    images: [
      {
        url: `${BASE_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: 'Denny Angelow — Домати, Краставици и Агро Наръчници',
      },
    ],
  },

  // ── Twitter / X ────────────────────────────────────────────────────────────
  twitter: {
    card: 'summary_large_image',
    title: 'Denny Angelow — Безплатни Агро Наръчници',
    description: 'Домати, краставици, торене, болести, оранжерии. Изтегли безплатно.',
    images: [`${BASE_URL}/og-image.jpg`],
    creator: '@dennyangelow',
  },

  // ── Robots ─────────────────────────────────────────────────────────────────
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },

  // ── Автор ──────────────────────────────────────────────────────────────────
  authors: [{ name: 'Denny Angelow', url: BASE_URL }],
  creator: 'Denny Angelow',
  publisher: 'Denny Angelow',

  // ── Google Search Console верификация ─────────────────────────────────────
  // ⚠️ След регистрация в Search Console → постави кода тук и разкоментирай
  // verification: {
  //   google: 'ПОСТАВИ_КОДА_ТУК',
  // },

  // ── Иконки ────────────────────────────────────────────────────────────────
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* Geo мета — локално SEO за България */}
        <meta name="geo.region" content="BG" />
        <meta name="geo.placename" content="България" />
        <meta name="language" content="Bulgarian" />
        <meta name="content-language" content="bg" />

        {/* Зелен бранд цвят в адресната лента на мобилния браузър */}
        <meta name="theme-color" content="#1b4332" />

        {/* Шрифтове */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900;1,9..40,400&family=Cormorant+Garamond:wght@600;700;800&display=swap"
          rel="stylesheet"
        />

        {/* ─────────────────────────────────────────────────────────────────────
            Schema.org: Person
            Казва на Google "Дени Ангелов е ЕКСПЕРТ в тези теми" (E-E-A-T сигнал)
            knowsAbout = точно темите за които искаме да излизаме в Google
        ──────────────────────────────────────────────────────────────────────── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Person',
              name: 'Denny Angelow',
              url: BASE_URL,
              // Реалната снимка от сайта
              image: 'https://d1yei2z3i6k35z.cloudfront.net/4263526/687aa8144659d_504368576_24540238958894103_5234342802938640767_n.jpg',
              jobTitle: 'Агро Консултант',
              description: 'Агро консултант с над 8 години опит в отглеждането на зеленчуци. Помогнал е на над 800 домакинства и малки стопанства в България да увеличат реколтата от домати, краставици и зеленчуци с органични методи и правилно торене.',
              // Ключово за SEO — Google разбира в какви теми си авторитет
              knowsAbout: [
                'Отглеждане на домати',
                'Отглеждане на краставици',
                'Торене на зеленчуци',
                'Биостимулатори за земеделие',
                'Органично торене',
                'Болести по доматите',
                'Оранжерийно производство',
                'Найлон за оранжерии',
                'Защита от болести по растенията',
                'Капково напояване',
                'Земеделие в България',
                'Биологично земеделие',
              ],
              // Реалните социални мрежи от footer-а на сайта
              sameAs: [
                'https://www.facebook.com/dennyangelow',
                'https://www.instagram.com/dennyangelow',
                'https://www.youtube.com/@dennyangelow',
                'https://www.tiktok.com/@dennyangelow',
              ],
              // Реалните контакти от сайта
              contactPoint: {
                '@type': 'ContactPoint',
                telephone: '+359876238623',
                email: 'support@dennyangelow.com',
                contactType: 'customer service',
                availableLanguage: 'Bulgarian',
                hoursAvailable: 'Mo-Fr 09:00-17:00',
              },
            }),
          }}
        />

        {/* ─────────────────────────────────────────────────────────────────────
            Schema.org: Organization
            За Google Knowledge Panel и rich results
        ──────────────────────────────────────────────────────────────────────── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Denny Angelow',
              url: BASE_URL,
              logo: `${BASE_URL}/og-image.jpg`,
              description: 'Безплатни агро наръчници за домати и краставици, биостимулатори Atlas Terra и Ginegar найлон. Агро консултации за фермери в България.',
              areaServed: 'BG',
              foundingDate: '2017',
              sameAs: [
                'https://www.facebook.com/dennyangelow',
                'https://www.instagram.com/dennyangelow',
                'https://www.youtube.com/@dennyangelow',
                'https://www.tiktok.com/@dennyangelow',
              ],
              contactPoint: {
                '@type': 'ContactPoint',
                telephone: '+359876238623',
                email: 'support@dennyangelow.com',
                contactType: 'customer service',
                availableLanguage: 'Bulgarian',
              },
            }),
          }}
        />

        {/* ─────────────────────────────────────────────────────────────────────
            Schema.org: WebSite
            about = темите на сайта → Google разбира контекста
        ──────────────────────────────────────────────────────────────────────── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Denny Angelow — Агро Наръчници',
              url: BASE_URL,
              inLanguage: 'bg-BG',
              description: 'Безплатни наръчници и съвети за домати, краставици, торене и земеделие в България.',
              publisher: {
                '@type': 'Person',
                name: 'Denny Angelow',
                url: BASE_URL,
              },
              // Казваме на Google точно за какво е сайтът
              about: [
                { '@type': 'Thing', name: 'Домати' },
                { '@type': 'Thing', name: 'Краставици' },
                { '@type': 'Thing', name: 'Земеделие' },
                { '@type': 'Thing', name: 'Оранжерии' },
                { '@type': 'Thing', name: 'Биостимулатори' },
                { '@type': 'Thing', name: 'Органично торене' },
                { '@type': 'Thing', name: 'Болести по растенията' },
                { '@type': 'Thing', name: 'Atlas Terra' },
                { '@type': 'Thing', name: 'Ginegar' },
              ],
            }),
          }}
        />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <GoogleAnalytics />
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        {/* ✅ Закача AgroApteki affiliate cookie при всяко посещение на сайта.
            Зарежда се 2 сек след страницата — не влияе на LCP/Core Web Vitals.
            Повтаря се на 28 дни (TTL на cookie-то им). */}
        <AffiliatePreloader />
        {children}
      </body>
    </html>
  )
}
