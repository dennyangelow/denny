// app/produkti/page.tsx — v2
// ✅ ПОПРАВКА: импортира homepage.css (header/nav стилове) + produkti.css

import { Metadata }             from 'next'
import { supabaseAdmin }        from '@/lib/supabase'
import type { AffiliateProduct } from '@/lib/affiliate'
import { ProduktCatalogClient } from './ProduktCatalogClient'
import '../homepage.css'   // ✅ header, nav, font, base стилове
import './produkti.css'    // ✅ само каталог-специфични стилове

export const revalidate = 60

const BASE_URL = 'https://dennyangelow.com'

export const metadata: Metadata = {
  title: 'Всички Продукти — Проверени от Практиката | Denny Angelow',
  description: 'Пълен каталог от препоръчани биостимулатори, торове, фунгициди и инсектициди. Лично тествани и препоръчани от агро консултант Denny Angelow.',
  keywords: [
    'биостимулатори', 'торове за домати', 'фунгицид', 'инсектицид',
    'Амалгерол', 'Калитех', 'Ридомил', 'Синейс', 'Кристалон',
    'органично торене', 'растителна защита', 'Denny Angelow',
  ],
  alternates: { canonical: `${BASE_URL}/produkti` },
  openGraph: {
    title: 'Всички Продукти | Denny Angelow',
    description: 'Биостимулатори, торове и препарати за здрави растения — лично препоръчани от Denny Angelow.',
    url: `${BASE_URL}/produkti`,
    siteName: 'Denny Angelow',
    locale: 'bg_BG',
    type: 'website',
  },
  robots: { index: true, follow: true },
}

async function getAllProducts(): Promise<AffiliateProduct[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('affiliate_products')
      .select('*')
      .eq('active', true)
      .order('sort_order')
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('[produkti/page] getAllProducts:', err)
    return []
  }
}

export default async function ProduktiPage() {
  const products = await getAllProducts()

  const categories = Array.from(
    new Set(products.map(p => p.category_label).filter(Boolean))
  ) as string[]

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Начало',   item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Продукти', item: `${BASE_URL}/produkti` },
    ],
  }

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Препоръчани агро продукти от Denny Angelow',
    url: `${BASE_URL}/produkti`,
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.name,
      url: `${BASE_URL}/produkt/${p.slug}`,
      image: p.image_url,
      description: p.description || p.subtitle,
    })),
  }

  return (
    <>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <ProduktCatalogClient products={products} categories={categories} />
    </>
  )
}
