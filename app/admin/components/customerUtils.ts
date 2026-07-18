// app/admin/components/customerUtils.ts
// Огледало на normalize_bg_phone() от SQL миграцията — за да групираме
// поръчки по клиент и на фронтенда без extra DB round-trip.

/**
 * Нормализира БГ телефонен номер до последните 9 цифри.
 * "0888123456", "+359888123456", "359 888 123 456" → "888123456"
 */
export function normalizeBgPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('359')) digits = digits.slice(3)
  else if (digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length > 9) digits = digits.slice(-9)
  return digits
}

/** Групира произволен масив от поръчки по нормализиран телефон на клиента. */
export function groupOrdersByCustomer<T extends { customer_phone: string }>(
  orders: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const o of orders) {
    const key = normalizeBgPhone(o.customer_phone) ?? o.customer_phone
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(o)
  }
  return map
}

/** Брой предишни поръчки на клиента (без текущата), полезно за бадж до името. */
export function customerOrderCount<T extends { customer_phone: string }>(
  order: T,
  allOrders: T[]
): number {
  const key = normalizeBgPhone(order.customer_phone)
  if (!key) return 1
  return allOrders.filter(o => normalizeBgPhone(o.customer_phone) === key).length
}
