'use client'
// app/admin/components/CurrencyContext.tsx
// Зарежда currency_symbol веднъж от /api/settings и го прави достъпен
// навсякъде в admin панела без да го подаваш като prop.
//
// УПОТРЕБА:
//   import { useCurrency, fmt } from '@/app/admin/components/CurrencyContext'
//   const { symbol, fmt } = useCurrency()
//   fmt(99.90)  →  "99.90 €"

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface CurrencyCtx {
  symbol: string          // '€', 'лв.', '$', ...
  fmt: (n: number) => string
  fmtLiter: (n: number) => string
}

const CurrencyContext = createContext<CurrencyCtx>({
  symbol: '€',
  fmt:     (n) => `${n.toFixed(2)} €`,
  fmtLiter:(n) => `${n.toFixed(2)} €/л`,
})

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [symbol, setSymbol] = useState('€')

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const s = data?.settings?.currency_symbol
        if (s) setSymbol(s)
      })
      .catch(() => {})
  }, [])

  const value: CurrencyCtx = {
    symbol,
    fmt:     (n) => `${Number(n).toFixed(2)} ${symbol}`,
    fmtLiter:(n) => `${Number(n).toFixed(2)} ${symbol}/л`,
  }

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}

// Standalone fmt функция за извън React (напр. в print templates)
// Приема символа като аргумент
export function fmtWithSymbol(n: number, symbol = '€') {
  return `${Number(n).toFixed(2)} ${symbol}`
}
