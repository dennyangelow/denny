'use client'
// app/admin/components/DeleteOrdersDialog.tsx — v1
// Диалог за ТРАЕН изтрий на поръчки (единична или няколко) + по избор свързани данни.
// Първо пита сървъра (dry_run) какво точно ще бъде изтрито и го показва, чак после трие.

import { useEffect, useState } from 'react'
import type { Order } from '@/lib/supabase'
import { toast } from '@/components/ui/Toast'

interface Preview {
  orders: number
  items:  number
  customers:       { count: number; sample: string[] }
  abandoned_carts: { count: number; sample: string[] }
  leads:           { count: number; sample: string[]; kept_unsubscribed: number }
  kept_shared_keys: number
}

interface Props {
  orders:    Order[]
  onClose:   () => void
  onDeleted: (deletedIds: string[]) => void
}

const CONFIRM_WORD = 'ИЗТРИЙ'

export function DeleteOrdersDialog({ orders, onClose, onDeleted }: Props) {
  const [opts, setOpts] = useState({ customers: true, abandoned_carts: true, leads: true })
  const [preview, setPreview]   = useState<Preview | null>(null)
  const [loadingPreview, setLP] = useState(true)
  const [previewError, setPE]   = useState('')
  const [deleting, setDeleting] = useState(false)
  const [typed, setTyped]       = useState('')

  const ids      = orders.map(o => o.id)
  const many     = orders.length > 1
  const canGo    = !deleting && !loadingPreview && !previewError && (!many || typed.trim().toUpperCase() === CONFIRM_WORD)

  useEffect(() => {
    let cancelled = false
    setLP(true); setPE('')
    fetch('/api/orders/purge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, options: opts, dry_run: true }),
    })
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || `Грешка ${r.status}`)
        if (!cancelled) setPreview(d.preview ?? null)
      })
      .catch(e => { if (!cancelled) setPE(e?.message || 'Грешка при прегледа') })
      .finally(() => { if (!cancelled) setLP(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.customers, opts.abandoned_carts, opts.leads])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !deleting) onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose, deleting])

  const run = async () => {
    if (!canGo) return
    setDeleting(true)
    try {
      const res = await fetch('/api/orders/purge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, options: opts, dry_run: false }),
      })
      const d = await res.json().catch(() => ({}))
      const deletedIds: string[] = d.deleted_ids ?? []
      if (deletedIds.length > 0) onDeleted(deletedIds)
      if (!res.ok) throw new Error(d.error || `Грешка ${res.status}`)

      const r = d.removed || {}
      const extra = [
        r.customers       ? `${r.customers} клиент(а)` : '',
        r.abandoned_carts ? `${r.abandoned_carts} колички` : '',
        r.leads           ? `${r.leads} lead(а)` : '',
      ].filter(Boolean).join(', ')
      toast.success(`🗑 Изтрити ${deletedIds.length} поръчки${extra ? ' + ' + extra : ''}`)
      if (d.warnings?.length) toast.error(`Част от свързаните данни не се изтри: ${d.warnings.join(' | ')}`)
      onClose()
    } catch (e: any) {
      toast.error(e?.message || 'Грешка при изтриване')
    } finally {
      setDeleting(false)
    }
  }

  const row = (key: 'customers' | 'abandoned_carts' | 'leads', title: string, hint: string, p?: { count: number; sample: string[] }, extra?: string) => (
    <label key={key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer', background: opts[key] ? '#fff7f7' : '#fff' }}>
      <input type="checkbox" checked={opts[key]} disabled={deleting}
        onChange={e => setOpts(o => ({ ...o, [key]: e.target.checked }))} style={{ marginTop: 3, cursor: 'pointer' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
          {title}
          {opts[key] && p && !loadingPreview && (
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, color: p.count ? '#dc2626' : '#9ca3af' }}>
              {p.count ? `ще се изтрият: ${p.count}` : 'няма съвпадения'}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 2 }}>{hint}</div>
        {opts[key] && p && p.count > 0 && (
          <div style={{ fontSize: 11, color: '#9a3412', marginTop: 4, wordBreak: 'break-word' }}>
            {p.sample.join(', ')}{p.count > p.sample.length ? ` … и още ${p.count - p.sample.length}` : ''}
          </div>
        )}
        {opts[key] && extra && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{extra}</div>}
      </div>
    </label>
  )

  return (
    <div onClick={e => { if (e.target === e.currentTarget && !deleting) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(17,24,39,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 24 }}>🗑</span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111' }}>
            Изтриване на {many ? `${orders.length} поръчки` : 'поръчка'} завинаги
          </h2>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#6b7280' }}>
          {many
            ? orders.slice(0, 6).map(o => o.order_number).join(', ') + (orders.length > 6 ? ` … и още ${orders.length - 6}` : '')
            : `${orders[0]?.order_number} · ${orders[0]?.customer_name}`}
          {' '}— изтриването е окончателно и не може да се върне.
        </p>

        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 12 }}>
          {loadingPreview ? 'Проверявам какво ще бъде изтрито…'
            : previewError ? <span style={{ color: '#dc2626' }}>⚠️ {previewError}</span>
            : preview && <>Ще се изтрият <strong>{preview.orders}</strong> поръчки и <strong>{preview.items}</strong> артикула към тях.</>}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
          Изтрий и свързаните данни
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {row('customers', '👤 Клиентски профил', 'По телефон. Само ако клиентът няма други останали поръчки.', preview?.customers)}
          {row('abandoned_carts', '🛒 Изоставени колички', 'Само с точно същия имейл като в поръчката.', preview?.abandoned_carts)}
          {row('leads', '📧 Leads (абонати)', 'Само с точно същия имейл. Отписаните никога не се трият.', preview?.leads,
            preview && preview.leads.kept_unsubscribed > 0 ? `${preview.leads.kept_unsubscribed} отписан(и) се запазват.` : undefined)}
        </div>

        {preview && preview.kept_shared_keys > 0 && (
          <div style={{ fontSize: 11.5, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px', marginBottom: 12 }}>
            ℹ️ {preview.kept_shared_keys} телефон(а)/имейл(а) са запазени, защото клиентът има други поръчки, които остават.
          </div>
        )}

        {many && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>
              За потвърждение напиши <strong>{CONFIRM_WORD}</strong>:
            </div>
            <input value={typed} onChange={e => setTyped(e.target.value)} disabled={deleting} placeholder={CONFIRM_WORD}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontFamily: 'inherit', fontSize: 16, outline: 'none' }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={deleting}
            style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: '#374151' }}>
            Отказ
          </button>
          <button onClick={run} disabled={!canGo}
            style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: '#dc2626', color: '#fff', cursor: canGo ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, opacity: canGo ? 1 : .45 }}>
            {deleting ? 'Трие...' : '🗑 Изтрий завинаги'}
          </button>
        </div>
      </div>
    </div>
  )
}
