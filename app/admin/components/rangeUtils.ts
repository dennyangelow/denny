// app/admin/components/rangeUtils.ts — v2 (timezone fix)
// ✅ ПОПРАВКИ v2:
//   - toBulgarianDateStr() — всички дати се изчисляват в БГ часова зона (UTC+2/+3)
//   - getCutoff() вече връща правилна БГ дата (не UTC)
//   - filterByRange range=1 сравнява БГ дати, не UTC дати
//   - buildRevenueChart ползва БГ дати за генериране на масива с дни
//   - buildRevenueChartHourly (в AnalyticsTab) трябва да ползва getBulgarianHour()
//   - getXAxisInterval, calcTrend — непроменени

export type Range = 1 | 7 | 30 | 90 | 365 | 'all'

export const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: 1,     label: 'Днес'   },
  { value: 7,     label: '7д'     },
  { value: 30,    label: '30д'    },
  { value: 90,    label: '90д'    },
  { value: 365,   label: '1г'     },
  { value: 'all', label: 'Всичко' },
]

export function getRangeLabel(range: Range): string {
  return RANGE_OPTIONS.find(o => o.value === range)?.label ?? String(range)
}

// ─── Timezone helpers ─────────────────────────────────────────────────────────
// България е UTC+2 зима / UTC+3 лято (DST).
// Всички сравнения "днес" и "преди N дни" трябва да ползват БГ локалното време.

/**
 * Връща "yyyy-mm-dd" за дадена дата в БГ timezone.
 * Ако d не е подаден, ползва текущия момент.
 */
export function toBulgarianDateStr(d?: Date): string {
  const date = d ?? new Date()
  // 'bg-BG' locale с 'Europe/Sofia' timezone — работи навсякъде
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Sofia' })
  // en-CA дава ISO формат yyyy-mm-dd директно
}

/**
 * Връща час (0-23) в БГ timezone за дадена дата.
 */
export function toBulgarianHour(d: Date): number {
  const str = d.toLocaleTimeString('en-GB', { timeZone: 'Europe/Sofia', hour: '2-digit', hour12: false })
  return parseInt(str.slice(0, 2), 10)
}

/**
 * Текущ час (0-23) в БГ timezone.
 */
export function getCurrentBulgarianHour(): number {
  return toBulgarianHour(new Date())
}

// ─── Cutoff логика ────────────────────────────────────────────────────────────

/**
 * ISO date string на началото на периода в БГ timezone.
 * range=1   → днес в БГ (yyyy-mm-dd)
 * range=N   → преди N дни в БГ
 * range=all → null (без cutoff)
 */
export function getCutoff(range: Range): string | null {
  if (range === 'all') return null
  const now = new Date()
  if (range === 1) return toBulgarianDateStr(now)
  // Изваждаме N дни: правим нова дата без timezone drift
  const d = new Date(now)
  d.setDate(d.getDate() - (range as number))
  return toBulgarianDateStr(d)
}

/**
 * Предходен период за trend сравнение.
 * Например за 30д → от -60д до -30д в БГ timezone.
 */
export function getPrevCutoff(range: Range): { start: string; end: string } | null {
  if (range === 'all' || range === 1) return null
  const now = new Date()
  const end = new Date(now)
  end.setDate(end.getDate() - (range as number))
  const start = new Date(end)
  start.setDate(start.getDate() - (range as number))
  return {
    start: toBulgarianDateStr(start),
    end:   toBulgarianDateStr(end),
  }
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

/**
 * Взима БГ дата от created_at string (може да е UTC ISO string от Supabase).
 * Пример: "2024-06-15T22:30:00.000Z" → "2024-06-16" (в UTC+3 летно)
 */
function getLocalDateFromCreatedAt(created_at: string): string {
  return new Date(created_at).toLocaleDateString('en-CA', { timeZone: 'Europe/Sofia' })
}

/** Филтрира масив по range, с правилни БГ дати */
export function filterByRange<T extends { created_at: string }>(items: T[], range: Range): T[] {
  const cutoff = getCutoff(range)
  if (!cutoff) return items
  if (range === 1) {
    // "Днес" в БГ timezone
    return items.filter(o => getLocalDateFromCreatedAt(o.created_at) === cutoff)
  }
  return items.filter(o => getLocalDateFromCreatedAt(o.created_at) >= cutoff)
}

/** Предходен период */
export function filterPrevPeriod<T extends { created_at: string }>(items: T[], range: Range): T[] {
  const prev = getPrevCutoff(range)
  if (!prev) return []
  return items.filter(o => {
    const d = getLocalDateFromCreatedAt(o.created_at)
    return d >= prev.start && d < prev.end
  })
}

/**
 * Строи daily/monthly revenue chart.
 * Приема вече филтрирани поръчки.
 * Всички дати са в БГ timezone.
 */
export function buildRevenueChart(
  filteredOrders: { created_at: string; total: any; status: string }[],
  range: Range
): { date: string; revenue: number }[] {
  const map: Record<string, number> = {}
  filteredOrders
    .filter(o => o.status !== 'cancelled')
    .forEach(o => {
      const d = getLocalDateFromCreatedAt(o.created_at)
      map[d] = (map[d] || 0) + Number(o.total)
    })

  const now = new Date()

  if (range === 'all') {
    const monthMap: Record<string, number> = {}
    Object.entries(map).forEach(([d, v]) => {
      const m = d.slice(0, 7)
      monthMap[m] = (monthMap[m] || 0) + v
    })
    return Object.entries(monthMap).sort().map(([date, revenue]) => ({ date, revenue }))
  }

  const days = range as number
  return Array.from({ length: days }, (_, i) => {
    // Генерираме дати в БГ timezone
    const d = new Date(now)
    d.setDate(d.getDate() - (days - 1 - i))
    const dateStr = toBulgarianDateStr(d)
    return { date: dateStr.slice(5), revenue: map[dateStr] || 0 } // показваме MM-DD
  })
}

/** X-axis интервал за да не се препокриват лейбъли */
export function getXAxisInterval(range: Range): number {
  if (range === 1)   return 0
  if (range === 7)   return 0
  if (range === 30)  return 5
  if (range === 90)  return 14
  if (range === 365) return 30
  return 2
}

/** Изчислява % промяна */
export function calcTrend(current: number, prev: number): number | null {
  if (prev === 0) return null
  return ((current - prev) / prev) * 100
}
