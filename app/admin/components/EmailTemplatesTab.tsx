'use client'
// app/admin/components/EmailTemplatesTab.tsx — v5
//
// ПОПРАВКИ v5 (спрямо v4):
//   ✅ НОВО: RichTextEditor — contentEditable + toolbar (Bold/Italic/
//      списъци/линк/заглавие/изчисти формат) вместо гол HTML textarea.
//      Вграден, без нова npm зависимост — document.execCommand() под
//      капака. "👁 Визуално" / "</> HTML" таб превключва по избор към
//      суровия код, за фин контрол/paste на точен markup — и двата
//      гледат/пишат към СЪЩИЯ bodyHtml низ, нищо не се губи при смяна.
//   ✅ НОВО: "+ Вмъкни променлива" в toolbar-а — вмъква {{var}} на
//      позицията на курсора вместо да се пише ръчно.
//
// ПОПРАВКИ v4 (спрямо v2 — v3 preview-ът беше твърде малък/приблизителен):
//   ✅ PreviewModal вече е голям (почти цял екран, scrollable), не малко
//      прозорче в което нищо не се вижда.
//   ✅ Preview-ът тегли РЕАЛНИТЕ "От (Имена)" / tagline / футър текст от
//      /api/admin/email-settings — вместо хардкоднати примерни стойности.
//      (Ако заявката гръмне, пада на разумни default-и и показва бележка.)
//   ✅ Показва и Темата (Subject) на писмото, не само тялото.
//   ✅ Рендерът е direct HTML (dangerouslySetInnerHTML) в scroll контейнер,
//      вместо iframe + srcDoc — отпада проблемът с фиксирана малка височина.
//
// (v2 → v3 история: added SAMPLE_VALUES/substituteSample/PreviewModal —
//  запазени тук, само подобрени.)

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from '@/components/ui/Toast'

interface TemplateRow {
  key:              string
  label:            string
  vars:             string[]
  subject:          string
  body_html:        string
  updated_at:       string
  usedByStepsCount: number
}

interface LiveEmailSettings {
  fromName:      string
  senderTagline: string
  footerText:    string
}

