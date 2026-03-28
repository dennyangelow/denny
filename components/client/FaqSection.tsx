'use client'

// components/client/FaqSection.tsx
// Tabs + accordion — само тази интерактивност е client

import { useState } from 'react'
import { FadeIn } from '@/components/marketing/FadeIn'

interface FaqItem { id: string; question: string; answer: string; sort_order: number; category: string }

const TABS = [
  { id: 'atlas', label: 'Atlas Terra (10)', icon: '🌱' },
  { id: 'affiliate', label: 'Афилиейт & Ginegar (10)', icon: '🏕️' },
  { id: 'delivery', label: 'Доставка & Мен (10)', icon: '🚚' },
] as const

export function FaqSection({ faq }: { faq: FaqItem[] }) {
  const [activeFaqTab, setActiveFaqTab] = useState<'atlas' | 'affiliate' | 'delivery'>('atlas')
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  const filtered = faq.filter(item => ((item as any).category || 'atlas') === activeFaqTab)

  return (
    <section id="faq" className="section-wrap" style={{ backgroundColor: '#f9fafb', padding: '80px 20px', maxWidth: '100%' }}>
      <FadeIn>
        <div className="section-head" style={{ textAlign: 'center', marginBottom: 40 }}>
          <span className="s-tag" style={{ color: '#059669', textTransform: 'uppercase', fontSize: 14, letterSpacing: '0.05em' }}>Помощ и Информация</span>
          <h2 className="s-title" style={{ color: '#111827', fontSize: 32, marginTop: 8, marginBottom: 12 }}>Често Задавани Въпроси</h2>
          <p className="s-desc" style={{ color: '#4b5563', fontSize: 18, maxWidth: 600, margin: '0 auto' }}>Всичко за нашите продукти, доставки и партньорства</p>
        </div>
      </FadeIn>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 40, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => { setActiveFaqTab(tab.id); setOpenFaq(null) }}
            style={{ padding: '12px 24px', borderRadius: 50, border: '2px solid', borderColor: activeFaqTab === tab.id ? '#059669' : '#e5e7eb', backgroundColor: activeFaqTab === tab.id ? '#059669' : '#ffffff', color: activeFaqTab === tab.id ? '#ffffff' : '#4b5563', fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s ease', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, boxShadow: activeFaqTab === tab.id ? '0 4px 12px rgba(5,150,105,0.2)' : 'none', fontFamily: 'inherit' }}>
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <div className="faq-list" style={{ maxWidth: 850, margin: '0 auto' }}>
        {filtered.map((item, i) => {
          const isOpen = openFaq === item.id
          return (
            <FadeIn key={item.id} delay={i * 30}>
              <div className={`faq-item${isOpen ? ' faq-open' : ''}`}>
                <button onClick={() => setOpenFaq(isOpen ? null : item.id)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '20px 24px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: isOpen ? '#059669' : '#111827', fontWeight: 700, fontFamily: 'inherit', fontSize: 14.5, gap: 14 }}>
                  <span>{item.question}</span>
                  <span style={{ transition: '0.3s', transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)', flexShrink: 0 }}>+</span>
                </button>
                <div style={{ maxHeight: isOpen ? 600 : 0, opacity: isOpen ? 1 : 0, overflow: 'hidden', transition: 'all 0.35s ease-in-out' }}>
                  <div style={{ padding: '0 24px 24px', color: '#4b5563', lineHeight: 1.6 }}>{item.answer}</div>
                </div>
              </div>
            </FadeIn>
          )
        })}
      </div>
    </section>
  )
}
