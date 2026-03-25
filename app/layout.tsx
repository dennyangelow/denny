// app/layout.tsx

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Denny Angelow — Тайните на Едрите и Вкусни Домати',
  description: 'Изтегли безплатния наръчник и открий как да отгледаш едри, здрави и сочни домати без болести и загубена реколта.',
  keywords: 'домати, торове, агро, биостимулатори, Atlas Terra, оранжерия, земеделие, Кристалон, Калитех, Амалгерол',
  openGraph: {
    title: 'Denny Angelow — Агро Консултант',
    description: 'Едри, здрави и сочни домати без загубена реколта.',
    url: 'https://dennyangelow.com',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Denny Angelow — Агро Консултант',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#fff' }}>
        {children}
      </body>
    </html>
  )
}
