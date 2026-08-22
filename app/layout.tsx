// app/layout.tsx — v4
// ✅ ПРОМЕНИ спрямо v3:
//   - AUTHOR_* и ORG_* константи → телефон/имейл/sameAs на едно място
//   - Person и Organization schema ползват общите константи — без copy-paste
//   - Всички v3 подобрения запазени (Service schema, speakable, AI meta)

import type { Metadata } from 'next'
import { Suspense }      from 'react'
import { DM_Sans, Cormorant_Garamond } from 'next/font/google'
import { PageViewTracker }    from '@/components/analytics/PageViewTracker'
import { GoogleAnalytics }    from '@/components/analytics/GoogleAnalytics'
import { AffiliatePreloader } from '@/components/AffiliatePreloader'

const BASE_URL = 'https://dennyangelow.com'

// ⚠️ ФИКС (LCP contention, потвърдено от Chrome DevTools Performance trace):
//    LCP елементът на страницата е `h1.hero-title` (ТЕКСТ, не картинка!).
//    Trace-ът показа шрифтовия файл за Cormorant 700 да тръгва да се тегли
//    ~1170ms по-късно от останалите шрифтове/картинки — твърде много файлове
//    с еднакъв приоритет се борят едновременно за bandwidth на throttled
//    мрежа, а точно критичният за LCP файл чака на опашката.
//    Направени 3 неща:
//    1) Cormorant вече е ДЕКЛАРИРАН ПРЪВ (преди DM Sans) — next/font слага
//       preload <link> таговете в реда на декларация в кода, значи
//       единственият Cormorant файл вече излиза преди 7-те DM Sans файла
//       в <head>, вместо след тях.
//    2) grep из ЦЕЛИЯ проект показа var(--font-cormorant) да се ползва
//       ЕДИНСТВЕНО с font-weight:700 — тегло 600 премахнато изцяло
//       (никога не се рендва никъде).
//    3) display:'swap' (виж коментара по-долу за desktop "дебел шрифт" бъга).
const cormorant = Cormorant_Garamond({
  subsets:  ['latin'],
  weight:   ['700'],
  variable: '--font-cormorant',
  display:  'swap',
})

// ✅ ФИКС: next/font/google self-host-ва и preload-ва шрифтовете при build,
//    вместо синхронен <link rel="stylesheet" href="fonts.googleapis.com...">,
//    който беше render-blocking на ВСЯКА страница (виж PageSpeed Insights —
//    "Render-blocking requests", ~1650ms на мобилно). Регистрирани тук веднъж,
//    на ниво root layout — важат за целия сайт, включително produkt страниците,
//    така че AffiliateProduktClient.tsx вече не зарежда собствено копие.
//    Имената на CSS променливите (--font-dm-sans, --font-cormorant) трябва да
//    съвпадат навсякъде, където се ползва var(--font-dm-sans)/var(--font-cormorant).
const dmSans = DM_Sans({
  subsets:  ['latin', 'latin-ext'],
  weight:   ['300', '400', '500', '600', '700', '800', '900'],
  // ⚠️ ФИКС (LCP contention): 'italic' махнат — grep из целия проект показва,
  // че font-style:italic се ползва САМО за .pk-card-desc (цитат в продуктова
  // карта, под сгъва, не е критично). С italic включен, next/font генерира
  // ДВОЕН брой .woff2 файлове (normal+italic × 7 тегла = до 14 файла),
  // всичките се борят за bandwidth в първите ~300ms на throttled мрежа.
  // Само 'normal' намалява файловете наполовина.
  style:    ['normal'],
  variable: '--font-dm-sans',
  display:  'swap',
})

// ⚠️ ФИКС (desktop "дебел шрифт" бъг): display:'optional' + ръчен fallback
//    масив по-долу causeva точно бъга, който виждаш на десктоп — шрифтът
//    "не се зарежда, вместо него зарежда дебел шрифт". С 'optional' браузърът
//    дава на шрифта само ~100ms (от кеш) да пристигне; ако не успее в тоя
//    прозорец (напр. заявката е застанала зад друг ресурс, студен кеш,
//    временна мрежова флуктуация), той изобщо НЕ прави swap за цялата тази
//    навигация — H1/logo-name/handbooks-panel-title остават трайно на
//    fallback-а (Georgia/Times New Roman, bold 700), който на много системи
//    изглежда осезаемо по-"тежък"/дебел от финия Cormorant Garamond. Това
//    може да се случи дори при PageSpeed 100, защото не е въпрос на общо
//    време за зареждане, а на тесен рендър бюджет в конкретния момент.
//    Освен това ръчният `fallback` масив ИЗКЛЮЧВА автоматичния
//    metric-matched fallback на next/font (size-adjust/ascent-override,
//    изчислени да пасват на реалните метрики на Cormorant) — точно
//    механизмът, който пази от CLS при swap.
//    Фикс: display:'swap' (както при DM Sans) + махнат ръчния fallback,
//    за да проработи автоматичният metric-matched fallback на next/font.
//    Шрифтът вече винаги ще се смени коректно, а CLS остава минимален
//    благодарение на автоматично изчислените fallback метрики.

