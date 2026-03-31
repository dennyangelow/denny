'use client'
// hooks/useCartPersistence.ts
// Запазва количката в localStorage и я възстановява при refresh
// Използвай го в CartSystem.tsx

import { useState, useEffect, useCallback } from 'react'

export interface CartItem {
  id: string          // variant id or product id
  product_id: string
  product_name: string
  variant_label?: string
  quantity: number
  unit_price: number
  image?: string
}

const CART_KEY = 'denny_cart_v2'
const CART_TTL = 7 * 24 * 60 * 60 * 1000 // 7 дни в ms

interface StoredCart {
  items: CartItem[]
  savedAt: number
}

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (!raw) return []
    const parsed: StoredCart = JSON.parse(raw)
    // Изтекла количка
    if (Date.now() - parsed.savedAt > CART_TTL) {
      localStorage.removeItem(CART_KEY)
      return []
    }
    return Array.isArray(parsed.items) ? parsed.items : []
  } catch {
    return []
  }
}

function saveCart(items: CartItem[]) {
  if (typeof window === 'undefined') return
  try {
    const data: StoredCart = { items, savedAt: Date.now() }
    localStorage.setItem(CART_KEY, JSON.stringify(data))
  } catch {
    // localStorage може да е запълнен
  }
}

export function useCartPersistence() {
  const [items, setItemsState] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Зареди от localStorage при mount (само client-side)
  useEffect(() => {
    const saved = loadCart()
    setItemsState(saved)
    setHydrated(true)
  }, [])

  const setItems = useCallback((updater: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    setItemsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveCart(next)
      return next
    })
  }, [])

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id)
      if (existing) {
        return prev.map(i => i.id === item.id
          ? { ...i, quantity: i.quantity + item.quantity }
          : i
        )
      }
      return [...prev, item]
    })
  }, [setItems])

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }, [setItems])

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id)
      return
    }
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i))
  }, [setItems, removeItem])

  const clearCart = useCallback(() => {
    setItems([])
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CART_KEY)
    }
  }, [setItems])

  const total = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  const count = items.reduce((sum, i) => sum + i.quantity, 0)

  return {
    items,
    setItems,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    total,
    count,
    hydrated, // true след като localStorage е заредено
  }
}
