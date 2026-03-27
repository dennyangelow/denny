'use client'

import { useEffect, useState, useCallback } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: string
  message: string
  type: ToastType
}

type Listener = (toasts: ToastMessage[]) => void
let toasts: ToastMessage[] = []
const listeners = new Set<Listener>()

function notify() {
  listeners.forEach(l => l([...toasts]))
}

// Помощна функция за премахване
const removeToast = (id: string) => {
  toasts = toasts.filter(t => t.id !== id)
  notify()
}

export const toast = {
  success: (message: string) => {
    const id = Math.random().toString(36).slice(2, 9)
    toasts = [...toasts, { id, message, type: 'success' }]
    notify()
    setTimeout(() => removeToast(id), 4000)
  },
  error: (message: string) => {
    const id = Math.random().toString(36).slice(2, 9)
    toasts = [...toasts, { id, message, type: 'error' }]
    notify()
    setTimeout(() => removeToast(id), 6000) // Грешките седят по-дълго
  },
  info: (message: string) => {
    const id = Math.random().toString(36).slice(2, 9)
    toasts = [...toasts, { id, message, type: 'info' }]
    notify()
    setTimeout(() => removeToast(id), 3000)
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
          position: fixed; top: 24px; right: 24px; z-index: 99999;
          display: flex; flex-direction: column; gap: 12px;
          pointer-events: none;
        }
        .toast {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding: 14px 20px; border-radius: 12px;
          font-family: inherit; font-size: 14px; font-weight: 600;
          pointer-events: auto; cursor: pointer;
          animation: toast-in .3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
          max-width: 380px; min-width: 280px;
          box-shadow: 0 10px 30px -5px rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
        }
        .toast-success { background: #10b981; border-color: #059669; }
        .toast-error   { background: #ef4444; border-color: #dc2626; }
        .toast-info    { background: #3b82f6; border-color: #2563eb; }
        
        .toast-content { display: flex; align-items: center; gap: 10px; }
        .toast-close { 
          opacity: 0.6; font-size: 18px; transition: 0.2s; 
          background: none; border: none; color: white; cursor: pointer;
        }
        .toast:hover .toast-close { opacity: 1; }

        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-20px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div className="toast-wrap" role="alert" aria-live="polite">
        {list.map(t => (
          <div 
            key={t.id} 
            className={`toast toast-${t.type}`}
            onClick={() => removeToast(t.id)}
          >
            <div className="toast-content">
              <span className="toast-icon">
                {t.type === 'success' ? '✔' : t.type === 'error' ? '✖' : 'ℹ'}
              </span>
              {t.message}
            </div>
            <button className="toast-close">×</button>
          </div>
        ))}
      </div>
    </>
  )
}