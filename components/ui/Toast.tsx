'use client'
// components/ui/Toast.tsx

import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: string
  message: string
  type: ToastType
}

// Simple global toast store
type Listener = (toasts: ToastMessage[]) => void
let toasts: ToastMessage[] = []
const listeners = new Set<Listener>()

function notify() {
  listeners.forEach(l => l([...toasts]))
}

export const toast = {
  success: (message: string) => {
    const id = Math.random().toString(36).slice(2)
    toasts = [...toasts, { id, message, type: 'success' }]
    notify()
    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== id)
      notify()
    }, 3500)
  },
  error: (message: string) => {
    const id = Math.random().toString(36).slice(2)
    toasts = [...toasts, { id, message, type: 'error' }]
    notify()
    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== id)
      notify()
    }, 4500)
  },
  info: (message: string) => {
    const id = Math.random().toString(36).slice(2)
    toasts = [...toasts, { id, message, type: 'info' }]
    notify()
    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== id)
      notify()
    }, 3000)
  },
}

export function ToastContainer() {
  const [list, setList] = useState<ToastMessage[]>([])

  useEffect(() => {
    const listener: Listener = (t) => setList(t)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  if (list.length === 0) return null

  return (
    <>
      <style>{`
        .toast-wrap {
          position: fixed; bottom: 24px; right: 24px; z-index: 9999;
          display: flex; flex-direction: column; gap: 10px;
          pointer-events: none;
        }
        .toast {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 18px; border-radius: 10px;
          font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
          pointer-events: auto;
          animation: toast-in .25s cubic-bezier(.34,1.56,.64,1);
          max-width: 340px; box-shadow: 0 4px 20px rgba(0,0,0,.15);
        }
        .toast-success { background: #065f46; color: #d1fae5; }
        .toast-error   { background: #991b1b; color: #fee2e2; }
        .toast-info    { background: #1e3a5f; color: #dbeafe; }
        .toast-icon    { font-size: 16px; flex-shrink: 0; }
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(20px) scale(.95); }
          to   { opacity: 1; transform: translateX(0)    scale(1);   }
        }
      `}</style>
      <div className="toast-wrap">
        {list.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-icon">
              {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </>
  )
}
