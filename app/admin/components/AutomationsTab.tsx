'use client'
// app/admin/components/AutomationsTab.tsx — v6
//
// ПОПРАВКИ v6 (спрямо v4):
//   ✅ Падащото меню "темплейт" на стъпка вече се пълни от РЕАЛНАТА библиотека
//      (/api/admin/email-templates — всички запазени темплейти, вкл. създадените с
//      "+ Нов темплейт"), не само от статичния списък. Преди нов темплейт нямаше
//      как да се избере в стъпка, въпреки че тостът го обещаваше. Ако заявката
//      гръмне → пада се на статичния списък. Текущият ключ на стъпката винаги е
//      в списъка (маркира се, ако липсва в библиотеката).
//   ✅ Тригерът order_placed = "Изпратена, но не доставена >24ч" (lib/automations.ts v10):
//      ново име, обяснение под тригера и банер със съответните числа.
//
// ПОПРАВКИ v4 (спрямо v3):
//   ✅ НОВО: банер "Последно пускане" (от /api/admin/automations/health) —
//      показва кога за последно е тиктал cron-ът, колко кандидати е
//      намерил (изпратени поръчки >24ч, колички >2ч) и колко писма е
//      пратил. Червено предупреждение, ако не е тиктал >2 часа или никога.
//      + бутон "▶ Пусни сега" (същото като hourly cron-а).
//   ✅ НОВО: обяснение под Тригера — прагът (2ч / 24ч) е ФИКСИРАН в
//      тригера и е отделен от забавянето на стъпка 1. "0 дни 0 ч" на
//      стъпка 1 = "прати веднага щом тригерът засече записа", не "в момента
//      на поръчката". Надписът до стъпка 1 вече го казва.
//
// ПОПРАВКИ v3 (спрямо v2):
//   ✅ ФИКС на бъг: при създаване на НОВ workflow със стъпки, втората
//      заявка (PATCH на стъпките) не проверяваше res.ok — ако гръмнеше
//      (мрежа/500), администраторът пак виждаше "✓ Запазено", а workflow-ът
//      оставаше създаден БЕЗ нито една стъпка, без никакво предупреждение.
//      Сега грешката се хваща и показва, съвместимо със save()'s catch.
//   ✅ НОВО: delay_hours вече е редактируем от тук (преди — само delay_days,
//      въпреки че lib/automations.ts и workflows/[id]/route.ts v2 отдавна
//      поддържат часове, не само дни).
//   ✅ НОВО: "⚙ Условия" редактор на стъпка — require_tag/exclude_tag/
//      min_days_since_last_order/has_bought_product/total_spent_gte/
//      require_opened_previous_step/require_clicked_previous_step/
//      skip_if_purchased_since_enrollment. Преди единственият начин да
//      зададеш условие на стъпка беше ръчно през Supabase/API — въпреки че
//      sanitizeConditions() в workflows/[id]/route.ts ги поддържа изцяло.
//      Badge до бутона показва брой зададени условия на тази стъпка.
//
// ПОПРАВКИ v2 (спрямо v1):
//   ✅ TEMPLATE_OPTIONS вече идва от lib/email-template-keys.ts (общ
//      източник с EmailTemplatesTab.tsx/app/api/admin/email-templates/*) —
//      преди живееше само тук с коментар "добавяй нов ред ВИНАГИ заедно с
//      lib/automations.ts", лесно за разминаване между два независими файла.
//
// Списъчен UI (не drag-drop canvas — виж Фаза 5 в мега плана, само ако
// наистина потрябва по-късно) за CRUD на workflows от app/api/automations/
// workflows/route.ts. Визуалният модел следва CategoryManager.tsx/
// BlogTab.tsx стила, за консистентност с останалия админ панел.

import { useState, useEffect, useCallback } from 'react'
import { toast } from '@/components/ui/Toast'
import { TEMPLATE_KEYS } from '@/lib/email-template-keys'