const DEFAULT_LIVE_SETTINGS: LiveEmailSettings = {
  fromName:      'Denny Angelow',
  senderTagline: 'Denny Angelow — Агро Консултант',
  footerText:    'Получаваш този имейл, защото се регистрира на dennyangelow.com.',
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

const DEFAULT_VARS = ['name', 'email']

// Примерни стойности за произволните merge-полета в писмата (не тези, които
// идват от Настройки — tagline/footer се теглят на живо, виж LiveEmailSettings).
const SAMPLE_VALUES: Record<string, string> = {
  name:             'Иван Иванов',
  email:            'ivan@example.com',
  order_number:     'DA-2026-1963',
  tracking_number:  'BG123456789SP',
  link:             'https://dennyangelow.com/naruchnik',
  product_name:     'Органичен тор за домати',
  days:             '7',
  amount:           '49.90 лв.',
  discount:         '10%',
}

function substituteSample(text: string, vars: string[]): string {
  const all = Array.from(new Set([...DEFAULT_VARS, ...vars]))
  let out = text
  for (const v of all) {
    const val = SAMPLE_VALUES[v] ?? `[${v}]`
    out = out.replaceAll(`{{${v}}}`, val)
  }
  return out
}

// Приблизителна рамка, вярна на реалния wrapper()/footer() стил в
// lib/email-templates.ts (тъмнозелен header, доматено лого, светъл body).
function renderPreviewHtml(bodyHtml: string, settings: LiveEmailSettings): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
      <div style="background:linear-gradient(135deg,#0f1f16,#2d6a4f);padding:28px;border-radius:12px 12px 0 0;text-align:center">
        <p style="font-size:32px;margin:0 0 6px">🍅</p>
        <p style="color:#d4e9dd;font-size:12.5px;margin:0;letter-spacing:.2px">${settings.senderTagline}</p>
      </div>
      <div style="padding:28px;border:1px solid #eee;border-top:none">
        ${bodyHtml}
      </div>
      <div style="padding:18px 28px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;background:#fafafa">
        <p style="font-size:11.5px;color:#9ca3af;line-height:1.6;margin:0 0 8px">${settings.footerText}</p>
        <a href="#" style="font-size:11.5px;color:#6b7280;text-decoration:underline">Отпиши се тук</a>
      </div>
    </div>
  `
}

function slugifyKey(label: string): string {
  const base = label.trim().toLowerCase()
    .replace(/[^a-z0-9а-я\s_-]/gi, '')
    .replace(/[а-я]/g, ch => ({ а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sht',ъ:'a',ь:'',ю:'yu',я:'ya' } as Record<string,string>)[ch] ?? ch)
    .replace(/\s+/g, '_').replace(/-+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  const suffix = Math.random().toString(36).slice(2, 7)
  return `custom_${base || 'template'}_${suffix}`.slice(0, 80)
}

// ── PreviewModal — голям, scrollable, живи Настройки ───────────────────────
function PreviewModal({ row, onClose }: { row: TemplateRow; onClose: () => void }) {
  const [settings, setSettings] = useState<LiveEmailSettings>(DEFAULT_LIVE_SETTINGS)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/email-settings', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (!cancelled) setSettings({ ...DEFAULT_LIVE_SETTINGS, ...d }) })
      .catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [])

  const subject = substituteSample(row.subject, row.vars)
  const body    = substituteSample(row.body_html, row.vars)
  const html    = renderPreviewHtml(body, settings)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, width: '100%', maxWidth: 720,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,.3)',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', borderBottom: '1px solid #eee', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.4px' }}>
              👁 Преглед (примерни данни)
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginTop: 2 }}>{subject}</div>
          </div>
          <button type="button" onClick={onClose} style={{ ...btnGhost, padding: '6px 12px', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '28px 20px', background: '#f3f4f6', flex: 1 }}>
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>

        <div style={{ padding: '10px 20px', borderTop: '1px solid #eee', flexShrink: 0, background: '#fafafa' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>
            {loadError
              ? '⚠️ Не успяхме да заредим реалните Настройки — показваме примерни име/футър текст.'
              : 'Името, редът под логото и футър текстът са взети на живо от Настройки → Email настройки. Останалите стойности ({{name}}, {{order_number}}...) са примерни.'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── RichTextEditor — Визуално (contentEditable+toolbar) / HTML превключвател ──
const toolBtn: React.CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 9px',
  cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#374151', lineHeight: 1,
}
const toolBtnActive: React.CSSProperties = { ...toolBtn, background: '#dcfce7', borderColor: '#86efac', color: '#166534' }

function RichTextEditor({
  value, onChange, availableVars,
}: {
  value: string
  onChange: (html: string) => void
  availableVars: string[]
}) {
  const [mode, setMode] = useState<'visual' | 'html'>('visual')
  const editorRef = useRef<HTMLDivElement>(null)
  const lastSynced = useRef<string | null>(null)
  // ⚠️ ФИКС #2: двата режима рендват различен JSX клон (div vs textarea) —
  // когато превключиш towards 'html' и обратно, contentEditable диват се
  // РАЗМОНТИРА и React създава НОВ, празен div при връщане. lastSynced
  // (сам по себе си) мислеше "value не се е променило → няма нужда да
  // пълня" — но новият div е празен, независимо дали value се е променило.
  // prevMode пази дали ПРЕДИШНИЯТ рендер е бил 'visual' — ако не е бил
  // (идваме от 'html' или е първо монтиране), ВИНАГИ пълним DOM-а наново,
  // без значение дали value съвпада с последно синхронираното.
  const prevMode = useRef<'visual' | 'html' | null>(null)

  // Докато пишеш във visual (prevMode си остава 'visual'), onInput праща
  // промените обратно БЕЗ да пипа DOM-а пак — иначе браузърът би бутал
  // курсора при всеки нов знак.
  useEffect(() => {
    const justEnteredVisual = mode === 'visual' && prevMode.current !== 'visual'
    if (mode === 'visual' && editorRef.current && (justEnteredVisual || lastSynced.current !== value)) {
      editorRef.current.innerHTML = value
      lastSynced.current = value
    }
    prevMode.current = mode
  }, [mode, value])

  const emitChange = useCallback(() => {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    lastSynced.current = html
    onChange(html)
  }, [onChange])

  const exec = (cmd: string, arg?: string) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, arg)
    emitChange()
  }

  const insertLink = () => {
    const url = window.prompt('URL на линка:', 'https://')
    if (url) exec('createLink', url)
  }

  const insertVar = (v: string) => {
    editorRef.current?.focus()
    document.execCommand('insertText', false, `{{${v}}}`)
    emitChange()
  }

  const vars = availableVars.length ? availableVars : DEFAULT_VARS

  return (
    <div style={{ border: '1.5px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: 8, background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
        {mode === 'visual' && (
          <>
            <button type="button" title="Удебелено" onClick={() => exec('bold')} style={{ ...toolBtn, fontWeight: 900 }}>B</button>
            <button type="button" title="Курсив" onClick={() => exec('italic')} style={{ ...toolBtn, fontStyle: 'italic' }}>I</button>
            <button type="button" title="Подчертано" onClick={() => exec('underline')} style={{ ...toolBtn, textDecoration: 'underline' }}>U</button>
            <span style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 2px' }} />
            <button type="button" title="Заглавие" onClick={() => exec('formatBlock', '<h3>')} style={toolBtn}>H3</button>
            <button type="button" title="Обикновен текст" onClick={() => exec('formatBlock', '<p>')} style={toolBtn}>¶</button>
            <span style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 2px' }} />
            <button type="button" title="Маркиран списък" onClick={() => exec('insertUnorderedList')} style={toolBtn}>• —</button>
            <button type="button" title="Номериран списък" onClick={() => exec('insertOrderedList')} style={toolBtn}>1.—</button>
            <span style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 2px' }} />
            <button type="button" title="Линк" onClick={insertLink} style={toolBtn}>🔗</button>
            <button type="button" title="Изчисти форматирането" onClick={() => exec('removeFormat')} style={toolBtn}>✕ формат</button>
            <span style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 2px' }} />
            <select
              onChange={e => { if (e.target.value) { insertVar(e.target.value); e.target.value = '' } }}
              defaultValue=""
              style={{ ...toolBtn, cursor: 'pointer', paddingRight: 6 }}
            >
              <option value="" disabled>+ Вмъкни променлива</option>
              {vars.map(v => <option key={v} value={v}>{'{{' + v + '}}'}</option>)}
            </select>
          </>
        )}
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => setMode('visual')} style={mode === 'visual' ? toolBtnActive : toolBtn}>👁 Визуално</button>
        <button type="button" onClick={() => setMode('html')} style={mode === 'html' ? toolBtnActive : toolBtn}>{'</> HTML'}</button>
      </div>

      {mode === 'visual' ? (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emitChange}
          onBlur={emitChange}
          style={{ minHeight: 260, maxHeight: 440, overflowY: 'auto', padding: '12px 14px', fontSize: 14, lineHeight: 1.6, outline: 'none', background: '#fff' }}
        />
      ) : (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={14}
          style={{ width: '100%', padding: '12px 14px', border: 'none', fontFamily: 'monospace', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', display: 'block' }}
        />
      )}
    </div>
  )
}

function TemplateEditor({ row, isNew, onSaved, onCancel }: { row: TemplateRow; isNew: boolean; onSaved: () => void; onCancel: () => void }) {
  const [label, setLabel]       = useState(row.label)
  const [subject, setSubject]   = useState(row.subject)
  const [bodyHtml, setBodyHtml] = useState(row.body_html)
  const [saving, setSaving]     = useState(false)
  const [preview, setPreview]   = useState(false)

  const save = async () => {
    if (!subject.trim() || !bodyHtml.trim()) { toast.error('Темата и съдържанието са задължителни'); return }
    setSaving(true)
    try {
      const key = isNew ? slugifyKey(label || 'template') : row.key
      const res = await fetch(`/api/admin/email-templates/${key}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body_html: bodyHtml }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      toast.success(isNew ? 'Нов темплейт създаден — вече можеш да го избереш от стъпка' : 'Запазено')
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#fff', border: '1.5px solid #2d6a4f', borderRadius: 12, padding: 18, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>
          {isNew ? '✨ Нов темплейт' : `✏️ ${row.label}`}
        </div>
        <button
          type="button"
          onClick={() => setPreview(true)}
          disabled={!subject.trim() || !bodyHtml.trim()}
          style={{ ...btnGhost, padding: '6px 12px', opacity: (!subject.trim() || !bodyHtml.trim()) ? 0.5 : 1 }}
        >
          👁 Преглед
        </button>
      </div>

      {isNew && (
        <>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>Име (за разпознаване в списъка)</label>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="напр. Честит рожден ден" style={{ ...inp, marginBottom: 14 }} />
        </>
      )}

      <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>Тема на имейла</label>
      <input
        value={subject}
        onChange={e => setSubject(e.target.value)}
        style={{ ...inp, marginBottom: 14 }}
      />

      <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>
        Съдържание — само вътрешният текст
      </label>
      <RichTextEditor value={bodyHtml} onChange={setBodyHtml} availableVars={row.vars} />

      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '9px 12px', fontSize: 11.5, color: '#166534', marginBottom: 16, lineHeight: 1.7 }}>
        Налични променливи: {(row.vars.length ? row.vars : DEFAULT_VARS).map(v => (
          <code key={v} style={{ background: '#fff', padding: '1px 6px', borderRadius: 4, margin: '0 3px', fontWeight: 700, color: '#15803d' }}>
            {'{{' + v + '}}'}
          </code>
        ))}
        <div style={{ marginTop: 4, color: '#4d7c0f' }}>
          Рамката (лого, зелен header) и бутона за отписване се добавят автоматично — не ги пиши тук.
          Използвай "+ Вмъкни променлива" в лентата с инструменти, за да ги добавиш без грешки.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={btnGhost}>Отказ</button>
        <button type="button" onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Записва...' : 'Запази'}
        </button>
      </div>

      {preview && (
        <PreviewModal row={{ ...row, label, subject, body_html: bodyHtml }} onClose={() => setPreview(false)} />
      )}
    </div>
  )
}

