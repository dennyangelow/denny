'use client'

// components/client/HeaderClient.tsx — v2
// ✅ ПРОМЯНА: Добавен линк "Продукти" → /produkti в навигацията

import { useState, useEffect } from 'react'

interface Props {
  shippingPrice:     number
  freeShippingAbove: number
}

export function HeaderClient({ shippingPrice, freeShippingAbove }: Props) {
  const [scrolled,        setScrolled]        = useState(false)
  const [mobileMenuOpen,  setMobileMenuOpen]  = useState(false)
  const [cartCount,       setCartCount]       = useState(0)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const count = (e as CustomEvent<number>).detail
      setCartCount(count)
    }
    window.addEventListener('cart:count', handler)
    return () => window.removeEventListener('cart:count', handler)
  }, [])

  const openCart = () => window.dispatchEvent(new CustomEvent('cart:open'))

  return (
    <>
      <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
        <a href="/" className="header-logo">
          <span style={{ fontSize: 24 }}>🍅</span>
          <div>
            <div className="logo-name">Denny Angelow</div>
            <div className="logo-sub">Агро Консултант</div>
          </div>
        </a>

        <nav className="header-nav">
          <a href="/#produkti"     className="nav-link">Продукти</a>
          {/* ✅ Каталог с всички продукти */}
          <a href="/produkti"      className="nav-link nav-link--all-products">Всички →</a>
          <a href="/#atlas"        className="nav-link">Atlas Terra</a>
          <a href="/#ginegar"      className="nav-link">Ginegar</a>
          <a href="/#testimonials" className="nav-link">Отзиви</a>
          <a href="/#faq"          className="nav-link">Въпроси</a>
        </nav>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={openCart}
            className={`cart-btn${cartCount > 0 ? ' cart-btn--active' : ''}`}
          >
            🛒 {cartCount > 0 ? `(${cartCount}) ` : ''}Количка
          </button>
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
        </div>
      )}
    </>
  )
}
