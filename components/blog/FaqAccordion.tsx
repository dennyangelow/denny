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
            {/* ✅ ФИКС: преди отговорът се монтираше в DOM-а САМО когато
                isOpen === true ({isOpen && <p>...}) — при първо рендиране
                (open === null за всички) НИТО ЕДИН отговор не съществуваше
                в HTML-а на страницата, само въпросите. Googlebot изпълнява
                JS, но не кликa акордеони — значи текстът на отговорите
                реално не се индексираше от самата страница (само през
                FAQPage JSON-LD schema-та в page.tsx, което не е същото
                като видим, четим от Google текст в тялото на статията).
                Сега <p> винаги е в DOM-а; само визуално се крие/показва
                през display — Google официално третира скрито зад
                accordion съдържание еднакво с видимото. */}
            <p
              id={panelId}
              className="bp-faq-a"
              role="region"
              style={{ display: isOpen ? 'block' : 'none' }}
            >
              {renderRichText(item.a)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
