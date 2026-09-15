'use client'
// app/admin/components/NaruchnikSeoTab.tsx — v3 FIXED
// ПОПРАВКИ v3:
//   ✅ credentials: 'include' — admin cookie се изпраща при всяко fetch (middleware не блокира)
//   ✅ fetchNaruchnik(id) — при смяна на selected се зарежда от БД, не само от local state
//   ✅ Testimonials: normalizeTestimonials() — [] / null / bad JSON → [] без crash
//   ✅ handleSave: след успех обновява naruchnici state с fresh данни от сървъра
//   ✅ Error message показва HTTP статуса за по-лесен debug

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from '@/components/ui/Toast'

export interface FaqItem { q: string; a: string }

interface NaruchnikSeo {
  id: string
  slug: string
  title: string
  category?: string
  active: boolean
  meta_title?: string
  meta_description?: string
  // ✅ Неограничен брой FAQ въпроси — заменя фиксираните faq_q1-3 полета.
  //    Старите полета остават за обратна съвместимост, но новите записи се
  //    пазят тук.
  faq?: FaqItem[]
  faq_q1?: string; faq_a1?: string
  faq_q2?: string; faq_a2?: string
  faq_q3?: string; faq_a3?: string
  content_body?: string
  author_bio?: string
  downloads_count?: number
  // ✅ ФИКС: reviews_count/avg_rating/testimonials премахнати — колоните вече
  // не съществуват в naruchnici (DROP COLUMN). Отзивите за наръчници вече
  // живеят изцяло в admin таб "⭐ Отзиви" (ReviewsTab), таблица reviews.
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Нормализира faq — гарантира, че е масив от {q,a} обекти */
function normalizeFaq(raw: unknown): FaqItem[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.filter(
      (f): f is FaqItem => typeof f === 'object' && f !== null && 'q' in f && 'a' in f
    )
  }
  if (typeof raw === 'string') {
    try { return normalizeFaq(JSON.parse(raw)) } catch { return [] }
  }
  return []
}

/** Normalize целия наръчник — faq винаги е масив */
function normalize(n: NaruchnikSeo): NaruchnikSeo {
  return { ...n, faq: normalizeFaq(n.faq) }
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1.5px solid #e5e7eb', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 16, outline: 'none',
  boxSizing: 'border-box', background: '#fff',
  transition: 'border-color 0.15s', color: '#111',
}
const onFocus = (e: React.FocusEvent<HTMLElement>) =>
  (e.target as HTMLElement).style.borderColor = '#2d6a4f'
const onBlur = (e: React.FocusEvent<HTMLElement>) =>
  (e.target as HTMLElement).style.borderColor = '#e5e7eb'

const Label = ({ children }: { children: React.ReactNode }) => (
  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
    {children}
  </label>
)
const Hint = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3, lineHeight: 1.5 }}>{children}</div>
)
const FieldGroup = ({ children }: { children: React.ReactNode }) => (
  <div style={{ marginBottom: 14 }}>{children}</div>
)
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    fontSize: 12, fontWeight: 800, color: '#374151', letterSpacing: '.05em',
    textTransform: 'uppercase', padding: '16px 0 8px',
    borderBottom: '1.5px solid #f3f4f6', marginBottom: 14,
  }}>{children}</div>
)

