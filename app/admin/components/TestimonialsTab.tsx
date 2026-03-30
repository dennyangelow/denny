'use client'
// app/admin/components/TestimonialsTab.tsx

import { useState, useEffect, useRef } from 'react'
import { toast } from '@/components/ui/Toast'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

interface Testimonial {
  id: string
  name: string
  location?: string
  text: string
  rating?: number
  avatar_url?: string
  avatar_storage_path?: string
  product?: string
  review_date?: string
  sort_order: number
  active: boolean
}

const EMPTY: Testimonial = {
  id: '', name: '', location: '', text: '', rating: 5,
  avatar_url: '', avatar_storage_path: '', product: '', review_date: '', sort_order: 0, active: true,
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1.5px solid #e5e7eb', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', background: '#fff',
}

function Stars({ rating, onChange }: { rating: number; onChange?: (r: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n}
          onClick={() => onChange?.(n)}
          style={{ fontSize: 20, cursor: onChange ? 'pointer' : 'default', color: n <= rating ? '#f59e0b' : '#d1d5db' }}>
          ★
        </span>
      ))}
    </div>
  )
}

function Modal({ onClose, title, children }: {
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 1001,
        transform: 'translate(-50%,-50%)',
        width: 'min(520px, 92vw)',
        maxHeight: '90vh', overflowY: 'auto',
        background: '#fff', borderRadius: 16, padding: 28,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{
            background: '#f5f5f5', border: 'none', borderRadius: 8,
            padding: '5px 10px', cursor: 'pointer', fontSize: 18,
            color: '#6b7280', lineHeight: 1,
          }}>✕</button>
        </div>
        {children}
      </div>
    </>
  )
}

