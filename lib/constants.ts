// lib/constants.ts

export const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  new:       { label: 'Нова',        color: '#92400e', bg: '#fef3c7' },
  confirmed: { label: 'Потвърдена',  color: '#1e40af', bg: '#dbeafe' },
  shipped:   { label: 'Изпратена',   color: '#5b21b6', bg: '#ede9fe' },
  delivered: { label: 'Доставена',   color: '#065f46', bg: '#d1fae5' },
  cancelled: { label: 'Отказана',    color: '#991b1b', bg: '#fee2e2' },
}

export const PAYMENT_LABELS: Record<string, string> = {
  cod:  'Наложен платеж',
  bank: 'Банков превод',
  card: 'Карта',
}

export const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Чака',     color: '#92400e', bg: '#fef3c7' },
  paid:     { label: 'Платена',  color: '#065f46', bg: '#d1fae5' },
  refunded: { label: 'Върната',  color: '#991b1b', bg: '#fee2e2' },
}

export const COURIER_LABELS: Record<string, { label: string; price: number }> = {
  econt:  { label: 'Еконт',  price: 5.00 },
  speedy: { label: 'Спиди', price: 5.50 },
}

export const ORDER_STATUSES = ['all', 'new', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const
export type OrderStatus = typeof ORDER_STATUSES[number]

export const NAV_ITEMS = [
  { id: 'dashboard',    icon: '▦',  label: 'Дашборд'      },
  { id: 'analytics',    icon: '▲',  label: 'Аналитика'    },
  { id: 'orders',       icon: '◫',  label: 'Поръчки'      },
  { id: 'leads',        icon: '◉',  label: 'Email листа'  },
  { id: 'content',      icon: '✦',  label: 'Продукти'   },
  { id: 'marketing', label: 'Маркетинг', icon: '📣' },
  { id: 'faq',          icon: '❓', label: 'FAQ'           },
  { id: 'testimonials', icon: '★',  label: 'Отзиви'       },
  { id: 'settings',     icon: '◈',  label: 'Настройки'    },
] as const

export type TabId = typeof NAV_ITEMS[number]['id']

// Валута — чете от settings (currency_symbol)
// За server components използвай lib/currency.ts → formatPriceAsync()
// За admin панела (client) използвай тази функция с подаден символ
export const CURRENCY = '€'  // default fallback

export function formatPrice(amount: number, symbol = '€'): string {
  return `${Number(amount).toFixed(2)} ${symbol}`
}
