'use client'
// app/admin/components/EmailTab.tsx — v2
//
// ПОПРАВКИ v2 (спрямо v1):
//   ✅ НОВ подтаб "📝 Темплейти" (EmailTemplatesTab.tsx) — Фаза 3, админ-
//      редактируеми текстове на писмата, до "⚙️ Автоматизации" в менюто.
//
// Едно "място" за всичко, свързано с имейлите — вместо два отделни sidebar
// бутона (Email листа / Email статистики) плюс Automations заровени в
// Маркетинг. Хората (Листа) вътрешно е първи подтаб, машината около тях
// (Статистики/Автоматизации/Темплейти) — до нея, но всичко зад една врата
// в менюто.
//
// Same модел като вътрешния section switcher на MarketingTab.tsx, но
// самостоятелен, лек компонент — не преизползва неговите CSS класове
// (.mkt-tab), за да няма скрита зависимост между двата файла.

import { useState } from 'react'
import { LeadsTab } from './LeadsTab'
import { EmailStatsTab } from './EmailStatsTab'
import { AutomationsTab } from './AutomationsTab'
import { EmailTemplatesTab } from './EmailTemplatesTab'
import type { Lead } from '@/lib/supabase'

interface Props {
  leads: Lead[]
}

const SECTIONS = [
  { id: 'leads',        label: '👥 Листа' },
  { id: 'stats',        label: '📊 Статистики' },
  { id: 'automations',  label: '⚙️ Автоматизации' },
  { id: 'templates',    label: '📝 Темплейти' },
] as const
type Section = typeof SECTIONS[number]['id']

export function EmailTab({ leads }: Props) {
  const [section, setSection] = useState<Section>('leads')

  return (
    <div>
      <div style={{
        display: 'flex', gap: 6, padding: '16px 14px 0',
        borderBottom: '1px solid var(--border)', marginBottom: 0,
      }}>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            style={{
              padding: '10px 16px', borderRadius: '8px 8px 0 0', border: 'none',
              borderBottom: section === s.id ? '2px solid #1b4332' : '2px solid transparent',
              background: 'none', cursor: 'pointer',
              fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
              color: section === s.id ? '#1b4332' : '#9ca3af',
              marginBottom: -1, transition: 'color .15s',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'leads'       && <LeadsTab leads={leads} />}
      {section === 'stats'       && <EmailStatsTab />}
      {section === 'automations' && <AutomationsTab />}
      {section === 'templates'   && <EmailTemplatesTab />}
    </div>
  )
}
