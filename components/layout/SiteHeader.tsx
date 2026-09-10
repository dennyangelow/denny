'use client'

// components/layout/SiteHeader.tsx — v1 (обединена версия на менюто)
// ✅ ЗАМЕСТВА: components/client/HeaderClient.tsx, старият
//    components/layout/SiteHeader.tsx, и хардкоднатите header-и в
//    AffiliateProduktClient.tsx и ProduktCatalogClient.tsx — вече ЕДИН
//    файл управлява менюто на целия сайт.
//
// ⚠️ ВАЖНО: cart логиката (openCart, cart:count listener, cartCount state)
//    е копирана 1:1 от HeaderClient.tsx v2 — БЕЗ промяна на контракта —
//    за да не се счупи количката никъде, където вече работи (началната
//    страница, /products/[slug]).
//
// ✅ НОВО спрямо HeaderClient v2:
//   - showCart prop (default true). Когато е false:
//       · cart:count listener-ът изобщо НЕ се закача (нула JS overhead
//         за страници без количка — afiliate продукти, /produkti каталог,
//         блог, наръчници)
//       · вместо бутона "🛒 Количка" се показва cartFallbackLabel/-Href
//         (текст + линк, управляеми от админ панела — виж
//         lib/header-cart.ts + SettingsTab.tsx, секция "🛒 Количка по
//         страници")
//   - variant prop, запазен за backward compatibility със стария
//     components/layout/SiteHeader.tsx (в момента само добавя CSS клас
//     модификатор — визуалният dark режим не е пренесен, тъй като никое
//     повикване в проекта в момента не използва variant="dark").

import { useState, useEffect } from 'react'

interface Props {
  /** false на страници без количка. Премахва listener-а и бутона. Default: true. */
  showCart?:          boolean
  /** Ползват се само ако showCart=true. Не влияят на самия header markup —
   *  запазени за backward compatibility с извикванията, които вече ги подават. */
  shippingPrice?:     number
  freeShippingAbove?: number
  /** Текст/линк вдясно, когато showCart=false. */
  cartFallbackLabel?: string
  cartFallbackHref?:  string
  /** Запазено за backward compatibility (старият SiteHeader.tsx приемаше variant). */
  variant?:           'light' | 'dark'
}

export default function SiteHeader({
  showCart          = true,
  shippingPrice,
  freeShippingAbove,
  cartFallbackLabel = '← Всички продукти',
  cartFallbackHref  = '/produkti',
  variant           = 'light',
}: Props) {
  const [scrolled,       setScrolled]       = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [cartCount,      setCartCount]      = useState(0)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ✅ Cart listener-ът се закача САМО ако количката е активна на тази
  //    страница — на страници без количка изобщо не слушаме cart:count.
  useEffect(() => {
    if (!showCart) return
    const handler = (e: Event) => {
      const count = (e as CustomEvent<number>).detail
      setCartCount(count)
    }
    window.addEventListener('cart:count', handler)
    return () => window.removeEventListener('cart:count', handler)
  }, [showCart])

  const openCart = () => window.dispatchEvent(new CustomEvent('cart:open'))

  return (
    <>
      <header className={`site-header${scrolled ? ' scrolled' : ''}${variant === 'dark' ? ' site-header--dark' : ''}`}>
        <a href="/" className="header-logo">
          <span style={{ fontSize: 24 }}>🍅</span>
          <div>
            <div className="logo-name">Denny Angelow</div>
            <div className="logo-sub">Агро Консултант</div>
          </div>
        </a>

        <nav className="header-nav">
          <a href="/#produkti"     className="nav-link">Продукти</a>
          <a href="/produkti"      className="nav-link nav-link--all-products">Всички →</a>
          <a href="/#atlas"        className="nav-link">Atlas Terra</a>
          <a href="/#ginegar"      className="nav-link">Ginegar</a>
          <a href="/#testimonials" className="nav-link">Отзиви</a>
          <a href="/#faq"          className="nav-link">Въпроси</a>
          <a href="/blog"          className="nav-link">Блог</a>
        </nav>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {showCart ? (
            <button
              onClick={openCart}
              className={`cart-btn${cartCount > 0 ? ' cart-btn--active' : ''}`}
            >
              🛒 {cartCount > 0 ? `(${cartCount}) ` : ''}Количка
            </button>
          ) : (
            <a href={cartFallbackHref} className="cart-btn" style={{ textDecoration: 'none' }}>
              {cartFallbackLabel}
            </a>
          )}
          <button
            className="mob-btn"
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-label="Меню"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="mob-nav">
          {([
            ['/#produkti',    'Продукти'],
            ['/produkti',     '📦 Всички продукти'],
            ['/#atlas',       'Atlas Terra'],
            ['/#testimonials','Отзиви'],
            ['/#faq',         'Въпроси'],
            ['/blog',         '📝 Блог'],
          ] as [string, string][]).map(([h, l]) => (
            <a
              key={h}
              href={h}
              className="mob-nav-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              {l}
            </a>
          ))}

          {/* ✅ Persistent бутонът (количка/fallback) остава винаги видим горе,
                независимо от мобилното меню — точно както в оригиналния
                HeaderClient. За showCart=false добавяме и дублиращ линк тук,
                защото хардкоднатите версии (AffiliateProduktClient) вече
                разчитаха на това за навигация от мобилно меню. */}
          {!showCart && (
            <a
              href={cartFallbackHref}
              className="mob-nav-link"
              style={{ color: '#16a34a', fontWeight: 800 }}
              onClick={() => setMobileMenuOpen(false)}
            >
              {cartFallbackLabel}
            </a>
          )}
        </div>
      )}
    </>
  )
}
