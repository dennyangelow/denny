// lib/stock-utils.ts — ✅ НОВО
// Pure функции за проверка на наличност — без UI, без 'use client'.
// Могат да се импортират от server components, API routes и client components.

export interface StockVariant {
  id:     string
  stock:  number
  active: boolean
}

export interface StockProduct {
  outOfStock?: boolean
  stock?:      number
  variants?:   StockVariant[]
}

/** Проверява дали конкретен вариант е изчерпан */
export function isVariantOutOfStock(variant: StockVariant): boolean {
  return variant.stock === 0
}

/**
 * Проверява дали продукт е изчерпан.
 * Ако е избран конкретен вариант — проверява само него.
 * Ако има варианти — изчерпан само ако ВСИЧКИ активни са stock=0.
 * Ако няма варианти — проверява product.stock директно.
 */
export function isProductOutOfStock(
  product: StockProduct,
  selectedVariantId?: string,
): boolean {
  // 1. Ако е избран конкретен вариант
  if (selectedVariantId && product.variants) {
    const variant = product.variants.find(v => v.id === selectedVariantId)
    if (variant) return isVariantOutOfStock(variant)
  }

  // 2. Ако има outOfStock флаг от сървъра
  if (product.outOfStock !== undefined) return product.outOfStock

  // 3. Варианти — изчерпан само ако всички активни са stock=0
  if (product.variants && product.variants.length > 0) {
    const activeOnes = product.variants.filter(v => v.active)
    if (activeOnes.length > 0) return activeOnes.every(v => v.stock === 0)
  }

  // 4. Директен stock
  return (product.stock ?? 1) === 0
}
