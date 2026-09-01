'use client'
// app/admin/components/BlogTab.tsx — v1
// Admin таб за блог постовете. Съдържанието се пази като масив от типизирани
// блокове (paragraph/heading/image/quote/list/product_embed/faq) — не суров
// HTML — за да контролираме напълно рендъринга на публичната страница
// (Next/Image, lazy loading, product карти), точно както описано в
// lib/blog.ts и в SQL коментарите на blog_posts таблицата.
//
// Визуалният и функционален модел (inp стил, focusGreen/blurGray, save/del/
// list rendering, ImageUpload/toast usage) следва 1:1 ContentTab.tsx, за да
// не изглежда като чуждо тяло в admin панела.
//
// ⚠️ Добави таб запис в lib/constants.ts (виж коментара в Sidebar.tsx):
//     { id: 'blog', label: 'Блог', icon: '📝' }
//   и добави <BlogTab /> в switch/if-а, който рендва активния таб в
//   app/admin/page.tsx (аналогично на <ContentTab />).

import { useState, useEffect, useCallback } from 'react'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { toast } from '@/components/ui/Toast'
import type { BlogPost, BlogBlock, BlogCategory } from '@/lib/blog'
import { CategoriesScreen } from '@/components/blog/CategoriesScreen'
import { BlogHealthPanel } from '@/components/blog/BlogHealthPanel'

// ─── Styles — идентични на ContentTab.tsx, за визуална консистентност ─────────
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1.5px solid #e5e7eb', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 16, outline: 'none',
  boxSizing: 'border-box', background: '#fff',
}
const focusGreen = (e: React.FocusEvent<HTMLElement>) => ((e.target as HTMLElement).style.borderColor = '#2d6a4f')
const blurGray   = (e: React.FocusEvent<HTMLElement>) => ((e.target as HTMLElement).style.borderColor = '#e5e7eb')

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Чернова',     color: '#92400e', bg: '#fffbeb' },
  published: { label: 'Публикуван',  color: '#166534', bg: '#dcfce7' },
  archived:  { label: 'Архивиран',   color: '#6b7280', bg: '#f3f4f6' },
}

function emptyPost(): Partial<BlogPost> {
  return {
    id: '', title: '', slug: '', excerpt: '', content: [],
    cover_image_url: '', cover_image_alt: '', category: 'domati', tags: [],
    seo_title: '', seo_description: '', related_affiliate_slugs: [], related_product_slugs: [],
    has_affiliate_links: false, status: 'draft', author_name: 'Denny Angelow', active: true,
  }
}

// ─── Block Editor ───────────────────────────────────────────────────────────
const BLOCK_TYPE_LABELS: Record<BlogBlock['type'], string> = {
  paragraph:     '¶ Параграф',
  heading:       '# Заглавие',
  image:         '🖼️ Снимка',
  quote:         '❝ Цитат',
  list:          '• Списък',
  product_embed: '🛒 Продуктова карта',
  faq:           '❓ FAQ',
}

function newBlock(type: BlogBlock['type']): BlogBlock {
  switch (type) {
    case 'paragraph':     return { type, text: '' }
    case 'heading':       return { type, level: 2, text: '' }
    case 'image':         return { type, url: '', alt: '', caption: '' }
    case 'quote':         return { type, text: '', author: '' }
    case 'list':          return { type, ordered: false, items: [] }
    case 'product_embed': return { type, product_type: 'own', slug: '', note: '' }
    case 'faq':           return { type, items: [] }
  }
}