// ✅ v2: извлечено от lib/email-template-keys.ts — виж коментара по-горе.
//    Добавяй нов темплейт САМО там + в lib/automations.ts TEMPLATE_REGISTRY.
const TEMPLATE_OPTIONS = TEMPLATE_KEYS.map(t => ({ key: t.key, label: t.label }))
type TplOption = { key: string; label: string }

const TRIGGER_OPTIONS = [
  { value: 'naruchnik_download', label: '📗 Изтегли наръчник', ready: true },
  // ✅ НОВО — вече "poll" тригери (виж pollTriggers() в lib/automations.ts
  //    v3): само ЕДИН cron (/api/automations/tick) ги обхожда, без нужда
  //    от отделен cron job. Заглавието не е "събитие", а условие, което
  //    се проверява всеки час.
  { value: 'order_placed',       label: '📦 Изпратена, но не доставена >24ч', ready: true },
  { value: 'cart_abandoned',     label: '🛍️ Количка, изоставена >2ч', ready: true },
  { value: 'tag_added',          label: '🏷️ Добавен таг', ready: false },
  { value: 'manual',             label: '✋ Ръчно (broadcast)', ready: false },
]

// ✅ v3 — огледало на StepConditions в lib/automations.ts +
//    sanitizeConditions() whitelist-а в workflows/[id]/route.ts. Добавяй
//    нов ключ на ТРИТЕ места едновременно, иначе UI-то ще го пише, но
//    сървърът ще го изхвърля тихо (sanitizeConditions само пропуска
//    познати ключове).
interface StepConditions {
  require_tag?: string
  exclude_tag?: string
  min_days_since_last_order?: number
  has_bought_product?: string
  total_spent_gte?: number
  require_opened_previous_step?: boolean
  require_clicked_previous_step?: boolean
  skip_if_purchased_since_enrollment?: boolean
}

const CONDITION_FIELDS: { key: keyof StepConditions; label: string; type: 'text' | 'number' | 'checkbox'; hint?: string }[] = [
  { key: 'require_tag',                        label: 'Изисква таг',                                  type: 'text' },
  { key: 'exclude_tag',                        label: 'Изключва таг',                                 type: 'text' },
  { key: 'min_days_since_last_order',          label: 'Мин. дни от последна поръчка',                 type: 'number' },
  { key: 'has_bought_product',                 label: 'Купувал продукт (съдържа текст)',              type: 'text' },
  { key: 'total_spent_gte',                    label: 'Похарчено общо ≥',                             type: 'number' },
  { key: 'require_opened_previous_step',       label: 'Отворил предходното писмо',                    type: 'checkbox' },
  { key: 'require_clicked_previous_step',      label: 'Кликнал в предходното писмо',                  type: 'checkbox' },
  { key: 'skip_if_purchased_since_enrollment', label: 'Спри цялата серия ако купи междувременно',     type: 'checkbox', hint: 'Излиза от целия workflow, не само тази стъпка' },
]

interface Step {
  step_number?: number
  delay_days:   number
  delay_hours:  number
  template_key: string
  active:       boolean
  conditions?:  StepConditions
}
interface Workflow {
  id: string; name: string; trigger_type: string; trigger_config: Record<string, any>
  active: boolean; steps: Step[]
  stats: { active: number; completed: number; exited: number }
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff',
}
const btnPrimary: React.CSSProperties = {
  background: '#1b4332', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px',
  cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
}
const btnGhost: React.CSSProperties = {
  background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '9px 16px',
  cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', color: '#374151',
}

function emptyWorkflow(): Workflow {
  return { id: '', name: '', trigger_type: 'naruchnik_download', trigger_config: {}, active: false, steps: [], stats: { active: 0, completed: 0, exited: 0 } }
}

function conditionsCount(c?: StepConditions): number {
  return c ? Object.keys(c).length : 0
}

