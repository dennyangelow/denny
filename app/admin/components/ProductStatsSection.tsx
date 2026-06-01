'use client'
// app/admin/components/ProductStatsSection.tsx — v1
// "Продадени продукти" секция с date range picker
//
// USAGE в OrdersTab.tsx:
//   1. Импортирай: import { ProductStatsSection } from './ProductStatsSection'
//   2. Замести целия блок {productStats.totalTubes > 0 && ( ... )} с:
//      <ProductStatsSection orders={orders} formatPrice={formatPrice} />
//
// Компонентът е standalone — приема ВСИЧКИ orders и сам филтрира по избрания период.

import { useState, useMemo } from 'react'
import { toBulgarianDateStr } from './rangeUtils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  product_name?: string
  quantity?: number | string
  total_price?: number | string
}

interface Order {
  created_at: string
  status: string
  order_items?: OrderItem[]
}

type PresetKey = 'today' | '7d' | '30d' | '90d' | '365d' | 'all' | 'custom'

interface Preset {
  key: PresetKey
  label: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESETS: Preset[] = [
  { key: 'today', label: 'Днес'    },
  { key: '7d',    label: '7 дни'   },
  { key: '30d',   label: '30 дни'  },
  { key: '90d',   label: '3 месеца'},
  { key: '365d',  label: '1 година'},
  { key: 'all',   label: 'Всичко'  },
  { key: 'custom',label: 'По дати' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bgDateNDaysAgo(days: number): string {
  const now = new Date()
  const todayBg = toBulgarianDateStr(now)
  const utcMid  = new Date(todayBg + 'T00:00:00Z')
  utcMid.setUTCDate(utcMid.getUTCDate() - days)
  return toBulgarianDateStr(utcMid)
}

function getLocalDate(created_at: string): string {
  return new Date(created_at).toLocaleDateString('en-CA', { timeZone: 'Europe/Sofia' })
}

function getPresetRange(preset: PresetKey): { start: string | null; end: string | null } {
  const today = toBulgarianDateStr()
  if (preset === 'all')    return { start: null, end: null }
  if (preset === 'today')  return { start: today, end: today }
  if (preset === '7d')     return { start: bgDateNDaysAgo(6), end: today }
  if (preset === '30d')    return { start: bgDateNDaysAgo(29), end: today }
  if (preset === '90d')    return { start: bgDateNDaysAgo(89), end: today }
  if (preset === '365d')   return { start: bgDateNDaysAgo(364), end: today }
  return { start: null, end: null } // custom — handled separately
}

function formatDateBG(isoDate: string): string {
  // "2026-01-15" → "15 яну 2026"
  const [y, m, d] = isoDate.split('-')
  const months = ['яну','фев','мар','апр','май','юни','юли','авг','сеп','окт','ное','дек']
  return `${d} ${months[parseInt(m) - 1]} ${y}`
}

// ─── Product analysis ─────────────────────────────────────────────────────────

function analyzeProducts(orders: Order[]) {
  function detectSize(name: string): '5L' | '20L' | 'other' {
    if (/20\s*литра/i.test(name) || /20L/i.test(name)) return '20L'
    if (/5\s*литра/i.test(name)  || /5L/i.test(name))  return '5L'
    return 'other'
  }
  function detectLine(name: string): 'AMINO' | 'NITRO' | 'Terra' | 'other' {
    if (/AMINO/i.test(name)) return 'AMINO'
    if (/NITRO/i.test(name)) return 'NITRO'
    if (/Terra/i.test(name)) return 'Terra'
    return 'other'
  }

  let tubes5L = 0, tubes20L = 0, totalLiters = 0
  const breakdown: Record<string, { name: string; qty: number; revenue: number; size: string; line: string }> = {}

  orders
    .filter(o => o.status !== 'cancelled')
    .flatMap(o => o.order_items || [])
    .forEach(item => {
      const qty     = Number(item.quantity) || 1
      const price   = Number(item.total_price) || 0
      const rawName = item.product_name || ''
      const name    = rawName.replace(/^\[(POST-PURCHASE|UPSELL|CROSS)\]\s*/i, '').trim()
      const size    = detectSize(name)
      const line    = detectLine(name)

      if (size === '5L')  { tubes5L  += qty; totalLiters += qty * 5  }
      if (size === '20L') { tubes20L += qty; totalLiters += qty * 20 }

      const key = `${line}_${size}`
      let shortName = ''
      if (line === 'AMINO')  shortName = size === '20L' ? 'Atlas Terra AMINO 20л' : 'Atlas Terra AMINO 5л'
      else if (line === 'NITRO')  shortName = size === '20L' ? 'Atlas Terra NITRO 20л' : 'Atlas Terra NITRO 5л'
      else if (line === 'Terra')  shortName = size === '20L' ? 'Atlas Terra 20л' : 'Atlas Terra 5л'
      else shortName = name.slice(0, 40)

      if (!breakdown[key]) breakdown[key] = { name: shortName, qty: 0, revenue: 0, size, line }
      breakdown[key].qty     += qty
      breakdown[key].revenue += price
    })

  return {
    tubes5L, tubes20L, totalLiters,
    totalTubes: tubes5L + tubes20L,
    breakdown: Object.values(breakdown).sort((a, b) => b.qty - a.qty),
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  orders:      Order[]
  formatPrice: (n: number) => string
}

export function ProductStatsSection({ orders, formatPrice }: Props) {
  const today = toBulgarianDateStr()

  const [preset,     setPreset]     = useState<PresetKey>('all')
  const [customFrom, setCustomFrom] = useState<string>(bgDateNDaysAgo(29))
  const [customTo,   setCustomTo]   = useState<string>(today)
  const [showPicker, setShowPicker] = useState(false)

  // ── Resolve active range ──────────────────────────────────────────────────
  const activeRange = useMemo(() => {
    if (preset === 'custom') return { start: customFrom, end: customTo }
    return getPresetRange(preset)
  }, [preset, customFrom, customTo])

  // ── Filter orders by active range ─────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    const { start, end } = activeRange
    if (!start && !end) return orders
    return orders.filter(o => {
      const d = getLocalDate(o.created_at)
      if (start && d < start) return false
      if (end   && d > end)   return false
      return true
    })
  }, [orders, activeRange])

  // ── Product stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => analyzeProducts(filteredOrders), [filteredOrders])

  if (orders.length === 0) return null

  // ── Range label ───────────────────────────────────────────────────────────
  const rangeLabel = useMemo(() => {
    if (preset === 'all') return 'Всички поръчки'
    if (preset === 'today') return `Днес · ${formatDateBG(today)}`
    if (preset === 'custom') {
      if (customFrom === customTo) return formatDateBG(customFrom)
      return `${formatDateBG(customFrom)} — ${formatDateBG(customTo)}`
    }
    const { start, end } = activeRange
    if (start && end) return `${formatDateBG(start)} — ${formatDateBG(end)}`
    return ''
  }, [preset, customFrom, customTo, activeRange, today])

  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14,
      marginBottom: 20, overflow: 'hidden',
    }}>
      {/* ── Header with range picker ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid #f3f4f6',
        flexWrap: 'wrap', gap: 8,
      }}>
        {/* Left: title + range label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>📦 Продадени продукти</span>
          {rangeLabel && (
            <span style={{
              fontSize: 10, color: '#6b7280', background: '#f3f4f6',
              borderRadius: 99, padding: '2px 8px', whiteSpace: 'nowrap' as const,
            }}>
              {rangeLabel}
            </span>
          )}
        </div>

        {/* Right: summary pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { label: '5л',    value: stats.tubes5L,    color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
            { label: '20л',   value: stats.tubes20L,   color: '#0369a1', bg: '#eff6ff', border: '#bfdbfe' },
            { label: 'литри', value: stats.totalLiters, color: '#7c3aed', bg: '#f5f3ff', border: '#ede9fe' },
          ].map(p => (
            <div key={p.label} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: p.bg, border: `1px solid ${p.border}`,
              borderRadius: 99, padding: '3px 10px',
            }}>
              <span style={{ fontSize: 14, fontWeight: 900, color: p.color, lineHeight: 1 }}>{p.value}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: p.color, opacity: .75 }}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Preset buttons ── */}
      <div style={{
        display: 'flex', gap: 4, padding: '8px 16px',
        borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap' as const, alignItems: 'center',
      }}>
        {PRESETS.map(p => {
          const isActive = preset === p.key
          return (
            <button
              key={p.key}
              onClick={() => {
                setPreset(p.key)
                if (p.key === 'custom') setShowPicker(true)
                else setShowPicker(false)
              }}
              style={{
                padding: '4px 11px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                border: `1px solid ${isActive ? '#1b4332' : '#e5e7eb'}`,
                background: isActive ? '#1b4332' : '#fff',
                color: isActive ? '#fff' : '#6b7280',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all .12s',
              }}
            >
              {p.label}
            </button>
          )
        })}