function BlockEditor({ blocks, onChange }: { blocks: BlogBlock[]; onChange: (b: BlogBlock[]) => void }) {
  const update = (idx: number, block: BlogBlock) => onChange(blocks.map((b, i) => (i === idx ? block : b)))
  const remove = (idx: number) => onChange(blocks.filter((_, i) => i !== idx))
  const move   = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= blocks.length) return
    const next = [...blocks]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }
  const add = (type: BlogBlock['type']) => onChange([...blocks, newBlock(type)])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {blocks.length === 0 && (
        <div style={{ padding: 18, background: '#f9fafb', borderRadius: 10, border: '1px dashed #e5e7eb', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
          Постът е празен. Добави първия блок отдолу.
        </div>
      )}

      {blocks.map((block, idx) => (
        <div key={idx} style={{ border: '1.5px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#fafafa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              {BLOCK_TYPE_LABELS[block.type]}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0}
                style={{ ...miniBtn, opacity: idx === 0 ? 0.35 : 1 }}>↑</button>
              <button type="button" onClick={() => move(idx, 1)} disabled={idx === blocks.length - 1}
                style={{ ...miniBtn, opacity: idx === blocks.length - 1 ? 0.35 : 1 }}>↓</button>
              <button type="button" onClick={() => remove(idx)}
                style={{ ...miniBtn, background: '#fee2e2', color: '#991b1b' }}>✕</button>
            </div>
          </div>

          {block.type === 'paragraph' && (
            <textarea rows={4} value={block.text} placeholder="Текст на параграфа..."
              onChange={e => update(idx, { ...block, text: e.target.value })}
              style={{ ...inp, resize: 'vertical' }} onFocus={focusGreen} onBlur={blurGray} />
          )}

          {block.type === 'heading' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={block.level} onChange={e => update(idx, { ...block, level: Number(e.target.value) as 2 | 3 })}
                style={{ ...inp, width: 90, flexShrink: 0 }}>
                <option value={2}>H2</option>
                <option value={3}>H3</option>
              </select>
              <input value={block.text} placeholder="Текст на заглавието"
                onChange={e => update(idx, { ...block, text: e.target.value })}
                style={inp} onFocus={focusGreen} onBlur={blurGray} />
            </div>
          )}

          {block.type === 'image' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ImageUpload value={block.url} onChange={url => update(idx, { ...block, url })}
                folder="blog" label="Снимка" height={140} nameHint={block.alt} />
              <input value={block.alt} placeholder="Alt текст (SEO — задължително)"
                onChange={e => update(idx, { ...block, alt: e.target.value })}
                style={inp} onFocus={focusGreen} onBlur={blurGray} />
              <input value={block.caption || ''} placeholder="Надпис под снимката (по избор)"
                onChange={e => update(idx, { ...block, caption: e.target.value })}
                style={{ ...inp, fontSize: 13 }} onFocus={focusGreen} onBlur={blurGray} />
            </div>
          )}

          {block.type === 'quote' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea rows={3} value={block.text} placeholder="Текст на цитата..."
                onChange={e => update(idx, { ...block, text: e.target.value })}
                style={{ ...inp, resize: 'vertical' }} onFocus={focusGreen} onBlur={blurGray} />
              <input value={block.author || ''} placeholder="Автор (по избор)"
                onChange={e => update(idx, { ...block, author: e.target.value })}
                style={{ ...inp, fontSize: 13 }} onFocus={focusGreen} onBlur={blurGray} />
            </div>
          )}

          {block.type === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: '#374151' }}>
                <input type="checkbox" checked={block.ordered}
                  onChange={e => update(idx, { ...block, ordered: e.target.checked })}
                  style={{ accentColor: '#2d6a4f' }} />
                Номериран списък
              </label>
              <textarea rows={4} value={block.items.join('\n')} placeholder="По един елемент на ред"
                onChange={e => update(idx, { ...block, items: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                style={{ ...inp, resize: 'vertical' }} onFocus={focusGreen} onBlur={blurGray} />
            </div>
          )}

          {block.type === 'product_embed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={block.product_type}
                  onChange={e => update(idx, { ...block, product_type: e.target.value as 'affiliate' | 'own' })}
                  style={{ ...inp, width: 140, flexShrink: 0 }}>
                  <option value="own">Собствен (Atlas Terra)</option>
                  <option value="affiliate">Афилиейт</option>
                </select>
                <input value={block.slug} placeholder="slug на продукта (напр. atlas-terra)"
                  onChange={e => update(idx, { ...block, slug: e.target.value })}
                  style={{ ...inp, fontFamily: 'monospace' }} onFocus={focusGreen} onBlur={blurGray} />
              </div>
              <input value={block.note || ''} placeholder="Кратък текст над картата (по избор)"
                onChange={e => update(idx, { ...block, note: e.target.value })}
                style={{ ...inp, fontSize: 13 }} onFocus={focusGreen} onBlur={blurGray} />
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                На публичната страница линкът автоматично получава <code>rel="sponsored nofollow"</code> ако е афилиейт.
              </div>
            </div>
          )}

          {block.type === 'faq' && (
            <FaqBlockEditor items={block.items} onChange={items => update(idx, { ...block, items })} />
          )}
        </div>
      ))}

      {/* Add block bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {(Object.keys(BLOCK_TYPE_LABELS) as BlogBlock['type'][]).map(t => (
          <button key={t} type="button" onClick={() => add(t)}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px dashed #d1d5db', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, color: '#6b7280', fontWeight: 600 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2d6a4f'; (e.currentTarget as HTMLElement).style.color = '#2d6a4f' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
            + {BLOCK_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
    </div>
  )
}

const miniBtn: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 6, border: 'none', background: '#eef2f7',
  color: '#374151', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

function FaqBlockEditor({ items, onChange }: { items: { q: string; a: string }[]; onChange: (v: { q: string; a: string }[]) => void }) {
  const update = (i: number, field: 'q' | 'a', val: string) => onChange(items.map((it, idx) => idx === i ? { ...it, [field]: val } : it))
  const add    = () => onChange([...items, { q: '', a: '' }])
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, background: '#fff', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={it.q} placeholder="Въпрос" onChange={e => update(i, 'q', e.target.value)}
              style={{ ...inp, fontSize: 13 }} onFocus={focusGreen} onBlur={blurGray} />
            <button type="button" onClick={() => remove(i)} style={{ ...miniBtn, background: '#fee2e2', color: '#991b1b', flexShrink: 0 }}>✕</button>
          </div>
          <textarea rows={2} value={it.a} placeholder="Отговор" onChange={e => update(i, 'a', e.target.value)}
            style={{ ...inp, fontSize: 13, resize: 'vertical' }} onFocus={focusGreen} onBlur={blurGray} />
        </div>
      ))}
      <button type="button" onClick={add}
        style={{ padding: '7px', border: '1.5px dashed #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12.5, color: '#6b7280', fontFamily: 'inherit', fontWeight: 600 }}>
        + Добави въпрос
      </button>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────
export function BlogTab() {
  const [posts,   setPosts]   = useState<Partial<BlogPost>[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Partial<BlogPost> | null>(null)
  const [saving,  setSaving]  = useState(false)
  // ✅ Категориите вече идват от blog_categories таблицата, не hardcoded.
  const [categories, setCategories] = useState<BlogCategory[]>([])
  // ✅ Три под-таба: Постове (по подразбиране) / Категории / SEO и здраве —
  //    категориите вече не са toggle вътре в пост, а самостоятелен екран.
  const [tab, setTab] = useState<'posts' | 'categories' | 'health'>('posts')

  const loadCategories = useCallback(async () => {
    try {
      const res  = await fetch('/api/blog-categories')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCategories(data.categories || [])
    } catch (e: any) {
      toast.error('Грешка при зареждане на категориите: ' + e.message)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/blog?includeDrafts=1')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPosts(data.posts || [])
    } catch (e: any) {
      toast.error('Грешка при зареждане: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(); loadCategories() }, [load, loadCategories])

  const set = (key: keyof BlogPost, val: any) => setEditing(prev => prev ? { ...prev, [key]: val } : null)

  const save = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const payload = { ...editing }
      const isNew = !payload.id
      const url   = isNew ? '/api/blog' : `/api/blog/${payload.id}`
      const res   = await fetch(url, {
        method:  isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `HTTP ${res.status}`)
      }
      toast.success(isNew ? 'Постът е създаден!' : 'Запазено успешно!')
      setEditing(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const del = async (id: string) => {
    if (!confirm('Сигурен ли си, че искаш да изтриеш този пост?')) return
    try {
      const res = await fetch(`/api/blog/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success('Изтрито успешно')
      if (editing?.id === id) setEditing(null)
      load()
    } catch (e: any) {
      toast.error('Грешка при изтриване: ' + e.message)
    }
  }

  return (
    <div style={{ padding: '16px 14px' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:768px){.blog-edit-panel{position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;max-height:100vh!important;border-radius:0!important;z-index:200;overflow-y:auto}}`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>
          📝 Блог
        </h1>
        {tab === 'posts' && (
          <button onClick={() => setEditing(emptyPost())}
            style={{ background: '#1b4332', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
            + Нов пост
          </button>
        )}
      </div>

      {/* ── Под-табове ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {([
          { id: 'posts',      label: `Постове (${posts.length})` },
          { id: 'categories', label: `Категории (${categories.length})` },
          { id: 'health',     label: '🩺 SEO и здраве' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              padding: '10px 14px', fontSize: 13.5, fontWeight: 700,
              color: tab === t.id ? '#1b4332' : '#9ca3af',
              borderBottom: tab === t.id ? '2.5px solid #1b4332' : '2.5px solid transparent',
              marginBottom: -1,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'posts' && (
      <div style={{ display: 'grid', gridTemplateColumns: editing ? 'minmax(0,1fr) min(480px,100%)' : '1fr', gap: 20 }}>

        {/* List */}
        <div>
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#2d6a4f', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
                Зарежда...
              </div>
            ) : posts.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                Няма постове. Натисни «+ Нов пост» за начало.
              </div>
            ) : posts.map((post, i) => {
              const statusInfo = STATUS_LABELS[post.status || 'draft']
              return (
                <div key={post.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < posts.length - 1 ? '1px solid #f5f5f5' : 'none', background: editing?.id === post.id ? '#f0fdf4' : '' }}>
                  {post.cover_image_url && (
                    <img src={post.cover_image_url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0, background: '#f3f4f6', border: '1px solid #e5e7eb' }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {post.title || '(без заглавие)'}
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ background: statusInfo.bg, color: statusInfo.color, padding: '1px 7px', borderRadius: 99, fontWeight: 700, fontSize: 11 }}>{statusInfo.label}</span>
                      {post.category && <span>{categories.find(c => c.slug === post.category)?.emoji || '📗'} {categories.find(c => c.slug === post.category)?.label || post.category}</span>}
                      {(post.content?.length || 0) > 0 && <span>· {post.content!.length} блока</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setEditing({ ...post })}
                      style={{ background: editing?.id === post.id ? '#dcfce7' : '#f3f4f6', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#374151', fontWeight: 600 }}>
                      ✏️ Редактирай
                    </button>
                    <button onClick={() => del(post.id!)}
                      style={{ background: '#fee2e2', border: 'none', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: '#991b1b' }}>✕</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Editor panel */}
        {editing && (
          <div className="blog-edit-panel" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20, maxHeight: '88vh', overflowY: 'auto', position: 'sticky', top: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{editing.id ? `✏️ ${editing.title || 'Редактирай'}` : '+ Нов пост'}</h3>
              <button onClick={() => setEditing(null)} style={{ background: '#f5f5f5', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', color: '#6b7280', fontSize: 16 }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Статус */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Статус</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['draft', 'published', 'archived'] as const).map(s => (
                    <button key={s} type="button" onClick={() => set('status', s)}
                      style={{
                        flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                        border: `1.5px solid ${editing.status === s ? '#2d6a4f' : '#e5e7eb'}`,
                        background: editing.status === s ? '#2d6a4f' : '#fff',
                        color: editing.status === s ? '#fff' : '#6b7280',
                      }}>
                      {STATUS_LABELS[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <ImageUpload value={editing.cover_image_url || ''} onChange={url => set('cover_image_url', url)}
                folder="blog" label="Корична снимка (LCP елемент на поста)" height={160} nameHint={editing.slug || editing.title} />

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Заглавие</label>
                <input value={editing.title || ''} onChange={e => set('title', e.target.value)}
                  placeholder="Как да разпознаеш липса на калций при домати" style={inp} onFocus={focusGreen} onBlur={blurGray} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Slug (URL)</label>
                <input value={editing.slug || ''} onChange={e => set('slug', e.target.value)}
                  placeholder="lipsa-na-kalciy-domati" style={{ ...inp, fontFamily: 'monospace' }} onFocus={focusGreen} onBlur={blurGray} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Alt текст на кориците</label>
                <input value={editing.cover_image_alt || ''} onChange={e => set('cover_image_alt', e.target.value)}
                  placeholder="Домати с симптоми на калциев дефицит" style={inp} onFocus={focusGreen} onBlur={blurGray} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Кратко резюме (excerpt — за картата в списъка)</label>
                <textarea rows={2} value={editing.excerpt || ''} onChange={e => set('excerpt', e.target.value)}
                  placeholder="Ако липсата не се коригира навреме..." style={{ ...inp, resize: 'vertical' }} onFocus={focusGreen} onBlur={blurGray} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Категория</label>
                <select value={editing.category || categories[0]?.slug || ''} onChange={e => set('category', e.target.value)} style={inp}>
                  {categories.map(c => (
                    <option key={c.slug} value={c.slug}>{c.emoji} {c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Тагове (през запетая)</label>
                <input value={(editing.tags || []).join(', ')}
                  onChange={e => set('tags', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="торене, калций, домати" style={inp} onFocus={focusGreen} onBlur={blurGray} />
              </div>

              {/* SEO divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <div style={{ height: 1, flex: 1, background: '#e5e7eb' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 99, padding: '3px 10px' }}>🔍 SEO</span>
                <div style={{ height: 1, flex: 1, background: '#e5e7eb' }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>SEO Title (ако е празно → заглавието)</label>
                <input value={editing.seo_title || ''} onChange={e => set('seo_title', e.target.value)}
                  placeholder="Липса на калций при домати — причини и лечение | Denny Angelow" style={inp} onFocus={focusGreen} onBlur={blurGray} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>SEO Description (ако е празно → excerpt)</label>
                <textarea rows={2} value={editing.seo_description || ''} onChange={e => set('seo_description', e.target.value)}
                  style={{ ...inp, resize: 'vertical' }} onFocus={focusGreen} onBlur={blurGray} />
              </div>

              {/* Affiliate divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <div style={{ height: 1, flex: 1, background: '#e5e7eb' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 99, padding: '3px 10px' }}>🔗 Affiliate</span>
                <div style={{ height: 1, flex: 1, background: '#e5e7eb' }} />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 600 }}>
                <input type="checkbox" checked={!!editing.has_affiliate_links}
                  onChange={e => set('has_affiliate_links', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#2d6a4f' }} />
                Постът съдържа affiliate линкове (показва disclosure банер горе)
              </label>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Свързани собствени продукти (slugs, през запетая)</label>
                <input value={(editing.related_product_slugs || []).join(', ')}
                  onChange={e => set('related_product_slugs', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="atlas-terra, atlas-terra-amino" style={{ ...inp, fontFamily: 'monospace', fontSize: 13 }} onFocus={focusGreen} onBlur={blurGray} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Свързани афилиейт продукти (slugs, през запетая)</label>
                <input value={(editing.related_affiliate_slugs || []).join(', ')}
                  onChange={e => set('related_affiliate_slugs', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="kristalon, ridomil-gold" style={{ ...inp, fontFamily: 'monospace', fontSize: 13 }} onFocus={focusGreen} onBlur={blurGray} />
              </div>

              {/* Content divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <div style={{ height: 1, flex: 1, background: '#e5e7eb' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 99, padding: '3px 10px' }}>✍️ Съдържание</span>
                <div style={{ height: 1, flex: 1, background: '#e5e7eb' }} />
              </div>

              <BlockEditor blocks={editing.content || []} onChange={v => set('content', v)} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setEditing(null)}
                style={{ flex: 1, padding: '10px', border: '1px solid var(--border)', borderRadius: 9, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: 'var(--text)' }}>
                Отказ
              </button>
              <button onClick={save} disabled={saving}
                style={{ flex: 2, padding: '10px', background: saving ? '#6b7280' : '#1b4332', color: '#fff', border: 'none', borderRadius: 9, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
                {saving ? '⏳ Запазва...' : '✓ Запази'}
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {tab === 'categories' && (
        <CategoriesScreen categories={categories} posts={posts} onChange={loadCategories} />
      )}

      {tab === 'health' && (
        <BlogHealthPanel
          posts={posts}
          categories={categories}
          onOpenPost={(post) => { setEditing(post); setTab('posts') }}
        />
      )}
    </div>
  )
}
