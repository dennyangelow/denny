'use client'
// components/blog/FaqAccordion.tsx — v2
// ✅ ПРОМЯНА спрямо v1: отговорите (item.a) вече минават през renderRichText
//    от '@/lib/blogRichText' — поддържа [текст](линк) синтаксис, полезно
//    когато FAQ отговорът трябва да препрати към друг пост от поредицата.

import { useState } from 'react'
import { renderRichText } from '@/lib/blogRichText'

interface FaqItem { q: string; a: string }

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="bp-faq">
      {items.map((item, i) => {
        const isOpen = open === i
        const panelId = `bp-faq-panel-${i}`
        return (
          <div key={i} className="bp-faq-item">
            <button
              type="button"
              className="bp-faq-q"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <span>{item.q}</span>
              <span className={`bp-faq-icon${isOpen ? ' open' : ''}`} aria-hidden="true">+</span>
            </button>
            {isOpen && (
              <p id={panelId} className="bp-faq-a" role="region">
                {renderRichText(item.a)}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
