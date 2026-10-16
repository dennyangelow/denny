'use client'
// app/admin/components/InternalDeviceCard.tsx — v1
// Маркира УСТРОЙСТВОТО (браузъра), от което си влязъл в админ панела, като "мое":
// посещенията, афилиейт кликовете и събитията от количката му не влизат в статистиките
// (PageViewTracker / trackAffiliateClick / trackProductEvent четат localStorage 'da_internal').
//
//   • useAutoMarkAdminDevice() — вика се веднъж в AdminPage. При ВСЯКО успешно влизане в админа
//     маркира устройството автоматично (ако не си го изключил ръчно).
//   • <InternalDeviceCard /> — показва състоянието + бутон за превключване (напр. когато искаш да
//     тестваш сайта като истински посетител). Показва и текущия IP — САМО за информация:
//     маркирането е по устройство, не по IP, така че смяна на IP не изисква нищо.
//
// Стойности на 'da_internal':  '1' = маркирано · '0' = изрично изключено · липсва = още не е решавано.

import { useCallback, useEffect, useState } from 'react'

const KEY = 'da_internal'

function read(): string | null {
  try { return localStorage.getItem(KEY) } catch { return null }
}
function write(v: '1' | '0'): boolean {
  try { localStorage.setItem(KEY, v); return true } catch { return false }
}

/** Маркира устройството, ако още не е решавано (не пипа '0' — ръчно изключено). Безопасно за повторно викане. */
function ensureMarked() {
  if (read() === null) write('1')
}

/** Автоматично маркиране при влизане в админа (не пипа, ако си го изключил ръчно). */
export function useAutoMarkAdminDevice() {
  useEffect(() => { ensureMarked() }, [])
}

export function InternalDeviceCard() {
  const [marked, setMarked]   = useState<boolean | null>(null)   // null = още се чете
  const [storageOk, setOk]    = useState(true)
  const [ip, setIp]           = useState<string | null>(null)
  const [ipError, setIpError] = useState(false)

  useEffect(() => {
    // Ефектите на децата се изпълняват ПРЕДИ тези на родителя — затова картата сама гарантира
    // маркирането, преди да прочете състоянието (иначе показваше "не е маркирано" при първо влизане).
    ensureMarked()
    setMarked(read() === '1')
    try { localStorage.getItem(KEY) } catch { setOk(false) }
    fetch('/api/admin/whoami', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setIp(typeof d.ip === 'string' ? d.ip : null))
      .catch(() => setIpError(true))
  }, [])

  const toggle = useCallback(() => {
    if (write(read() === '1' ? '0' : '1')) setMarked(read() === '1')   // източник на истината е localStorage
    else setOk(false)
  }, [])

  const on = marked === true

  return (
    <div style={{ margin: '20px 24px 0', maxWidth: 760 }}>
      <div style={{
        background: '#fff', border: `1px solid ${on ? '#bbf7d0' : '#e5e7eb'}`, borderRadius: 14,
        padding: '16px 18px', fontFamily: "var(--font-dm-sans),sans-serif",
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 22 }}>{marked === null ? '…' : on ? '✅' : '⚪'}</span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>
              Това устройство {on ? 'е маркирано като твое' : 'не е маркирано'}
            </div>
            <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 2, lineHeight: 1.5 }}>
              {on
                ? 'Посещенията, кликовете и събитията от количката, които правиш от този браузър, не влизат в статистиките.'
                : 'Твоите посещения от този браузър се броят като на всеки посетител (удобно, когато тестваш сайта като клиент).'}
            </div>
          </div>
          <button onClick={toggle} disabled={marked === null || !storageOk}
            style={{
              padding: '8px 14px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
              border: `1px solid ${on ? '#e5e7eb' : '#2d6a4f'}`, background: on ? '#fff' : '#2d6a4f', color: on ? '#374151' : '#fff',
              opacity: marked === null || !storageOk ? .5 : 1,
            }}>
            {on ? 'Изключи маркирането' : 'Маркирай това устройство'}
          </button>
        </div>

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6', fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
          <div>
            Текущ IP: <strong style={{ color: '#111827', fontFamily: 'monospace' }}>
              {ip ?? (ipError ? 'не може да се разчете' : '…')}
            </strong>{' '}
            <span style={{ color: '#9ca3af' }}>(само за информация — маркирането е по устройство, не по IP, затова смяна на IP не иска нищо)</span>
          </div>
          <div style={{ marginTop: 4 }}>
            Маркирането е за <strong>този браузър</strong>. Влез в админа от всеки браузър и телефон, които ползваш
            (Chrome, Opera, телефон) и те се маркират сами. Изчистиш ли данните на сайта или влезеш инкогнито, влез пак в админа.
            Отваряй админа на същия адрес, на който е публичният сайт (с или без www), иначе браузърът ги води за различни.
          </div>
          {!storageOk && (
            <div style={{ marginTop: 6, color: '#b45309' }}>
              ⚠️ Браузърът блокира запазването на данни за сайта — маркирането не може да работи тук.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