// ── Споделени константи — промяна на 1 място, важи навсякъде ────────────────
const AUTHOR = {
  name:        'Denny Angelow',
  alternateName: 'Дени Ангелов',
  url:         BASE_URL,
  image:       'https://d1yei2z3i6k35z.cloudfront.net/4263526/687aa8144659d_504368576_24540238958894103_5234342802938640767_n.jpg',
  jobTitle:    'Агро Консултант',
  phone:       '+359876238623',
  email:       'support@dennyangelow.com',
  hours:       'Mo-Fr 09:00-17:00',
  sameAs: [
    'https://www.facebook.com/dennyangelow',
    'https://www.instagram.com/dennyangelow',
    'https://www.youtube.com/@dennyangelow',
    'https://www.tiktok.com/@dennyangelow',
  ],
} as const

// Контактна точка — реизползвана в Person и Organization schema
const CONTACT_POINT = {
  '@type':          'ContactPoint',
  telephone:         AUTHOR.phone,
  email:             AUTHOR.email,
  contactType:       'customer service',
  availableLanguage: 'Bulgarian',
  hoursAvailable:    AUTHOR.hours,
} as const

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),

  title: {
    default:  'Denny Angelow — Домати, Краставици, Торове и Агро Наръчници',
    template: '%s | Denny Angelow',
  },

  description: 'Безплатни PDF наръчници за домати и краставици. Биостимулатори Atlas Terra, Ginegar найлон за оранжерии. Над 6 500 фермери вече използват съветите на Дени Ангелов — агро консултант с 8+ години опит.',

  keywords: [
    'домати', 'отглеждане на домати', 'торене на домати', 'болести по домати',
    'мана по домати', 'наръчник за домати', 'домати в оранжерия',
    'краставици', 'отглеждане на краставици', 'краставици в оранжерия',
    'Atlas Terra', 'биостимулатори', 'органично торене', 'хуминови киселини',
    'Амалгерол', 'Ридомил Голд', 'фунгицид за домати',
    'оранжерия', 'найлон за оранжерия', 'Ginegar',
    'земеделие България', 'агро консултант', 'Denny Angelow',
    'безплатен агро наръчник', 'рекордна реколта', 'органично земеделие',
    'зеленчуци', 'капково напояване', 'торове за домати', 'NPK торове',
  ],

  alternates: {
    canonical:  BASE_URL,
    languages:  { 'bg-BG': BASE_URL },
  },

  openGraph: {
    title:       'Denny Angelow — Безплатни Наръчници за Домати и Краставици',
    description: 'Изтегли безплатно и научи как да отгледаш едри, здрави домати и краставици. Над 6 500 фермери вече го използват.',
    url:         BASE_URL,
    siteName:    'Denny Angelow',
    locale:      'bg_BG',
    type:        'website',
    images: [{
      url:    `${BASE_URL}/og-image.jpg`,
      width:   1200,
      height:  630,
      alt:    'Denny Angelow — Домати, Краставици и Агро Наръчници',
    }],
  },

  twitter: {
    card:        'summary_large_image',
    title:       'Denny Angelow — Безплатни Агро Наръчници',
    description: 'Домати, краставици, торене, болести, оранжерии. Изтегли безплатно.',
    images:      [`${BASE_URL}/og-image.jpg`],
    creator:     '@dennyangelow',
  },

  robots: {
    index:  true,
    follow: true,
    googleBot: {
      index:               true,
      follow:              true,
      'max-snippet':       -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },

  authors:   [{ name: AUTHOR.name, url: BASE_URL }],
  creator:   AUTHOR.name,
  publisher: AUTHOR.name,

  icons: {
    icon:  '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const personSchema = {
  '@context':    'https://schema.org',
  '@type':       'Person',
  name:           AUTHOR.name,
  alternateName:  AUTHOR.alternateName,
  url:            AUTHOR.url,
  image:          AUTHOR.image,
  jobTitle:       AUTHOR.jobTitle,
  description:    'Агро консултант с над 8 години опит в отглеждането на зеленчуци. Помогнал е на над 800 домакинства и малки стопанства в България да увеличат реколтата от домати, краставици и зеленчуци с органични методи и правилно торене.',
  hasOccupation: {
    '@type':            'Occupation',
    name:                'Агро Консултант',
    occupationLocation: { '@type': 'Country', name: 'България' },
    description:         'Консултации за земеделие, торене, растителна защита и оранжерийно производство.',
    skills:              'Отглеждане на домати, краставици, торене, биостимулатори, растителна защита',
  },
  knowsAbout: [
    'Отглеждане на домати', 'Отглеждане на краставици', 'Торене на зеленчуци',
    'Биостимулатори за земеделие', 'Органично торене', 'Болести по доматите',
    'Оранжерийно производство', 'Найлон за оранжерии', 'Защита от болести по растенията',
    'Капково напояване', 'Земеделие в България', 'Биологично земеделие',
  ],
  sameAs:       AUTHOR.sameAs,
  contactPoint: CONTACT_POINT,
}

const organizationSchema = {
  '@context':  'https://schema.org',
  '@type':     'Organization',
  name:         AUTHOR.name,
  legalName:    AUTHOR.name,
  url:          BASE_URL,
  logo: {
    '@type': 'ImageObject',
    url:     `${BASE_URL}/og-image.jpg`,
    width:   1200,
    height:  630,
  },
  description:  'Безплатни агро наръчници за домати и краставици, биостимулатори Atlas Terra и Ginegar найлон. Агро консултации за фермери в България.',
  areaServed:   'BG',
  foundingDate: '2017',
  numberOfEmployees: { '@type': 'QuantitativeValue', value: 1 },
  sameAs:       AUTHOR.sameAs,   // ✅ едно място — не дублиране
  contactPoint: CONTACT_POINT,   // ✅ едно място — не дублиране
}

const serviceSchema = {
  '@context':  'https://schema.org',
  '@type':     'Service',
  name:         'Агро Консултации — Denny Angelow',
  description:  'Безплатни консултации и наръчници за отглеждане на домати, краставици, правилно торене и растителна защита.',
  provider: {
    '@type': 'Person',
    name:     AUTHOR.name,
    url:      BASE_URL,
  },
  areaServed: {
    '@type': 'Country',
    name:    'България',
  },
  serviceType:   'Агрономска консултация',
  url:            BASE_URL,
  availableChannel: {
    '@type':       'ServiceChannel',
    serviceUrl:     BASE_URL,
    servicePhone:   AUTHOR.phone,
    availableLanguage: 'Bulgarian',
  },
  offers: {
    '@type':       'Offer',
    price:          '0',
    priceCurrency: 'BGN',
    description:   'Безплатни PDF наръчници и онлайн консултации',
  },
}

const websiteSchema = {
  '@context':  'https://schema.org',
  '@type':     'WebSite',
  name:         'Denny Angelow — Агро Наръчници',
  url:          BASE_URL,
  inLanguage:  'bg-BG',
  description: 'Безплатни наръчници и съвети за домати, краставици, торене и земеделие в България.',
  publisher: {
    '@type': 'Person',
    name:    AUTHOR.name,
    url:     BASE_URL,
  },
  about: [
    { '@type': 'Thing', name: 'Домати' },
    { '@type': 'Thing', name: 'Краставици' },
    { '@type': 'Thing', name: 'Земеделие' },
    { '@type': 'Thing', name: 'Оранжерии' },
    { '@type': 'Thing', name: 'Биостимулатори' },
    { '@type': 'Thing', name: 'Органично торене' },
    { '@type': 'Thing', name: 'Atlas Terra' },
    { '@type': 'Thing', name: 'Ginegar' },
  ],
  speakable: {
    '@type':     'SpeakableSpecification',
    cssSelector: ['h1', 'h2', '.hero-desc', '[data-speakable]'],
  },
  potentialAction: {
    '@type':       'SearchAction',
    target:        `${BASE_URL}/produkti?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
}

// ─── Root Layout ──────────────────────────────────────────────────────────────
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg" className={`${dmSans.variable} ${cormorant.variable}`}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* Geo мета — локално SEO за България */}
        <meta name="geo.region"       content="BG" />
        <meta name="geo.placename"    content="България" />
        <meta name="language"         content="Bulgarian" />
        <meta name="content-language" content="bg" />

        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <meta name="theme-color" content="#1b4332" />

        {/* DNS prefetch */}
        <link rel="dns-prefetch" href="https://d1yei2z3i6k35z.cloudfront.net" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />

        {/* ✅ Шрифтовете се self-host-ват през next/font/google (виж горе) —
            предпазната мрежа (старата <link rel="stylesheet"> заявка) е
            махната, след като homepage, produkt, produkti, products,
            naruchnik и admin панелът бяха проверени и мигрирани към
            var(--font-dm-sans)/var(--font-cormorant)/var(--font-syne)/
            var(--font-lora). Няма нужда от preconnect/dns-prefetch към
            fonts.googleapis.com/fonts.gstatic.com. */}

        {/* Schema.org: Person */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
        />
        {/* Schema.org: Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        {/* Schema.org: Service */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
        />
        {/* Schema.org: WebSite */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <GoogleAnalytics />
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        <AffiliatePreloader />
        {children}
      </body>
    </html>
  )
}
