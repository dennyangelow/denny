// app/blog/layout.tsx — v3
// ✅ ПОПРАВКА спрямо v2: липсваше import '../homepage.css' — .site-header,
//    .header-nav, .nav-link, .cart-btn, .mob-nav, .mob-btn, .site-footer
//    и т.н. НЕ са дефинирани в blog.css, а в homepage.css (потвърдено с
//    grep). Затова SiteHeader/SiteFooter се рендваха на /blog напълно
//    нестилизирани — суров, накачен текст без layout, без spacing, без
//    responsive hamburger поведение. app/produkti/page.tsx вече внася
//    homepage.css по същата причина (import '../homepage.css') — тук
//    просто липсваше същият ред.
//
// ✅ ПРОМЯНА спрямо v1: SiteHeader вече получава showCart/cartFallback
//    конфигурация от settings (SettingsTab → "🛒 Количка по страници"),
//    вместо да се рендва без аргументи (=> showCart default true, което
//    погрешно щеше да покаже количка на целия /blog route group).
//
// ✅ Settings се тегли ТУК, на layout ниво — важи еднакво за /blog
//    (списъка) и за /blog/[slug] (отделна статия), вместо да се дублира
//    fetch във всяка от двете page.tsx под този layout.
//
// ⚠️ ДОПУСКАНЕ (запазено от v1): AffiliateProduktClient.tsx/
//    ProduktCatalogClient.tsx/NaruchnikClient.tsx рендват SiteHeader сами
//    (вътре в компонента), не през отделен layout.tsx на техния маршрут —
//    потвърдено при преглед на кода им. Ако при теб все пак има и
//    app/produkt/[slug]/layout.tsx или app/naruchnik/[slug]/layout.tsx,
//    които ОЩЕ рендват SiteHeader отделно, ще получиш двоен header там
//    по същата причина като тук — провери преди deploy.
import '../homepage.css'
import './blog.css'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import { getSettings } from '@/lib/settings'
import { getHeaderCartConfig } from '@/lib/header-cart'

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  const settings    = await getSettings()
  const headerCart  = getHeaderCartConfig(settings, 'blog')

  return (
    <div className="blog-page">
      <SiteHeader
        showCart={headerCart.enabled}
        cartFallbackLabel={headerCart.label}
        cartFallbackHref={headerCart.href}
      />
      {children}
      <SiteFooter settings={settings} />
    </div>
  )
}
