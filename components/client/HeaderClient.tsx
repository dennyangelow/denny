'use client'

// components/client/HeaderClient.tsx — v3
// ✅ ПРОМЯНА: Цялата логика на менюто (nav, cart, mobile menu) вече живее в
//    components/layout/SiteHeader.tsx — обединената версия за целия сайт.
//    Този файл остава само като тънък wrapper за backward compatibility,
//    за да НЕ се налага да пипаме местата, които вече го викат правилно
//    с количка (app/page.tsx — началната страница, OwnProduktClient.tsx —
//    /products/[slug]). showCart е винаги true тук — количката там остава
//    точно както си е.
//
// ⚠️ За НОВ код: викай директно SiteHeader от '@/components/layout/SiteHeader'.

import SiteHeader from '@/components/layout/SiteHeader'

interface Props {
  shippingPrice:     number
  freeShippingAbove: number
}

export function HeaderClient({ shippingPrice, freeShippingAbove }: Props) {
  return (
    <SiteHeader
      showCart
      shippingPrice={shippingPrice}
      freeShippingAbove={freeShippingAbove}
    />
  )
}
