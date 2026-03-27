'use client'
// components/ui/ImageUpload.tsx — Подобрен Drag & Drop upload компонент

import { useState, useRef, useCallback } from 'react'

interface Props {
  value: string       // текущ URL от базата данни
  onChange: (url: string) => void
  folder?: string     // 'products' | 'affiliate' | 'naruchnici'
  label?: string
  height?: number
}

export function ImageUpload({ value, onChange, folder = 'products', label = 'Снимка', height = 160 }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useCallback(async (file: File) => {
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', folder)

      // ВАЖНО: Увери се, че имаш файл app/api/upload/route.ts
      const res = await fetch('/api/upload', { 
        method: 'POST', 
        body: fd 
      })
      
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Upload грешка')
      
      // Подаваме новия URL към родителския компонент
      onChange(data.url)
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message || 'Грешка при качване на файла')
    } finally {
      setUploading(false)
    }
  }, [folder, onChange])

  const handleFile = (file: File | null | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { 
      setError('Моля, избери валиден формат (JPG, PNG, WebP)')
      return 
    }
    if (file.size > 5 * 1024 * 1024) { 
      setError('Снимката е твърде голяма (макс. 5MB)')
      return 
    }
    upload(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div style={{ marginBottom: 15 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, display: 'block' }}>
        {label}
      </label>

      {/* Зона за качване / Преглед */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          border: `2px dashed ${dragging ? '#2d6a4f' : value ? '#2d6a4f' : '#d1d5db'}`,
          borderRadius: 12,
          cursor: uploading ? 'wait' : 'pointer',
          overflow: 'hidden',
          position: 'relative',
          height,
          background: dragging ? '#f0fdf4' : value ? '#fff' : '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all .2s ease-in-out',
        }}
      >
        {uploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div className="upload-spinner" />
            <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Качване...</span>
          </div>
        ) : value ? (
          <>
            <img
              src={value}
              alt="Preview"
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 10 }}
            />
            {/* Overlay при посочване с мишката */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: isHovered ? 'rgba(0,0,0,0.4)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background .2s',
            }}>
              {isHovered && (
                <span style={{ 
                  color: '#fff', 
                  fontSize: 12, 
                  fontWeight: 600, 
                  padding: '8px 14px', 
                  background: 'rgba(0,0,0,0.6)', 
                  borderRadius: 20,
                  backdropFilter: 'blur(4px)'
                }}>
                  🔄 Смени снимката
                </span>
              )}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>☁️</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Избери файл или го плъзни тук
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>JPEG, PNG, WebP до 5MB</div>
          </div>
        )}
      </div>

      {/* Ръчно въвеждане на URL (fallback) */}
      <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="url"
          placeholder="Или постави линк към снимка..."
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            flex: 1, padding: '10px 14px', border: '1px solid #e5e7eb',
            borderRadius: 10, fontSize: 12, outline: 'none', 
            color: '#111', background: '#fff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            title="Изчисти"
            style={{ 
              background: '#fee2e2', border: 'none', borderRadius: 10, 
              padding: '10px 12px', cursor: 'pointer', color: '#991b1b' 
            }}
          >
            ✕
          </button>
        )}
      </div>

      {error && (
        <div style={{ 
          marginTop: 8, fontSize: 12, color: '#b91c1c', 
          background: '#fef2f2', borderRadius: 8, padding: '8px 12px',
          border: '1px solid #fecaca'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Скрит оригинален input за файлове */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files?.[0])}
      />

      <style>{`
        .upload-spinner {
          width: 30px;
          height: 30px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #2d6a4f;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}