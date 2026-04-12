'use client'
// app/admin/components/NaruchnikSeoTab.tsx — v2 FIXED
// ПОПРАВКИ:
//   ✅ toast.success() / toast.error() — правилен API (не toast('msg','type'))
//   ✅ Премахнато form.description — не съществува в Partial<Naruchnik>
//   ✅ descPreview взима от form.meta_description || '' 

import { useState, useEffect, useRef } from 'react'
import { toast } from '@/components/ui/Toast'

interface NaruchnikSeo {
  id: string
  slug: string
  title: string
  category?: string
  active: boolean
  meta_title?: string
  meta_description?: string
  faq_q1?: string; faq_a1?: string
  faq_q2?: string; faq_a2?: string
  faq_q3?: string; faq_a3?: string
  content_body?: string
  author_bio?: string
  reviews_count?: number
  avg_rating?: number
  downloads_count?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1.5px solid #e5e7eb', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 13, outline: 'none',
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
  const [saving, setSaving]         = useState(false)
  const [dirty, setDirty]           = useState(false)
  const savedRef = useRef<Partial<NaruchnikSeo>>({})

  // Fetch all naruchnici on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/naruchnici')
        if (res.ok) {
          const data: NaruchnikSeo[] = await res.json()
          setNaruchnici(data)
          if (data.length > 0) {
            setSelected(data[0].id)
            setForm(data[0])
            savedRef.current = data[0]
          }
        } else {
          toast.error('Грешка при зареждане на наръчниците')
        }
      } catch {
        toast.error('Не може да се свърже със сървъра')
      }
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // When selected changes — sync form
  useEffect(() => {
    if (!selected) return
    const nar = naruchnici.find(n => n.id === selected)
    if (nar) {
      setForm(nar)
      savedRef.current = nar
      setDirty(false)
    }
  }, [selected, naruchnici])

  const update = (key: keyof NaruchnikSeo, value: string | number) => {
    setForm(f => ({ ...f, [key]: value }))
    setDirty(true)
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/naruchnici/${selected}/seo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meta_title:       form.meta_title       || null,
          meta_description: form.meta_description || null,
          faq_q1: form.faq_q1 || null, faq_a1: form.faq_a1 || null,
          faq_q2: form.faq_q2 || null, faq_a2: form.faq_a2 || null,
          faq_q3: form.faq_q3 || null, faq_a3: form.faq_a3 || null,
          content_body:     form.content_body     || null,
          author_bio:       form.author_bio       || null,
          reviews_count:    form.reviews_count    ? Number(form.reviews_count)  : null,
          avg_rating:       form.avg_rating       ? Number(form.avg_rating)     : null,
          downloads_count:  form.downloads_count  ? Number(form.downloads_count): null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Server error')
      }
      setNaruchnici(prev => prev.map(n => n.id === selected ? { ...n, ...form } as NaruchnikSeo : n))
      savedRef.current = form
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

  // ✅ FIXED: само meta_description — не form.description (не съществува)
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
        Няма намерени наръчници. Добави наръчник първо от таб "Продукти".
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>

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

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Left: Naruchnici list ── */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', position: 'sticky', top: 24 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', fontSize: 11, fontWeight: 800, color: '#6b7280', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Наръчници
          </div>
          {naruchnici.map(nar => (
            <button
              key={nar.id}
              onClick={() => { if (dirty) { if (!confirm('Имаш незапазени промени. Продължи?')) return } setSelected(nar.id) }}
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
              </div>
            </button>
          ))}
        </div>

        {/* ── Right: SEO Form ── */}
        {currentNar ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

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

              {([1, 2, 3] as const).map(n => (
                <div key={n} style={{ marginBottom: 16, padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', marginBottom: 10, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                    Въпрос {n}
                  </div>
                  <FieldGroup>
                    <Label>Въпрос</Label>
                    <input
                      style={inp}
                      value={(form[`faq_q${n}` as keyof NaruchnikSeo] as string) || ''}
                      onChange={e => update(`faq_q${n}` as keyof NaruchnikSeo, e.target.value)}
                      onFocus={onFocus} onBlur={onBlur}
                      placeholder={
                        n === 1 ? `Наистина ли е безплатен "${currentNar.title}"?`
                        : n === 2 ? `Какво съдържа "${currentNar.title}"?`
                        : 'Кога да приложа съветите от наръчника?'
                      }
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <Label>Отговор</Label>
                    <textarea
                      style={{ ...inp, minHeight: 70, resize: 'vertical' }}
                      value={(form[`faq_a${n}` as keyof NaruchnikSeo] as string) || ''}
                      onChange={e => update(`faq_a${n}` as keyof NaruchnikSeo, e.target.value)}
                      onFocus={onFocus} onBlur={onBlur}
                      placeholder="Пълен отговор — Google ще го показва директно в резултатите..."
                    />
                  </FieldGroup>
                </div>
              ))}
              <Hint>💡 FAQ въпросите се показват на страницата като accordion И в Google като "featured snippets" — директен отговор преди другите резултати.</Hint>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
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
                <FieldGroup>
                  <Label>Средна оценка (1-5)</Label>
                  <input
                    style={inp} type="number" step="0.1" min="1" max="5"
                    value={form.avg_rating ?? ''}
                    onChange={e => update('avg_rating', parseFloat(e.target.value) || 0)}
                    onFocus={onFocus} onBlur={onBlur}
                    placeholder="4.9"
                  />
                  <Hint>Schema.org AggregateRating</Hint>
                </FieldGroup>
                <FieldGroup>
                  <Label>Брой оценки</Label>
                  <input
                    style={inp} type="number" min="0"
                    value={form.reviews_count ?? ''}
                    onChange={e => update('reviews_count', parseInt(e.target.value) || 0)}
                    onFocus={onFocus} onBlur={onBlur}
                    placeholder="847"
                  />
                  <Hint>Schema.org reviewCount</Hint>
                </FieldGroup>
              </div>
            </div>

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
                  label: 'FAQ въпрос 1 + отговор',
                  ok: !!(form.faq_q1 && form.faq_a1),
                  hint: '',
                },
                {
                  label: 'FAQ въпрос 2 + отговор',
                  ok: !!(form.faq_q2 && form.faq_a2),
                  hint: '',
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
                  !!(form.faq_q1 && form.faq_a1),
                  !!(form.faq_q2 && form.faq_a2),
                  (form.content_body?.length || 0) >= 500,
                  !!(form.author_bio && form.author_bio.length >= 50),
                  !!(form.downloads_count && form.downloads_count > 0),
                ].filter(Boolean).length} / 7
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
