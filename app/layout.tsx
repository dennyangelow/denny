// app/layout.tsx — v3
// ✅ ПРОМЕНИ спрямо v2:
//   - Добавен Service schema (локално SEO за България — "агро консултант България")
//   - Добавен speakable schema в WebSite (за Google SGE / Perplexity / AI snippet)
//   - Добавен llms-meta tag (за AI crawler visibility)
//   - WebSite SearchAction: махнат potentialAction ако search не работи реално
//     (ако /produkti?q= работи като search — остави; иначе → коментирай)
//   - DNS prefetch за Supabase CDN добавен
//   - theme-color обновен

import type { Metadata } from 'next'
import { Suspense }      from 'react'
import { PageViewTracker }    from '@/components/analytics/PageViewTracker'
import { GoogleAnalytics }    from '@/components/analytics/GoogleAnalytics'
import { AffiliatePreloader } from '@/components/AffiliatePreloader'

const BASE_URL = 'https://dennyangelow.com'

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

  authors:   [{ name: 'Denny Angelow', url: BASE_URL }],
  creator:   'Denny Angelow',
  publisher: 'Denny Angelow',

  icons: {
    icon:  '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const personSchema = {
  '@context': 'https://schema.org',
  '@type':    'Person',
  name:        'Denny Angelow',
  alternateName: 'Дени Ангелов',
  url:         BASE_URL,
  image:       'https://d1yei2z3i6k35z.cloudfront.net/4263526/687aa8144659d_504368576_24540238958894103_5234342802938640767_n.jpg',
  jobTitle:    'Агро Консултант',
  description: 'Агро консултант с над 8 години опит в отглеждането на зеленчуци. Помогнал е на над 800 домакинства и малки стопанства в България да увеличат реколтата от домати, краставици и зеленчуци с органични методи и правилно торене.',
  hasOccupation: {
    '@type':             'Occupation',
    name:                 'Агро Консултант',
    occupationLocation:  { '@type': 'Country', name: 'България' },
    description:          'Консултации за земеделие, торене, растителна защита и оранжерийно производство.',
    skills:               'Отглеждане на домати, краставици, торене, биостимулатори, растителна защита',
  },
  knowsAbout: [
    'Отглеждане на домати', 'Отглеждане на краставици', 'Торене на зеленчуци',
    'Биостимулатори за земеделие', 'Органично торене', 'Болести по доматите',
    'Оранжерийно производство', 'Найлон за оранжерии', 'Защита от болести по растенията',
    'Капково напояване', 'Земеделие в България', 'Биологично земеделие',
  ],
  sameAs: [
    'https://www.facebook.com/dennyangelow',
    'https://www.instagram.com/dennyangelow',
    'https://www.youtube.com/@dennyangelow',
    'https://www.tiktok.com/@dennyangelow',
  ],
  contactPoint: {
    '@type':           'ContactPoint',
    telephone:          '+359876238623',
    email:              'support@dennyangelow.com',
    contactType:        'customer service',
    availableLanguage:  'Bulgarian',
    hoursAvailable:     'Mo-Fr 09:00-17:00',
  },
}

const organizationSchema = {
  '@context':  'https://schema.org',
  '@type':     'Organization',
  name:         'Denny Angelow',
  legalName:    'Denny Angelow',
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
  sameAs: [
    'https://www.facebook.com/dennyangelow',
    'https://www.instagram.com/dennyangelow',
    'https://www.youtube.com/@dennyangelow',
    'https://www.tiktok.com/@dennyangelow',
  ],
  contactPoint: {
    '@type':           'ContactPoint',
    telephone:          '+359876238623',
    email:              'support@dennyangelow.com',
    contactType:        'customer service',
    availableLanguage:  'Bulgarian',
  },
}

// ✅ НОВО: Service schema — "агро консултант България" локално SEO
const serviceSchema = {
  '@context':  'https://schema.org',
  '@type':     'Service',
  name:         'Агро Консултации — Denny Angelow',
  description:  'Безплатни консултации и наръчници за отглеждане на домати, краставици, правилно торене и растителна защита.',
  provider: {
    '@type': 'Person',
    name:     'Denny Angelow',
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
    servicePhone:  '+359876238623',
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
    name:    'Denny Angelow',
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
  // ✅ speakable — Google SGE, Perplexity и AI четат тези селектори за snippet
  speakable: {
    '@type':         'SpeakableSpecification',
    cssSelector:     ['h1', 'h2', '.hero-desc', '[data-speakable]'],
  },
  // Остави potentialAction само ако /produkti?q= реално работи като search
  potentialAction: {
    '@type':       'SearchAction',
    target:        `${BASE_URL}/produkti?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
}

// ─── Root Layout ──────────────────────────────────────────────────────────────
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* Geo мета — локално SEO за България */}
        <meta name="geo.region"       content="BG" />
        <meta name="geo.placename"    content="България" />
        <meta name="language"         content="Bulgarian" />
        <meta name="content-language" content="bg" />

        {/* ✅ НОВО: AI crawler meta — помага на AI да идентифицира сайта */}
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />

        <meta name="theme-color" content="#1b4332" />

        {/* DNS prefetch — ускорява зареждането */}
        <link rel="dns-prefetch" href="https://d1yei2z3i6k35z.cloudfront.net" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />

        {/* Шрифтове */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900;1,9..40,400&family=Cormorant+Garamond:wght@600;700;800&display=swap"
          rel="stylesheet"
        />

        {/* Schema.org: Person — E-E-A-T авторитет */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
        />

        {/* Schema.org: Organization — Knowledge Panel */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />

        {/* Schema.org: Service — локално SEO "агро консултант България" */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
        />

        {/* Schema.org: WebSite — SearchAction + speakable за AI */}
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