// ── Условия на стъпка — компактен inline редактор ────────────────────────────
function ConditionsEditor({ conditions, onChange }: { conditions: StepConditions; onChange: (c: StepConditions) => void }) {
  const setField = (key: keyof StepConditions, value: string | number | boolean) => {
    const next: StepConditions = { ...conditions }
    if (value === '' || value === undefined || value === false) {
      delete next[key]
    } else {
      ;(next as any)[key] = value
    }
    onChange(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 8, marginTop: 8 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>
        Изпрати тази стъпка само ако...
      </div>
      {CONDITION_FIELDS.map(f => (
        <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 12, color: '#374151', flex: 1, lineHeight: 1.3 }}>
            {f.label}
            {f.hint && <span style={{ display: 'block', fontSize: 10.5, color: '#9ca3af' }}>{f.hint}</span>}
          </label>
          {f.type === 'checkbox' ? (
            <input
              type="checkbox"
              checked={!!conditions[f.key]}
              onChange={e => setField(f.key, e.target.checked)}
              style={{ width: 18, height: 18, flexShrink: 0, cursor: 'pointer' }}
            />
          ) : (
            <input
              type={f.type}
              value={(conditions[f.key] as string | number | undefined) ?? ''}
              onChange={e => setField(f.key, f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
              style={{ ...inp, width: 170, padding: '6px 9px', fontSize: 12.5, flexShrink: 0 }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function StepEditor({ steps, onChange, pollTrigger = false, templateOptions }: { steps: Step[]; onChange: (s: Step[]) => void; pollTrigger?: boolean; templateOptions: TplOption[] }) {
  const [expandedConditions, setExpandedConditions] = useState<Set<number>>(new Set())

  const update = (i: number, patch: Partial<Step>) => onChange(steps.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  const remove = (i: number) => onChange(steps.filter((_, idx) => idx !== i))
  const add    = () => onChange([...steps, { delay_days: steps.length === 0 ? 0 : 2, delay_hours: 0, template_key: (templateOptions[0] || TEMPLATE_OPTIONS[0]).key, active: true, conditions: {} }])
  // ✅ v6 — текущият ключ винаги е в списъка, дори да липсва в библиотеката
  const optionsFor = (current: string): TplOption[] =>
    templateOptions.some(o => o.key === current) ? templateOptions : [...templateOptions, { key: current, label: `${current} (липсва в библиотеката!)` }]
  const move   = (i: number, dir: -1 | 1) => {
    const t = i + dir
    if (t < 0 || t >= steps.length) return
    const next = [...steps]
    ;[next[i], next[t]] = [next[t], next[i]]
    onChange(next)
  }
  const toggleConditions = (i: number) => setExpandedConditions(prev => {
    const n = new Set(prev)
    n.has(i) ? n.delete(i) : n.add(i)
    return n
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {steps.length === 0 && (
        <div style={{ padding: 14, background: '#f9fafb', borderRadius: 8, border: '1px dashed #e5e7eb', textAlign: 'center', fontSize: 12.5, color: '#9ca3af' }}>
          Няма стъпки — добави първата отдолу.
        </div>
      )}
      {steps.map((step, i) => {
        const condCount = conditionsCount(step.conditions)
        const isExpanded = expandedConditions.has(i)
        return (
          <div key={i} style={{ background: '#fafafa', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', width: 20, flexShrink: 0 }}>#{i + 1}</span>
              <select value={step.template_key} onChange={e => update(i, { template_key: e.target.value })} style={{ ...inp, flex: 2, minWidth: 140, padding: '7px 8px', fontSize: 12.5 }}>
                {optionsFor(step.template_key).map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <input type="number" min={0} value={step.delay_days}
                  onChange={e => update(i, { delay_days: Math.max(0, Number(e.target.value) || 0) })}
                  style={{ ...inp, width: 46, padding: '7px 6px', fontSize: 12.5, textAlign: 'center' }} />
                <span style={{ fontSize: 10.5, color: '#9ca3af' }}>дни</span>
                <input type="number" min={0} max={23} value={step.delay_hours ?? 0}
                  onChange={e => update(i, { delay_hours: Math.max(0, Math.min(23, Number(e.target.value) || 0)) })}
                  style={{ ...inp, width: 42, padding: '7px 6px', fontSize: 12.5, textAlign: 'center' }} />
                <span style={{ fontSize: 10.5, color: '#9ca3af' }}>ч{i > 0 ? ' след пред.' : (pollTrigger ? ' след засичане' : ' след тригера')}</span>
              </div>
              <button type="button" onClick={() => toggleConditions(i)}
                style={{
                  ...btnGhost, padding: '5px 10px', flexShrink: 0,
                  background: condCount > 0 ? '#dbeafe' : '#f3f4f6',
                  color: condCount > 0 ? '#1e40af' : '#374151',
                }}>
                ⚙ Условия{condCount > 0 ? ` (${condCount})` : ''}
              </button>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={{ ...btnGhost, padding: '5px 8px', opacity: i === 0 ? 0.3 : 1 }}>↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} style={{ ...btnGhost, padding: '5px 8px', opacity: i === steps.length - 1 ? 0.3 : 1 }}>↓</button>
              <button type="button" onClick={() => remove(i)} style={{ ...btnGhost, padding: '5px 8px', background: '#fee2e2', color: '#991b1b' }}>✕</button>
            </div>
            {isExpanded && (
              <ConditionsEditor
                conditions={step.conditions || {}}
                onChange={c => update(i, { conditions: c })}
              />
            )}
          </div>
        )
      })}
      <button type="button" onClick={add} style={{ ...btnGhost, alignSelf: 'flex-start' }}>+ Добави стъпка</button>
    </div>
  )
}

function WorkflowEditor({ workflow, onSaved, onCancel, templateOptions }: { workflow: Workflow; onSaved: () => void; onCancel: () => void; templateOptions: TplOption[] }) {
  const [wf, setWf]         = useState<Workflow>(workflow)
  const [saving, setSaving] = useState(false)
  const isNew = !wf.id

  const save = async () => {
    if (!wf.name.trim()) { toast.error('Името е задължително'); return }
    setSaving(true)
    try {
      if (isNew) {
        const res = await fetch('/api/automations/workflows', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: wf.name, trigger_type: wf.trigger_type, trigger_config: wf.trigger_config }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

        // ✅ v3 — ФИКС: преди тук нямаше проверка на res.ok. Ако тази втора
        // заявка гръмнеше, workflow-ът оставаше създаден БЕЗ нито една
        // стъпка, а администраторът пак виждаше "✓ Запазено" по-долу.
        if (wf.steps.length > 0) {
          const stepsRes = await fetch(`/api/automations/workflows/${data.workflow.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ steps: wf.steps }),
          })
          if (!stepsRes.ok) {
            const stepsData = await stepsRes.json().catch(() => ({}))
            throw new Error(
              stepsData.error ||
              'Workflow-ът е създаден, но стъпките не се запазиха — отвори го пак и запази наново.'
            )
          }
        }
      } else {
        const res = await fetch(`/api/automations/workflows/${wf.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: wf.name, trigger_type: wf.trigger_type, trigger_config: wf.trigger_config, steps: wf.steps }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      }
      toast.success('Запазено')
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#fff', border: '1.5px solid #2d6a4f', borderRadius: 12, padding: 18, marginBottom: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>Име</label>
          <input value={wf.name} onChange={e => setWf({ ...wf, name: e.target.value })} placeholder="напр. Naruchnik — Welcome серия" style={inp} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>Тригер</label>
          <select value={wf.trigger_type} onChange={e => setWf({ ...wf, trigger_type: e.target.value })} style={inp}>
            {TRIGGER_OPTIONS.map(t => (
              <option key={t.value} value={t.value} disabled={!t.ready && t.value !== wf.trigger_type}>
                {t.label}{!t.ready ? ' (скоро)' : ''}
              </option>
            ))}
          </select>
          {(wf.trigger_type === 'cart_abandoned' || wf.trigger_type === 'order_placed') && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 5, lineHeight: 1.5 }}>
              {wf.trigger_type === 'cart_abandoned'
                ? 'Хваща колички, недокосвани над 2 часа и още неконвертирани.'
                : 'Хваща поръчки със статус "Изпратена" от над 24 часа, още не маркирани като "Доставена". Нови/потвърдени поръчки не задействат нищо. Серията спира веднага щом поръчката стане "Доставена". Пратки, изпратени преди над 7 дни, не се пипат.'}
              {' '}Проверява се на всеки час. Забавянето на стъпка 1 се брои СЛЕД като записът е засечен — 0 дни 0 ч = прати веднага. Стъпка 2 с 1 ден = напомняне около 48-ия час.
            </div>
          )}
        </div>
      </div>

      <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 6 }}>Стъпки (имейли)</label>
      <StepEditor
        steps={wf.steps}
        onChange={steps => setWf({ ...wf, steps })}
        pollTrigger={wf.trigger_type === 'cart_abandoned' || wf.trigger_type === 'order_placed'}
        templateOptions={templateOptions}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={btnGhost}>Отказ</button>
        <button type="button" onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Записва...' : 'Запази'}
        </button>
      </div>
    </div>
  )
}

function WorkflowCard({ wf, onEdit, onChanged }: { wf: Workflow; onEdit: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)

  const toggleActive = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/automations/workflows/${wf.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !wf.active }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Грешка')
      toast.success(wf.active ? 'Спряно' : 'Активирано — ще тръгне за нови lead-ове веднага')
      onChanged()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm(`Да изтрия ли "${wf.name}"? Това ще спре и всички активни enrollments в него.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/automations/workflows/${wf.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Грешка')
      toast.success('Изтрито')
      onChanged()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const triggerLabel = TRIGGER_OPTIONS.find(t => t.value === wf.trigger_type)?.label || wf.trigger_type

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: '#1f2937' }}>{wf.name}</span>
            <span style={{
              fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 99,
              background: wf.active ? '#dcfce7' : '#f3f4f6', color: wf.active ? '#166534' : '#6b7280',
            }}>
              {wf.active ? '● Активно' : '○ Спряно'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {triggerLabel} · {wf.steps.length} {wf.steps.length === 1 ? 'стъпка' : 'стъпки'}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11.5, color: '#9ca3af' }}>
            <span>🟢 {wf.stats.active} в процес</span>
            <span>✅ {wf.stats.completed} завършили</span>
            {wf.stats.exited > 0 && <span>⚪ {wf.stats.exited} излезли</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button type="button" onClick={onEdit} disabled={busy} style={{ ...btnGhost, padding: '6px 10px' }}>✏️ Редактирай</button>
          <button type="button" onClick={toggleActive} disabled={busy}
            style={{ ...btnGhost, padding: '6px 10px', background: wf.active ? '#fef3c7' : '#dcfce7', color: wf.active ? '#92400e' : '#166534' }}>
            {wf.active ? 'Спри' : 'Активирай'}
          </button>
          <button type="button" onClick={remove} disabled={busy} style={{ ...btnGhost, padding: '6px 10px', background: '#fee2e2', color: '#991b1b' }}>Изтрий</button>
        </div>
      </div>
    </div>
  )
}

interface LastTick {
  at: string; processed: number; sent: number; errors: number; firstError: string | null
  poll?: { staleOrders: number; staleCarts: number; newEnrollments: number }
}

function minutesAgo(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
}
function ago(min: number): string {
  if (min < 60) return `преди ${min} мин`
  if (min < 1440) return `преди ${Math.round(min / 60)} ч`
  return `преди ${Math.round(min / 1440)} дни`
}

function HealthBanner({ tick, onRun, running }: { tick: LastTick | null; onRun: () => void; running: boolean }) {
  const min   = tick ? minutesAgo(tick.at) : null
  const stale = min === null || min > 120
  const bg    = stale ? '#fef2f2' : '#f0fdf4'
  const bd    = stale ? '#fecaca' : '#bbf7d0'
  const col   = stale ? '#991b1b' : '#166534'
  return (
    <div style={{ background: bg, border: `1px solid ${bd}`, color: col, borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 220, fontSize: 12.5, lineHeight: 1.6 }}>
        {tick === null ? (
          <><b>⚠️ Автоматизациите още не са пускани (или cron-ът не тика).</b> Провери Supabase pg_cron задачата "automations-tick-hourly" или натисни "Пусни сега".</>
        ) : (
          <>
            <b>{stale ? '⚠️ Cron-ът не е тиктал' : '✅ Последно пускане'} {ago(min!)}</b>
            {' · '}
            {tick.poll
              ? `намерени: ${tick.poll.staleOrders} изпратени поръчки >24ч (недоставени), ${tick.poll.staleCarts} колички >2ч · нови записвания: ${tick.poll.newEnrollments}`
              : 'без данни за кандидати'}
            {' · '}изпратени писма: {tick.sent}
            {tick.errors > 0 && <> · <b>грешки: {tick.errors}</b>{tick.firstError ? ` (${tick.firstError.slice(0, 120)})` : ''}</>}
          </>
        )}
      </div>
      <button type="button" onClick={onRun} disabled={running}
        style={{ ...btnGhost, background: '#fff', opacity: running ? 0.6 : 1, flexShrink: 0 }}>
        {running ? 'Работи...' : '▶ Пусни сега'}
      </button>
    </div>
  )
}

export function AutomationsTab() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState<Workflow | null>(null)
  const [tick, setTick]         = useState<LastTick | null>(null)
  const [running, setRunning]   = useState(false)
  const [tplOptions, setTplOptions] = useState<TplOption[]>(TEMPLATE_OPTIONS)

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/automations/health', { credentials: 'include', cache: 'no-store' })
      const data = await res.json()
      setTick(data.lastTick || null)
    } catch { /* банерът просто остава както е */ }
  }, [])

  // ✅ v6 — темплейтите за падащото меню на стъпките: реалната библиотека от базата.
  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/email-templates', { credentials: 'include', cache: 'no-store' })
      const data = await res.json()
      const opts: TplOption[] = (data.templates || [])
        .map((t: any) => ({ key: String(t.key), label: String(t.label || t.key) }))
        .sort((a: TplOption, b: TplOption) => a.label.localeCompare(b.label, 'bg'))
      if (opts.length > 0) setTplOptions(opts)
    } catch { /* остава статичният списък */ }
  }, [])

  const runNow = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/admin/automations/run-now', { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      toast.success(`Готово — пратени: ${data.sent ?? 0}, обработени: ${data.processed ?? 0}`)
      await Promise.all([load(), loadHealth()])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setRunning(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/automations/workflows', { cache: 'no-store' })
      const data = await res.json()
      setWorkflows(data.workflows || [])
    } catch {
      toast.error('Грешка при зареждане')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(); loadHealth(); loadTemplates() }, [load, loadHealth, loadTemplates])

  return (
    <div style={{ padding: '16px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text)' }}>⚙️ Автоматизации</h2>
          <p style={{ fontSize: 12.5, color: '#9ca3af', margin: '2px 0 0' }}>
            Email серии, тригернати от действия на потребителя — редактираш разписанието тук, без код.
          </p>
        </div>
        {!editing && (
          <button type="button" onClick={() => setEditing(emptyWorkflow())} style={btnPrimary}>+ Нов workflow</button>
        )}
      </div>

      <HealthBanner tick={tick} onRun={runNow} running={running} />

      {editing && (
        <WorkflowEditor
          workflow={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
          templateOptions={tplOptions}
        />
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: '#9ca3af' }}>Зарежда...</p>
      ) : workflows.length === 0 && !editing ? (
        <div style={{ padding: 24, background: '#f9fafb', borderRadius: 10, border: '1px dashed #e5e7eb', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
          Още няма workflows. Добави първия отгоре — препоръчвам да редактираш вече готовата
          "Naruchnik — Welcome серия" (създадена от migration-а, в момента спряна).
        </div>
      ) : (
        workflows.map(wf => (
          <WorkflowCard key={wf.id} wf={wf} onEdit={() => setEditing(wf)} onChanged={load} />
        ))
      )}
    </div>
  )
}