        {/* Order count badge */}
        <span style={{
          marginLeft: 'auto', fontSize: 11, color: '#9ca3af',
          background: '#f9fafb', borderRadius: 99, padding: '3px 10px',
          border: '1px solid #f3f4f6',
        }}>
          {filteredOrders.filter(o => o.status !== 'cancelled').length} поръчки
        </span>
      </div>

      {/* ── Custom date picker ── */}
      {preset === 'custom' && showPicker && (
        <div style={{
          display: 'flex', gap: 10, padding: '10px 16px',
          borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap' as const,
          alignItems: 'center', background: '#fafafa',
        }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
            От:
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={e => setCustomFrom(e.target.value)}
              style={{
                padding: '5px 10px', borderRadius: 7, border: '1px solid #d1d5db',
                fontFamily: 'inherit', fontSize: 12, color: '#111',
                background: '#fff', cursor: 'pointer', outline: 'none',
              }}
            />
          </label>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
            До:
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={today}
              onChange={e => setCustomTo(e.target.value)}
              style={{
                padding: '5px 10px', borderRadius: 7, border: '1px solid #d1d5db',
                fontFamily: 'inherit', fontSize: 12, color: '#111',
                background: '#fff', cursor: 'pointer', outline: 'none',
              }}
            />
          </label>
          <button
            onClick={() => setShowPicker(false)}
            style={{
              padding: '5px 12px', borderRadius: 7, border: 'none',
              background: '#1b4332', color: '#fff', fontFamily: 'inherit',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ✓ Приложи
          </button>
          {/* Quick shortcuts */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginLeft: 8 }}>
            {[
              { label: 'Тази седмица',   from: bgDateNDaysAgo(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1), to: today },
              { label: 'Миналата седмица', from: bgDateNDaysAgo(new Date().getDay() === 0 ? 13 : new Date().getDay() + 6), to: bgDateNDaysAgo(new Date().getDay() === 0 ? 7 : new Date().getDay()) },
              { label: 'Този месец',     from: today.slice(0, 7) + '-01', to: today },
            ].map(s => (
              <button
                key={s.label}
                onClick={() => { setCustomFrom(s.from); setCustomTo(s.to) }}
                style={{
                  padding: '3px 9px', borderRadius: 99, fontSize: 10, fontWeight: 600,
                  border: '1px solid #d1fae5', background: '#ecfdf5', color: '#065f46',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── No data state ── */}
      {stats.totalTubes === 0 && (
        <div style={{ padding: '32px 16px', textAlign: 'center' as const, color: '#9ca3af' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 13 }}>Няма продадени продукти за избрания период</div>
        </div>
      )}

      {/* ── Breakdown rows ── */}
      {stats.breakdown.map((item, idx) => {
        const lineColor =
          item.line === 'AMINO' ? '#16a34a' :
          item.line === 'NITRO' ? '#2563eb' :
          item.line === 'Terra' ? '#b45309' : '#6b7280'
        const dotColor =
          item.line === 'AMINO' ? '#22c55e' :
          item.line === 'NITRO' ? '#3b82f6' :
          item.line === 'Terra' ? '#f59e0b' : '#9ca3af'
        const maxQty = stats.breakdown[0]?.qty || 1
        const pct    = Math.round(item.qty / maxQty * 100)

        return (
          <div key={`${item.line}_${item.size}`} style={{
            display: 'grid',
            gridTemplateColumns: '16px 1fr auto',
            alignItems: 'center',
            gap: 10,
            padding: '8px 16px',
            borderBottom: idx < stats.breakdown.length - 1 ? '1px solid #f9fafb' : 'none',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, margin: '0 auto' }} />

            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#111', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4,
                  background: item.size === '20L' ? '#eff6ff' : '#f0fdf4',
                  color: item.size === '20L' ? '#1d4ed8' : '#16a34a',
                  flexShrink: 0,
                }}>
                  {item.size}
                </span>
              </div>
              <div style={{ height: 3, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: dotColor, borderRadius: 99, transition: 'width .5s ease' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
              <div style={{ textAlign: 'right' as const }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: lineColor }}>{item.qty}</span>
                <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 2 }}>бр</span>
              </div>
              <div style={{ textAlign: 'right' as const, minWidth: 72 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>{formatPrice(item.revenue)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
