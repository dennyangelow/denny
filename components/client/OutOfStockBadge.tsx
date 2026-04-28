'use client'
// components/client/OutOfStockBadge.tsx
// Независим компонент — използва се от CartSystem за показване на "Изчерпан" статус
// Може да се вмъкне директно в CartSystem вместо бутона "Добави в количката"

import React from 'react'

// ── Типове ───────────────────────────────────────────────────────────────────
interface ProductVariant {
  id: string
  label: string
  stock: number
  active: boolean
  price: number
  compare_price: number
  size_liters: number
  price_per_liter: number
  product_id: string
  sort_order: number
}

interface AtlasProductWithStock {
  id: string
  name: string
  outOfStock?: boolean
  stock?: number
  variants?: ProductVariant[]
}

// ── Helper: проверява дали конкретен вариант е изчерпан ───────────────────────
export function isVariantOutOfStock(variant: ProductVariant): boolean {
  return variant.stock === 0
}

// ── Helper: проверява дали продукт (с или без варианти) е изчерпан ────────────
export function isProductOutOfStock(product: AtlasProductWithStock, selectedVariantId?: string): boolean {
  // Ако има outOfStock флаг от сървъра — ползваме него
  if (product.outOfStock !== undefined) {
    // Ако е избран конкретен вариант — проверяваме само него
    if (selectedVariantId && product.variants) {
      const variant = product.variants.find(v => v.id === selectedVariantId)
      if (variant) return isVariantOutOfStock(variant)
    }
    return product.outOfStock
  }
  // Fallback: проверяваме variants
  if (product.variants && product.variants.length > 0) {
    if (selectedVariantId) {
      const variant = product.variants.find(v => v.id === selectedVariantId)
      return variant ? variant.stock === 0 : false
    }
    return product.variants.filter(v => v.active).every(v => v.stock === 0)
  }
  return (product.stock ?? 1) === 0
}

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
      background: '#dc2626',
      color: '#fff',
      fontSize: 11,
      fontWeight: 800,
      padding: '4px 10px',
      borderRadius: 99,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      boxShadow: '0 2px 8px rgba(220,38,38,0.35)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
    }}>
      ⛔ Изчерпан
    </div>
  )
}
