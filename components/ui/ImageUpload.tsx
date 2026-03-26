'use client'
// components/ui/ImageUpload.tsx — Drag & Drop upload компонент

import { useState, useRef, useCallback } from 'react'

interface Props {
  value: string       // текущ URL
  onChange: (url: string) => void
  folder?: string     // 'products' | 'affiliate' | 'naruchnici'
  label?: string
  height?: number
}

export function ImageUpload({ value, onChange, folder = 'products', label = 'Снимка', height = 140 }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useCallback(async (file: File) => {
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', folder)

      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Upload грешка')
      onChange(data.url)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }, [folder, onChange])

  const handleFile = (file: File | null | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Само изображения'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Максимум 5MB'); return }
    upload(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, display: 'block' }}>
        {label}
      </label>

      {/* Preview or Drop Zone */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? '#2d6a4f' : value ? '#d1fae5' : '#d1d5db'}`,
          borderRadius: 12,
          cursor: uploading ? 'wait' : 'pointer',
          overflow: 'hidden',
          position: 'relative',
          height,
          background: dragging ? '#f0fdf4' : value ? '#f9fafb' : '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all .2s',
        }}
      >
        {uploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#2d6a4f', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            <span style={{ fontSize: 13, color: '#6b7280' }}>Качва се...</span>
          </div>
        ) : value ? (
          <>
            <img
              src={value}
              alt="preview"
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background .2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.35)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}
            >
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, opacity: 0, transition: 'opacity .2s', padding: '8px 16px', background: 'rgba(0,0,0,.5)', borderRadius: 8 }}
                onMouseEnter={e => { (e.currentTarget.style.opacity = '1'); (e.currentTarget.parentElement!.style.background = 'rgba(0,0,0,0.35)') }}
                onMouseLeave={e => { (e.currentTarget.style.opacity = '0'); (e.currentTarget.parentElement!.style.background = 'rgba(0,0,0,0)') }}
              >
                🔄 Смени снимката
              </span>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🖼️</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Кликни или плъзни снимка тук
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>JPEG, PNG, WebP · до 5MB</div>
          </div>
        )}
      </div>

      {/* URL input (fallback) */}
      <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="url"
          placeholder="или въведи URL на снимка..."
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            flex: 1, padding: '8px 12px', border: '1.5px solid #e5e7eb',
            borderRadius: 8, fontSize: 12, fontFamily: 'inherit',
            outline: 'none', color: '#111', background: '#fff',
          }}
          onFocus={e => e.target.style.borderColor = '#2d6a4f'}
          onBlur={e => e.target.style.borderColor = '#e5e7eb'}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            style={{ background: '#fee2e2', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: '#991b1b', fontSize: 13 }}
          >
            ✕
          </button>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#dc2626', background: '#fee2e2', borderRadius: 6, padding: '6px 10px' }}>
          ⚠️ {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files?.[0])}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
