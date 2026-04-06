// app/admin/components/rangeUtils.ts
// Единствен source of truth за range логиката
// Използва се от DashboardTab и AnalyticsTab

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

/**
 * ISO date string на началото на периода.
 * range=1   → днес (yyyy-mm-dd)
 * range=N   → преди N дни
 * range=all → null (без cutoff)
 */
export function getCutoff(range: Range): string | null {
  if (range === 'all') return null
  const d = new Date()
  if (range === 1) return d.toISOString().slice(0, 10)
  d.setDate(d.getDate() - (range as number))
  return d.toISOString().slice(0, 10)
}

/**
 * Предходен период за trend сравнение.
 * Например за 30д → от -60д до -30д.
 */
export function getPrevCutoff(range: Range): { start: string; end: string } | null {
  if (range === 'all' || range === 1) return null
  const now = new Date()
  const end = new Date(now)
  end.setDate(end.getDate() - (range as number))
  const start = new Date(end)
  start.setDate(start.getDate() - (range as number))
  return {
    start: start.toISOString().slice(0, 10),
    end:   end.toISOString().slice(0, 10),
  }
}

/** Филтрира масив по range */
export function filterByRange<T extends { created_at: string }>(items: T[], range: Range): T[] {
  const cutoff = getCutoff(range)
  if (!cutoff) return items
  if (range === 1) return items.filter(o => o.created_at.slice(0, 10) === cutoff)
  return items.filter(o => o.created_at.slice(0, 10) >= cutoff)
}

/** Предходен период */
export function filterPrevPeriod<T extends { created_at: string }>(items: T[], range: Range): T[] {
  const prev = getPrevCutoff(range)
  if (!prev) return []
  return items.filter(o => {
    const d = o.created_at.slice(0, 10)
    return d >= prev.start && d < prev.end
  })
}

/**
 * Строи daily/monthly revenue chart.
 * Приема вече филтрирани поръчки.
 */
export function buildRevenueChart(
  filteredOrders: { created_at: string; total: any; status: string }[],
  range: Range
): { date: string; revenue: number }[] {
  const map: Record<string, number> = {}
  filteredOrders
    .filter(o => o.status !== 'cancelled')
    .forEach(o => {
      const d = o.created_at.slice(0, 10)
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
    const d = new Date(now.getTime() - (days - 1 - i) * 86400000).toISOString().slice(0, 10)
    return { date: d.slice(5), revenue: map[d] || 0 }
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
