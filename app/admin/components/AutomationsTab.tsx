'use client'
// app/admin/components/AutomationsTab.tsx — v1 (Фаза 1)
//
// Списъчен UI (не drag-drop canvas — виж Фаза 5 в мега плана, само ако
// наистина потрябва по-късно) за CRUD на workflows от app/api/automations/
// workflows/route.ts. Визуалният модел следва CategoryManager.tsx/
// BlogTab.tsx стила, за консистентност с останалия админ панел.

import { useState, useEffect, useCallback } from 'react'
import { toast } from '@/components/ui/Toast'

// ✅ Трябва да съвпада 1:1 с TEMPLATE_REGISTRY в lib/automations.ts —
//    добавяй нов ред тук ВИНАГИ заедно с нов ред там.
const TEMPLATE_OPTIONS = [
  { key: 'naruchnik_welcome',    label: 'Naruchnik — Welcome (ден 0)' },
  { key: 'naruchnik_followup2',  label: 'Naruchnik — Follow-up ден 2' },
  { key: 'naruchnik_followup5',  label: 'Naruchnik — Follow-up ден 5' },
  { key: 'naruchnik_followup10', label: 'Naruchnik — Follow-up ден 10' },
]

const TRIGGER_OPTIONS = [
  { value: 'naruchnik_download', label: '📗 Изтегли наръчник', ready: true },
  { value: 'order_placed',       label: '🛒 Направена поръчка', ready: false },
  { value: 'cart_abandoned',     label: '🛍️ Изоставена количка', ready: false },
  { value: 'tag_added',          label: '🏷️ Добавен таг', ready: false },
  { value: 'manual',             label: '✋ Ръчно (broadcast)', ready: false },
]

interface Step { step_number?: number; delay_days: number; template_key: string; active: boolean }
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

function StepEditor({ steps, onChange }: { steps: Step[]; onChange: (s: Step[]) => void }) {
  const update = (i: number, patch: Partial<Step>) => onChange(steps.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  const remove = (i: number) => onChange(steps.filter((_, idx) => idx !== i))
  const add    = () => onChange([...steps, { delay_days: steps.length === 0 ? 0 : 2, template_key: TEMPLATE_OPTIONS[0].key, active: true }])
  const move   = (i: number, dir: -1 | 1) => {
    const t = i + dir
    if (t < 0 || t >= steps.length) return
    const next = [...steps]
    ;[next[i], next[t]] = [next[t], next[i]]
    onChange(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {steps.length === 0 && (
        <div style={{ padding: 14, background: '#f9fafb', borderRadius: 8, border: '1px dashed #e5e7eb', textAlign: 'center', fontSize: 12.5, color: '#9ca3af' }}>
          Няма стъпки — добави първата отдолу.
        </div>
      )}
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fafafa', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', width: 20, flexShrink: 0 }}>#{i + 1}</span>
          <select value={step.template_key} onChange={e => update(i, { template_key: e.target.value })} style={{ ...inp, flex: 2, padding: '7px 8px', fontSize: 12.5 }}>
            {TEMPLATE_OPTIONS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <input type="number" min={0} value={step.delay_days}
              onChange={e => update(i, { delay_days: Number(e.target.value) })}
              style={{ ...inp, width: 54, padding: '7px 8px', fontSize: 12.5, textAlign: 'center' }} />
            <span style={{ fontSize: 11, color: '#9ca3af' }}>дни{i > 0 ? ' след пред.' : ' (веднага)'}</span>
          </div>
          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={{ ...btnGhost, padding: '5px 8px', opacity: i === 0 ? 0.3 : 1 }}>↑</button>
          <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} style={{ ...btnGhost, padding: '5px 8px', opacity: i === steps.length - 1 ? 0.3 : 1 }}>↓</button>
          <button type="button" onClick={() => remove(i)} style={{ ...btnGhost, padding: '5px 8px', background: '#fee2e2', color: '#991b1b' }}>✕</button>
        </div>
      ))}
      <button type="button" onClick={add} style={{ ...btnGhost, alignSelf: 'flex-start' }}>+ Добави стъпка</button>
    </div>
  )
}

function WorkflowEditor({ workflow, onSaved, onCancel }: { workflow: Workflow; onSaved: () => void; onCancel: () => void }) {
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
        if (wf.steps.length > 0) {
          await fetch(`/api/automations/workflows/${data.workflow.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ steps: wf.steps }),
          })
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
        </div>
      </div>

      <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 6 }}>Стъпки (имейли)</label>
      <StepEditor steps={wf.steps} onChange={steps => setWf({ ...wf, steps })} />

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

export function AutomationsTab() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState<Workflow | null>(null)

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

  useEffect(() => { load() }, [load])

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

      {editing && (
        <WorkflowEditor
          workflow={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
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
