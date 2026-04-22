'use client'
// components/layout/SiteHeader.tsx — v2
// ПОПРАВКА: suppressHydrationWarning на <style> + isClient guard за scrolled state
// Причина: useState(false) на сървъра vs. реалната scroll позиция на клиента → hydration mismatch

import { useState, useEffect } from 'react'

interface Props {
  variant?: 'light' | 'dark'
}

export default function SiteHeader({ variant = 'light' }: Props) {
  const [mounted,       setMounted]       = useState(false)
  const [scrolled,      setScrolled]      = useState(false)
  const [mobileOpen,    setMobileOpen]    = useState(false)
  const [cartCount,     setCartCount]     = useState(0)

  // Монтираме само на клиента — избягваме hydration mismatch
  useEffect(() => {
    setMounted(true)
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => setCartCount((e as CustomEvent<number>).detail)
    window.addEventListener('cart:count', handler)
    return () => window.removeEventListener('cart:count', handler)
  }, [])

  const openCart = () => window.dispatchEvent(new CustomEvent('cart:open'))
  const isDark   = variant === 'dark'

  // Изчисляваме класовете само след mount — преди mount показваме статичен header
  const headerBg = !mounted
    ? (isDark ? 'rgba(5,26,13,0.92)' : 'transparent')
    : scrolled
      ? (isDark ? 'rgba(5,26,13,0.98)' : 'rgba(255,255,255,0.97)')
      : (isDark ? 'rgba(5,26,13,0.92)' : 'transparent')

  const headerShadow = mounted && scrolled
    ? (isDark ? '0 2px 20px rgba(0,0,0,0.3)' : '0 2px 16px rgba(0,0,0,0.08)')
    : 'none'

  const logoColor  = (!mounted || !scrolled) && isDark ? '#fff'     : '#1b4332'
  const subColor   = (!mounted || !scrolled) && isDark ? '#86efac'  : '#16a34a'
  const navColor   = (!mounted || !scrolled) && isDark ? 'rgba(255,255,255,.7)' : '#374151'
  const cartBg     = (!mounted || !scrolled) && isDark ? 'rgba(74,222,128,.12)' : '#f0fdf4'
  const cartColor  = (!mounted || !scrolled) && isDark ? '#86efac'  : '#16a34a'
  const cartBorder = (!mounted || !scrolled) && isDark ? '1px solid rgba(74,222,128,.2)' : '1px solid #d1fae5'
  const mobBg      = (!mounted || !scrolled) && isDark ? 'rgba(255,255,255,.08)' : '#f0fdf4'
  const mobColor   = (!mounted || !scrolled) && isDark ? '#fff'     : '#1b4332'

  return (
    <>
      <style suppressHydrationWarning>{`
        .sh-nav-link {
          padding: 6px 12px; border-radius: 8px;
          font-size: 13px; font-weight: 600; text-decoration: none;
          transition: background .15s, color .15s;
        }
        .sh-nav-link:hover { background: rgba(22,163,74,.1); color: #16a34a; }
        @media (max-width: 820px) { .sh-nav { display: none !important; } .sh-mob-btn { display: flex !important; } }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse-cart { 0%,100%{transform:scale(1)} 50%{transform:scale(1.07)} }
        .sh-cart-active { animation: pulse-cart .5s ease; }
      `}</style>

      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 64,
        background: headerBg,
        boxShadow: headerShadow,
        backdropFilter: (mounted && scrolled) ? 'blur(12px)' : 'none',
        transition: 'background .25s, box-shadow .25s',
        borderBottom: isDark ? '1px solid rgba(74,222,128,0.1)' : 'none',
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }} aria-label="Denny Angelow">
          <span style={{ fontSize: 22 }}>🍅</span>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, color: logoColor, lineHeight: 1, transition: 'color .2s' }}>
              Denny Angelow
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: subColor, transition: 'color .2s' }}>
              Агро Консултант
            </div>
          </div>
        </a>

        <nav className="sh-nav" style={{ display: 'flex', alignItems: 'center', gap: 4 }} aria-label="Главно меню">
          {[
            ['/#produkti',     'Продукти'],
            ['/#atlas',        'Atlas Terra'],
            ['/#ginegar',      'Ginegar'],
            ['/#testimonials', 'Отзиви'],
            ['/#faq',          'Въпроси'],
          ].map(([href, label]) => (
            <a key={href} href={href} className="sh-nav-link" style={{ color: navColor }}>
              {label}
            </a>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={openCart}
            className={cartCount > 0 ? 'sh-cart-active' : ''}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 10,
              background: cartBg, color: cartColor, border: cartBorder,
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all .2s',
            }}
            aria-label={`Количка${cartCount > 0 ? ` (${cartCount})` : ''}`}
          >
            🛒 {cartCount > 0 && <strong style={{ marginRight: 2 }}>{cartCount}</strong>}
            <span>Количка</span>
          </button>
          <button
            className="sh-mob-btn"
            onClick={() => setMobileOpen(v => !v)}
            style={{
              display: 'none', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 8, border: 'none',
              background: mobBg, color: mobColor, fontSize: 18, cursor: 'pointer',
            }}
            aria-expanded={mobileOpen}
            aria-label="Мобилно меню"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <nav style={{
          position: 'fixed', top: 64, left: 0, right: 0, zIndex: 99,
          display: 'flex', flexDirection: 'column',
          padding: '8px 12px 16px', gap: 2,
          background: isDark ? 'rgba(5,26,13,0.98)' : 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(0,0,0,.06)',
          animation: 'slideDown .2s ease',
        }} aria-label="Мобилно меню">
          {[
            ['/#produkti',     'Продукти'],
            ['/#atlas',        'Atlas Terra'],
            ['/#ginegar',      'Ginegar'],
            ['/#testimonials', 'Отзиви'],
            ['/#faq',          'Въпроси'],
          ].map(([href, label]) => (
            <a
              key={href} href={href}
              onClick={() => setMobileOpen(false)}
              style={{
                padding: '11px 14px', borderRadius: 10, fontSize: 15, fontWeight: 600,
                textDecoration: 'none',
                color: isDark ? 'rgba(255,255,255,.8)' : '#1b4332',
              }}
            >
              {label}
            </a>
          ))}
        </nav>
      )}

      {/* 64px spacer за fixed header */}
      <div style={{ height: 64 }} aria-hidden="true" />
    </>
  )
}