// ── Avatar Upload Component ────────────────────────────────────────────────────
function AvatarUpload({
  currentUrl,
  currentPath,
  onUpload,
}: {
  currentUrl?: string
  currentPath?: string
  onUpload: (url: string, path: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(currentUrl || '')

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Само изображения (jpg, png, webp)')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Максимален размер 2MB')
      return
    }

    setUploading(true)
    try {
      // Show local preview immediately
      const localUrl = URL.createObjectURL(file)
      setPreview(localUrl)

      const ext = file.name.split('.').pop() || 'jpg'
      const path = `testimonials/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: false, contentType: file.type })

      if (error) throw error

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = urlData.publicUrl

      setPreview(publicUrl)
      onUpload(publicUrl, path)
      toast.success('✓ Снимката е качена')
    } catch (e: any) {
      toast.error(`Грешка при качване: ${e.message}`)
      setPreview(currentUrl || '')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
        Снимка (аватар)
      </label>

      {/* Drop zone / preview */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => !uploading && fileRef.current?.click()}
        style={{
          border: '2px dashed #d1d5db',
          borderRadius: 12,
          padding: 20,
          textAlign: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          background: '#f9fafb',
          transition: 'border-color .2s',
          position: 'relative',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#2d6a4f')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#d1d5db')}
      >
        {preview ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img
              src={preview}
              alt=""
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e5e7eb', flexShrink: 0 }}
            />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                {uploading ? '⏳ Качва се...' : '✓ Снимката е качена'}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                Кликни за да смениш
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{uploading ? '⏳' : '📷'}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
              {uploading ? 'Качва се...' : 'Кликни или провлачи снимка'}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
              JPG, PNG, WEBP · макс. 2MB
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />

      {/* Optional URL fallback */}
      <div style={{ marginTop: 8 }}>
        <input
          placeholder="или въведи URL на снимка..."
          value={!currentPath ? (currentUrl || '') : ''}
          onChange={e => {
            setPreview(e.target.value)
            onUpload(e.target.value, '')
          }}
          style={{ ...inp, fontSize: 12, color: '#6b7280' }}
        />
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function TestimonialsTab() {
  const [items,   setItems]   = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [editing, setEditing] = useState<Testimonial | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/testimonials?all=true')
      const { testimonials } = await res.json()
      setItems(testimonials || [])
    } catch { toast.error('Грешка при зареждане') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!editing) return
    if (!editing.name.trim() || !editing.text.trim()) {
      toast.error('Името и текстът са задължителни')
      return
    }
    setSaving(true)
    try {
      const isNew  = !editing.id
      const url    = isNew ? '/api/testimonials' : `/api/testimonials/${editing.id}`
      const method = isNew ? 'POST' : 'PATCH'

      // Don't send 'id' on create
      const { id, ...body } = editing
      const payload = isNew ? body : editing

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(isNew ? '✓ Добавен отзив' : '✓ Запазено')
      setEditing(null)
      load()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const del = async (id: string, storagePath?: string) => {
    if (!confirm('Изтрий този отзив?')) return
    try {
      // Delete avatar from storage if exists
      if (storagePath) {
        await supabase.storage.from('avatars').remove([storagePath])
      }
      await fetch(`/api/testimonials/${id}`, { method: 'DELETE' })
      toast.success('Изтрито')
      setItems(prev => prev.filter(t => t.id !== id))
      if (editing?.id === id) setEditing(null)
    } catch { toast.error('Грешка') }
  }

  const toggleActive = async (item: Testimonial) => {
    try {
      await fetch(`/api/testimonials/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !item.active }),
      })
      setItems(prev => prev.map(t => t.id === item.id ? { ...t, active: !t.active } : t))
    } catch { toast.error('Грешка') }
  }

  const updateOrder = async (item: Testimonial, delta: number) => {
    const newOrder = item.sort_order + delta
    try {
      await fetch(`/api/testimonials/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: newOrder }),
      })
      setItems(prev => prev.map(t => t.id === item.id ? { ...t, sort_order: newOrder } : t))
    } catch { toast.error('Грешка') }
  }

  const set = (k: keyof Testimonial, v: any) =>
    setEditing(prev => prev ? { ...prev, [k]: v } : prev)

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'inherit' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: '-.02em' }}>⭐ Отзиви</h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
            {items.length} отзива · {items.filter(t => t.active).length} активни
          </p>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY, sort_order: items.length + 1 })}
          style={{ background: '#1b4332', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
          + Нов отзив
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Зарежда...</div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Няма отзиви</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map(item => (
            <div key={item.id}
              style={{
                background: '#fff',
                border: `1.5px solid ${editing?.id === item.id ? '#2d6a4f' : '#e5e7eb'}`,
                borderRadius: 12, padding: '14px 16px',
                display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>

              {/* Sort */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                <button onClick={() => updateOrder(item, -1)}
                  style={{ background: '#f3f4f6', border: 'none', borderRadius: 5, width: 24, height: 22, cursor: 'pointer', fontSize: 11 }}>▲</button>
                <span style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', fontWeight: 700 }}>{item.sort_order}</span>
                <button onClick={() => updateOrder(item, 1)}
                  style={{ background: '#f3f4f6', border: 'none', borderRadius: 5, width: 24, height: 22, cursor: 'pointer', fontSize: 11 }}>▼</button>
              </div>

              {/* Avatar */}
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#15803d', flexShrink: 0, overflow: 'hidden' }}>
                {item.avatar_url
                  ? <img src={item.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (item.name[0] || '?').toUpperCase()
                }
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</span>
                  {item.location && <span style={{ fontSize: 11, color: '#9ca3af' }}>📍 {item.location}</span>}
                  {item.rating && <Stars rating={item.rating} />}
                  <span style={{ fontSize: 11, padding: '2px 8px', background: item.active ? '#dcfce7' : '#fee2e2', color: item.active ? '#065f46' : '#991b1b', borderRadius: 99, fontWeight: 700 }}>
                    {item.active ? '✓ Активен' : '✗ Скрит'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                  {item.product && <span style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 700 }}>🛒 {item.product}</span>}
                  {item.review_date && <span style={{ fontSize: 11, color: '#9ca3af' }}>📅 {item.review_date}</span>}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{item.text}"</div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => toggleActive(item)}
                  style={{ background: item.active ? '#fee2e2' : '#dcfce7', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontSize: 12 }}>
                  {item.active ? '🙈' : '👁️'}
                </button>
                <button onClick={() => setEditing({ ...item })}
                  style={{ background: '#f3f4f6', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>
                  ✏️
                </button>
                <button onClick={() => del(item.id, item.avatar_storage_path)}
                  style={{ background: '#fee2e2', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontSize: 12 }}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: Edit / Add ─────────────────────────────────────────────── */}
      {editing && (
        <Modal
          onClose={() => setEditing(null)}
          title={editing.id ? '✏️ Редактирай отзив' : '+ Нов отзив'}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Име *</label>
              <input value={editing.name} onChange={e => set('name', e.target.value)}
                placeholder="Иван Петров" style={inp}
                onFocus={e => (e.target.style.borderColor = '#2d6a4f')}
                onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Местоположение</label>
              <input value={editing.location || ''} onChange={e => set('location', e.target.value)}
                placeholder="София, България" style={inp}
                onFocus={e => (e.target.style.borderColor = '#2d6a4f')}
                onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Отзив *</label>
              <textarea rows={4} value={editing.text} onChange={e => set('text', e.target.value)}
                placeholder="Отличен продукт! Резултатите са невероятни..."
                style={{ ...inp, resize: 'vertical' }}
                onFocus={e => (e.target.style.borderColor = '#2d6a4f')}
                onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Оценка</label>
              <Stars rating={editing.rating || 5} onChange={r => set('rating', r)} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Продукт (незадължително)</label>
              <input value={editing.product || ''} onChange={e => set('product', e.target.value)}
                placeholder="Atlas Terra" style={inp}
                onFocus={e => (e.target.style.borderColor = '#2d6a4f')}
                onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Дата на отзива (незадължително)</label>
              <input
                value={editing.review_date || ''}
                onChange={e => set('review_date', e.target.value)}
                placeholder="март 2025"
                style={inp}
                onFocus={e => (e.target.style.borderColor = '#2d6a4f')}
                onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                Пример: март 2025, февруари 2025 — показва се под името
              </div>
            </div>

            {/* ── Avatar Upload ── */}
            <AvatarUpload
              currentUrl={editing.avatar_url}
              currentPath={editing.avatar_storage_path}
              onUpload={(url, path) => {
                set('avatar_url', url)
                set('avatar_storage_path', path)
              }}
            />

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Ред (sort_order)</label>
              <input type="number" value={editing.sort_order} onChange={e => set('sort_order', Number(e.target.value))}
                style={inp} min="0"
                onFocus={e => (e.target.style.borderColor = '#2d6a4f')}
                onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '10px 12px', background: '#f9fafb', borderRadius: 8 }}>
              <input type="checkbox" checked={editing.active} onChange={e => set('active', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#2d6a4f' }} />
              Активен (видим на сайта)
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={() => setEditing(null)}
              style={{ flex: 1, padding: '11px 0', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>
              Отказ
            </button>
            <button onClick={save} disabled={saving}
              style={{ flex: 2, padding: '11px 0', background: saving ? '#9ca3af' : '#1b4332', color: '#fff', border: 'none', borderRadius: 10, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
              {saving ? '⏳ Запазва...' : '✓ Запази'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