function TemplateCard({ row, onEdit, onChanged }: { row: TemplateRow; onEdit: () => void; onChanged: () => void }) {
  const [busy, setBusy]       = useState(false)
  const [preview, setPreview] = useState(false)

  const del = async () => {
    if (!confirm(`Изтрий "${row.label}" завинаги? Не може да се върне.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/email-templates/${row.key}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Грешка')
      toast.success('Изтрито')
      onChanged()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: '#1f2937' }}>{row.label}</span>
            {row.usedByStepsCount > 1 && (
              <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: '#dbeafe', color: '#1e40af' }}>
                🔁 Преизползван в {row.usedByStepsCount}
              </span>
            )}
            {row.usedByStepsCount === 0 && (
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#f3f4f6', color: '#9ca3af' }}>
                Неизползван
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{row.subject}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button type="button" onClick={() => setPreview(true)} disabled={busy} style={{ ...btnGhost, padding: '6px 10px' }}>👁 Преглед</button>
          <button type="button" onClick={onEdit} disabled={busy} style={{ ...btnGhost, padding: '6px 10px' }}>✏️ Редактирай</button>
          <button type="button" onClick={del} disabled={busy} style={{ ...btnGhost, padding: '6px 10px', background: '#fee2e2', color: '#991b1b' }}>
            🗑 Изтрий
          </button>
        </div>
      </div>

      {preview && <PreviewModal row={row} onClose={() => setPreview(false)} />}
    </div>
  )
}

const BLANK: TemplateRow = { key: '', label: '', vars: DEFAULT_VARS, subject: '', body_html: '', updated_at: '', usedByStepsCount: 0 }

export function EmailTemplatesTab() {
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState<TemplateRow | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/email-templates', { credentials: 'include', cache: 'no-store' })
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch {
      toast.error('Грешка при зареждане')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ padding: '16px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text)' }}>📝 Темплейти на имейлите</h2>
          <p style={{ fontSize: 12.5, color: '#9ca3af', margin: '2px 0 0' }}>
            Библиотека от писма — редактирай и преизползвай в произволна автоматизация.
          </p>
        </div>
        <button type="button" onClick={() => { setCreatingNew(true); setEditing(null) }} style={btnPrimary}>+ Нов темплейт</button>
      </div>

      {creatingNew && (
        <TemplateEditor
          row={BLANK}
          isNew
          onCancel={() => setCreatingNew(false)}
          onSaved={() => { setCreatingNew(false); load() }}
        />
      )}

      {editing && !creatingNew && (
        <TemplateEditor
          row={editing}
          isNew={false}
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: '#9ca3af' }}>Зарежда...</p>
      ) : templates.length === 0 ? (
        <p style={{ fontSize: 13, color: '#9ca3af' }}>Няма темплейти — пусни SQL миграцията първо или създай нов.</p>
      ) : (
        templates.map(row => (
          <TemplateCard key={row.key} row={row} onEdit={() => { setEditing(row); setCreatingNew(false) }} onChanged={load} />
        ))
      )}
    </div>
  )
}
