'use client'
// components/client/OutOfStockBadge.tsx — v2
// ✅ ПРОМЯНА: isVariantOutOfStock и isProductOutOfStock изнесени в lib/stock-utils.ts
//    (pure функции без UI — могат да се ползват от server components и API routes)
// ✅ Re-export-ват се за backward compatibility — никой import не се чупи.

import React from 'react'

// ── Re-exports за backward compatibility ─────────────────────────────────────
// Ако имаш код, който импортира isVariantOutOfStock/isProductOutOfStock от тук,
// той продължава да работи без промяна.
export { isVariantOutOfStock, isProductOutOfStock } from '@/lib/stock-utils'
export type { StockVariant, StockProduct } from '@/lib/stock-utils'

// ── OutOfStockButton компонент ────────────────────────────────────────────────
// Замества бутона "Добави в количката" когато продуктът е изчерпан
export function OutOfStockButton({
  style,
  className,
}: {
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <button
      disabled
      className={className}
      style={{
        width: '100%',
        padding: '14px 20px',
        borderRadius: 12,
        border: '1.5px solid #e5e7eb',
        background: '#f3f4f6',
        color: '#9ca3af',
        fontSize: 15,
        fontWeight: 700,
        fontFamily: 'inherit',
        cursor: 'not-allowed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        ...style,
      }}
    >
      <span style={{ fontSize: 18 }}>⛔</span>
      Изчерпан
    </button>
  )
}

// ── OutOfStockBadge компонент ─────────────────────────────────────────────────
// Малък badge за показване върху продуктовата карта
export function OutOfStockBadge({
  position = 'top-right',
}: {
  position?: 'top-right' | 'top-left' | 'inline'
}) {
  const posStyle: React.CSSProperties =
    position === 'top-right' ? { position: 'absolute', top: 10, right: 10, zIndex: 10 } :
    position === 'top-left'  ? { position: 'absolute', top: 10, left:  10, zIndex: 10 } :
    {}

  return (
    <div style={{
      ...posStyle,
      background:    '#dc2626',
      color:         '#fff',
      fontSize:       11,
      fontWeight:     800,
      padding:       '4px 10px',
      borderRadius:   99,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      boxShadow:     '0 2px 8px rgba(220,38,38,0.35)',
      display:       'inline-flex',
      alignItems:    'center',
      gap:            4,
    }}>
      ⛔ Изчерпан
    </div>
  )
}
