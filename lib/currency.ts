// lib/currency.ts
// Централен helper за форматиране на цени
// Чете currency_symbol от settings таблицата в Supabase
// Използвай навсякъде: import { formatPrice, getCurrencySymbol } from '@/lib/currency'

import { supabaseAdmin } from '@/lib/supabase'

// ── Server-side: чете директно от БД (за Server Components и API routes) ──────
let _cachedSymbol: string | null = null
let _cacheTime = 0
const CACHE_TTL = 60_000 // 1 минута кеш

export async function getCurrencySymbol(): Promise<string> {
  const now = Date.now()
  if (_cachedSymbol && now - _cacheTime < CACHE_TTL) return _cachedSymbol

  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'currency_symbol')
      .single()

    _cachedSymbol = data?.value || '€'
    _cacheTime = now
    return _cachedSymbol
  } catch {
    return '€'
  }
}

// Server-side formatPrice (async — за Server Components)
export async function formatPriceAsync(amount: number): Promise<string> {
  const symbol = await getCurrencySymbol()
  return `${Number(amount).toFixed(2)} ${symbol}`
}

// ── Sync версия с подаден символ (за Client Components) ──────────────────────
// Използвай когато вече имаш currency_symbol от settings (подаден като prop)
export function formatPrice(amount: number, symbol = '€'): string {
  return `${Number(amount).toFixed(2)} ${symbol}`
}

export function formatPriceLiter(pricePerLiter: number, symbol = '€'): string {
  return `${Number(pricePerLiter).toFixed(2)} ${symbol}/л`
}