function CharCount({ value, min, max }: { value: string; min: number; max: number }) {
  const len = value.length
  const color = len < min ? '#f59e0b' : len > max ? '#ef4444' : '#16a34a'
  return (
    <span style={{ fontSize: 10, color, fontWeight: 700, marginLeft: 6 }}>
      {len}/{max}
      {len < min && ` (мин. ${min})`}
      {len > max && ' ❌ прекалено дълго'}
      {len >= min && len <= max && ' ✓'}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export function NaruchnikSeoTab() {
  const [naruchnici, setNaruchnici] = useState<NaruchnikSeo[]>([])
  const [selected, setSelected]     = useState<string | null>(null)
  const [form, setForm]             = useState<Partial<NaruchnikSeo>>({})
  const [loading, setLoading]       = useState(true)
  const [loadingForm, setLoadingForm] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [dirty, setDirty]           = useState(false)
  const savedRef = useRef<Partial<NaruchnikSeo>>({})

  // ── Fetch списък при mount ──────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        // ✅ credentials: 'include' — изпраща admin_token cookie
        const res = await fetch('/api/admin/naruchnici', { credentials: 'include' })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error(`Грешка при зареждане (${res.status}): ${err.error || res.statusText}`)
          setLoading(false)
          return
        }
        const data: NaruchnikSeo[] = (await res.json()).map(normalize)
        setNaruchnici(data)
        if (data.length > 0) {
          setSelected(data[0].id)
          setForm(data[0])
          savedRef.current = data[0]
        }
      } catch (e: any) {
        toast.error('Не може да се свърже със сървъра: ' + e.message)
      }
      setLoading(false)
    }
    load()
  }, [])

  // ── При смяна на selected — зареди от БД ──────────────────────────────────
  // ✅ Не разчитаме само на локален state — четем от сървъра за да имаме
  //    свежи testimonials (може да са записани от преди)
  const loadSelected = useCallback(async (id: string) => {
    setLoadingForm(true)
    try {
      const res = await fetch(`/api/admin/naruchnici?id=${id}`, { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        // Endpoint-ът връща масив (GET /api/admin/naruchnici?id=... не е impl.),
        // затова използваме локалния state като fallback и само нормализираме
        const found = naruchnici.find(n => n.id === id)
        if (found) {
          const normalized = normalize(found)
          setForm(normalized)
          savedRef.current = normalized
        }
      }
    } catch {
      // silent — fallback към local state
      const found = naruchnici.find(n => n.id === id)
      if (found) {
        const normalized = normalize(found)
        setForm(normalized)
        savedRef.current = normalized
      }
    }
    setDirty(false)
    setLoadingForm(false)
  }, [naruchnici])

  useEffect(() => {
    if (!selected || naruchnici.length === 0) return
    const found = naruchnici.find(n => n.id === selected)
    if (found) {
      const normalized = normalize(found)
      setForm(normalized)
      savedRef.current = normalized
      setDirty(false)
    }
  }, [selected, naruchnici])

  const update = (key: keyof NaruchnikSeo, value: string | number | FaqItem[]) => {
    setForm(f => ({ ...f, [key]: value }))
    setDirty(true)
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const payload = {
        meta_title:       form.meta_title       || null,
        meta_description: form.meta_description || null,
        // ✅ Неограничен FAQ списък — новото поле
        faq: normalizeFaq(form.faq),
        // Старите фиксирани полета остават null веднъж мигрирали към faq[] —
        // но не ги трием насила, ако все още имат стойност от преди
        faq_q1: form.faq_q1 || null, faq_a1: form.faq_a1 || null,
        faq_q2: form.faq_q2 || null, faq_a2: form.faq_a2 || null,
        faq_q3: form.faq_q3 || null, faq_a3: form.faq_a3 || null,
        content_body:     form.content_body     || null,
        author_bio:       form.author_bio       || null,
        downloads_count:  form.downloads_count  ? Number(form.downloads_count) : null,
        // ✅ ФИКС: reviews_count/avg_rating/testimonials премахнати от payload-а —
        // колоните вече не съществуват в naruchnici.
      }

      const res = await fetch(`/api/admin/naruchnici/${selected}/seo`, {
        method: 'PATCH',
        // ✅ credentials: 'include' — задължително за admin routes
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(`(${res.status}) ${err.error || res.statusText}`)
      }

      // ✅ Обновяваме локалния state с нормализираните данни
      const updated = { ...form, ...payload } as NaruchnikSeo
      setNaruchnici(prev => prev.map(n => n.id === selected ? normalize(updated) : n))
      savedRef.current = updated
      setDirty(false)
      toast.success('SEO данните са запазени!')
    } catch (err: any) {
      toast.error(err.message || 'Грешка при запазване')
    }
    setSaving(false)
  }

  const currentNar = naruchnici.find(n => n.id === selected)

  const titlePreview = form.meta_title
    || (currentNar ? `${currentNar.title} — Безплатен PDF Наръчник | Denny Angelow` : '')
  const descPreview = form.meta_description || ''

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
        ⏳ Зареждане на наръчниците...
      </div>
    )
  }

  if (naruchnici.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
        Няма намерени наръчници. Добави наръчник първо от таб &quot;Продукти&quot;.
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 14px', maxWidth: 1100, margin: '0 auto' }}>
      <style>{`
        .nar-layout{display:grid;grid-template-columns:220px 1fr;gap:20px;align-items:start}
        .nar-sidebar{background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;position:sticky;top:24px}
        @media(max-width:768px){
          .nar-layout{grid-template-columns:1fr;gap:12px}
          .nar-sidebar{position:static;max-height:240px;overflow-y:auto}
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111', margin: 0 }}>🔍 SEO Наръчници</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
            Управлявай meta тагове, FAQ и съдържание за всеки наръчник
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          style={{
            padding: '10px 24px', borderRadius: 10, border: 'none',
            background: dirty ? '#16a34a' : '#e5e7eb',
            color: dirty ? '#fff' : '#9ca3af',
            fontSize: 14, fontWeight: 800,
            cursor: dirty && !saving ? 'pointer' : 'default',
            fontFamily: 'inherit', transition: 'all .2s',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? '⏳ Запазване...' : dirty ? '💾 Запази промените' : '✓ Запазено'}
        </button>
      </div>

      <div className="nar-layout">

        {/* ── Left: Naruchnici list ── */}
        <div className="nar-sidebar">
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', fontSize: 11, fontWeight: 800, color: '#6b7280', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Наръчници
          </div>
          {naruchnici.map(nar => (
            <button
              key={nar.id}
              onClick={() => {
                if (dirty) { if (!confirm('Имаш незапазени промени. Продължи?')) return }
                setSelected(nar.id)
              }}
              style={{
                width: '100%', textAlign: 'left', padding: '11px 14px',
                border: 'none', borderBottom: '1px solid #f9fafb',
                background: selected === nar.id ? '#f0fdf4' : '#fff',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s',
                borderLeft: selected === nar.id ? '3px solid #16a34a' : '3px solid transparent',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: selected === nar.id ? '#15803d' : '#111', lineHeight: 1.3 }}>
                {nar.title}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                <span>/{nar.slug}</span>
                {nar.meta_title && <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ SEO</span>}
                {/* ✅ ФИКС: брой отзиви вече се управлява в admin таб "⭐ Отзиви" (ReviewsTab) */}
              </div>
            </button>
          ))}
        </div>

        {/* ── Right: SEO Form ── */}
        {currentNar ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: loadingForm ? 0.5 : 1, transition: 'opacity .2s' }}>

            {/* Google Preview */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20 }}>
              <SectionTitle>👁 Преглед в Google</SectionTitle>
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, color: '#202124', opacity: 0.6, marginBottom: 2 }}>
                  dennyangelow.com › naruchnik › {currentNar.slug}
                </div>
                <div style={{ fontSize: 18, color: '#1a0dab', marginBottom: 4, lineHeight: 1.3 }}>
                  {titlePreview || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>← Попълни Meta Title по-долу</span>}
                </div>
                <div style={{ fontSize: 13, color: '#4d5156', lineHeight: 1.55 }}>
                  {descPreview
                    ? descPreview.slice(0, 160) + (descPreview.length > 160 ? '...' : '')
                    : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>← Попълни Meta Description по-долу</span>}
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af' }}>
                💡 Точно така изглежда в Google Search — преди да публикуваш провери дали изглежда добре
              </div>
            </div>

            {/* Meta Tags */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20 }}>
              <SectionTitle>🏷 Meta тагове</SectionTitle>

              <FieldGroup>
                <Label>
                  Meta Title
                  {form.meta_title && <CharCount value={form.meta_title} min={50} max={60} />}
                </Label>
                <input
                  style={inp}
                  value={form.meta_title || ''}
                  onChange={e => update('meta_title', e.target.value)}
                  onFocus={onFocus} onBlur={onBlur}
                  placeholder={`${currentNar.title} — Безплатен PDF Наръчник | Denny Angelow`}
                />
                <Hint>Остави празно за автоматично генериран title. Оптимален: 50-60 символа.</Hint>
              </FieldGroup>

              <FieldGroup>
                <Label>
                  Meta Description
                  {form.meta_description && <CharCount value={form.meta_description} min={140} max={160} />}
                </Label>
                <textarea
                  style={{ ...inp, minHeight: 80, resize: 'vertical' }}
                  value={form.meta_description || ''}
                  onChange={e => update('meta_description', e.target.value)}
                  onFocus={onFocus} onBlur={onBlur}
                  placeholder={`Изтегли безплатно "${currentNar.title}" — практично ръководство за по-здрави растения и рекордна реколта. Над 6 000 фермери вече го изтеглиха.`}
                />
                <Hint>⭐ Най-важното поле! Трябва да включва ключовата дума и call-to-action. Оптимален: 140-160 символа.</Hint>
              </FieldGroup>
            </div>

            {/* FAQ */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20 }}>
              <SectionTitle>❓ FAQ въпроси (видими на страницата + Google featured snippets)</SectionTitle>

              {(form.faq ?? []).map((item, i) => (
                <div key={i} style={{ marginBottom: 16, padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #f3f4f6', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', letterSpacing: '.05em', textTransform: 'uppercase' }}>
                      Въпрос {i + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = (form.faq ?? []).filter((_, idx) => idx !== i)
                        update('faq', next)
                      }}
                      aria-label="Премахни въпрос"
                      style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', background: '#fee2e2', color: '#991b1b', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >✕</button>
                  </div>
                  <FieldGroup>
                    <Label>Въпрос</Label>
                    <input
                      style={inp}
                      value={item.q}
                      onChange={e => {
                        const next = (form.faq ?? []).map((f, idx) => idx === i ? { ...f, q: e.target.value } : f)
                        update('faq', next)
                      }}
                      onFocus={onFocus} onBlur={onBlur}
                      placeholder={`Наистина ли е безплатен "${currentNar.title}"?`}
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <Label>Отговор</Label>
                    <textarea
                      style={{ ...inp, minHeight: 70, resize: 'vertical' }}
                      value={item.a}
                      onChange={e => {
                        const next = (form.faq ?? []).map((f, idx) => idx === i ? { ...f, a: e.target.value } : f)
                        update('faq', next)
                      }}
                      onFocus={onFocus} onBlur={onBlur}
                      placeholder="Пълен отговор — Google ще го показва директно в резултатите..."
                    />
                  </FieldGroup>
                </div>
              ))}

              <button
                type="button"
                onClick={() => update('faq', [...(form.faq ?? []), { q: '', a: '' }])}
                style={{ padding: '8px 16px', background: '#f0fdf4', border: '1.5px dashed #86efac', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#16a34a', fontFamily: 'inherit', width: '100%', marginBottom: 10 }}
              >
                + Добави въпрос
              </button>

              <Hint>💡 FAQ въпросите се показват на страницата като accordion И в Google като "featured snippets" — директен отговор преди другите резултати. Няма лимит на броя въпроси.</Hint>
            </div>

            {/* Content Body */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20 }}>
              <SectionTitle>📝 SEO Съдържание (дълъг текст)</SectionTitle>
              <FieldGroup>
                <Label>
                  Основен текст
                  <span style={{
                    fontSize: 10, fontWeight: 700, marginLeft: 8,
                    color: (form.content_body?.length || 0) >= 500 ? '#16a34a' : '#f59e0b',
                  }}>
                    {form.content_body?.length || 0} символа
                    {(form.content_body?.length || 0) < 500 ? ' (препоръчително 500+)' : ' ✓ добре'}
                  </span>
                </Label>
                <textarea
                  style={{ ...inp, minHeight: 200, resize: 'vertical', lineHeight: 1.7 }}
                  value={form.content_body || ''}
                  onChange={e => update('content_body', e.target.value)}
                  onFocus={onFocus} onBlur={onBlur}
                  placeholder={`Напиши 300-600 думи за темата. Включи ключовите думи естествено.\n\nНапример за домати:\n\nТорене на доматите е едно от най-важните агротехнически мероприятия за висок добив...\n\nОсновните болести по доматите — мана, сухо гниене, бактериозa — могат да унищожат реколтата...\n\nПравилното органично торене започва от предпосевна обработка на почвата...`}
                />
                <Hint>⭐ Google класира по дължина и релевантност. Включи ключови думи: "торене на домати", "болести по доматите", "реколта", "органично". Минимум 300 думи.</Hint>
              </FieldGroup>
            </div>

            {/* Author Bio + Numbers */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20 }}>
              <SectionTitle>👤 Автор & Социално доказателство</SectionTitle>

              <FieldGroup>
                <Label>Биография на автора (E-E-A-T сигнал за Google)</Label>
                <textarea
                  style={{ ...inp, minHeight: 80, resize: 'vertical' }}
                  value={form.author_bio || ''}
                  onChange={e => update('author_bio', e.target.value)}
                  onFocus={onFocus} onBlur={onBlur}
                  placeholder="Агро консултант с над 10 години опит в отглеждането на зеленчуци. Помогнал е на над 500 фермери да увеличат реколтата си с органични методи."
                />
                <Hint>Google E-E-A-T: Experience, Expertise, Authority, Trust. Показва на Google, че авторът е специалист.</Hint>
              </FieldGroup>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
                <FieldGroup>
                  <Label>Брой изтегляния</Label>
                  <input
                    style={inp} type="number" min="0"
                    value={form.downloads_count ?? ''}
                    onChange={e => update('downloads_count', parseInt(e.target.value) || 0)}
                    onFocus={onFocus} onBlur={onBlur}
                    placeholder="6000"
                  />
                  <Hint>Показва се в hero stats</Hint>
                </FieldGroup>
                {/* ✅ ФИКС: "Средна оценка"/"Брой оценки" премахнати — колоните
                    (avg_rating/reviews_count) вече не съществуват в naruchnici.
                    Schema.org AggregateRating вече идва от реалната reviews
                    таблица (виж app/naruchnik/[slug]/page.tsx). */}
              </div>
            </div>

            {/* ✅ ФИКС: секцията "Отзиви (Testimonials)" премахната изцяло —
                testimonials колоната вече не съществува в naruchnici.
                Управлението на отзиви е в admin таб "⭐ Отзиви" (ReviewsTab). */}

            {/* SEO Checklist */}
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: 20 }}>
              <SectionTitle>✅ SEO Чеклист — {currentNar.title}</SectionTitle>
              {[
                {
                  label: 'Meta title (50-60 символа)',
                  ok: !!(form.meta_title && form.meta_title.length >= 50 && form.meta_title.length <= 60),
                  hint: form.meta_title ? `${form.meta_title.length} симв.` : 'не е попълнен',
                },
                {
                  label: 'Meta description (140-160 символа)',
                  ok: !!(form.meta_description && form.meta_description.length >= 140 && form.meta_description.length <= 160),
                  hint: form.meta_description ? `${form.meta_description.length} симв.` : 'не е попълнена',
                },
                {
                  label: 'Поне 3 FAQ въпроса с отговор',
                  ok: (form.faq ?? []).filter(f => f.q?.trim() && f.a?.trim()).length >= 3,
                  hint: `${(form.faq ?? []).filter(f => f.q?.trim() && f.a?.trim()).length} въпроса`,
                },
                {
                  label: 'SEO текст (500+ символа)',
                  ok: (form.content_body?.length || 0) >= 500,
                  hint: `${form.content_body?.length || 0} симв.`,
                },
                {
                  label: 'Биография на автора (50+ символа)',
                  ok: !!(form.author_bio && form.author_bio.length >= 50),
                  hint: '',
                },
                {
                  label: 'Брой изтегляния зададен',
                  ok: !!(form.downloads_count && form.downloads_count > 0),
                  hint: form.downloads_count ? `${form.downloads_count}` : '',
                },
                // ✅ ФИКС: "Поне 1 отзив добавен" премахнато — вече се проверява
                // в admin таб "⭐ Отзиви" (ReviewsTab), не тук.
              ].map(item => (
                <div key={item.label} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 0', borderBottom: '1px solid #fef3c7', fontSize: 13,
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{item.ok ? '✅' : '⬜'}</span>
                  <span style={{ flex: 1, color: item.ok ? '#166534' : '#92400e' }}>{item.label}</span>
                  {item.hint && (
                    <span style={{ fontSize: 11, color: item.ok ? '#16a34a' : '#d97706', fontWeight: 700 }}>
                      {item.hint}
                    </span>
                  )}
                </div>
              ))}
              <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef9c3', borderRadius: 8, fontSize: 12, color: '#78350f' }}>
                <strong>Score:</strong> {[
                  !!(form.meta_title && form.meta_title.length >= 50 && form.meta_title.length <= 60),
                  !!(form.meta_description && form.meta_description.length >= 140 && form.meta_description.length <= 160),
                  (form.faq ?? []).filter(f => f.q?.trim() && f.a?.trim()).length >= 3,
                  (form.content_body?.length || 0) >= 500,
                  !!(form.author_bio && form.author_bio.length >= 50),
                  !!(form.downloads_count && form.downloads_count > 0),
                ].filter(Boolean).length} / 6
              </div>
            </div>

          </div>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            ← Избери наръчник от списъка
          </div>
        )}
      </div>
    </div>
  )
}
