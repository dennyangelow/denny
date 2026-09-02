'use client'
// components/ui/ImageUpload.tsx — Drag & Drop + File picker + URL fallback
// ✅ Добавено: клиентска компресия/resize преди качване — по-малки файлове,
//    по-бърз сайт, по-малко storage. Работи automatично навсякъде, където
//    се ползва компонентът (главна снимка, галерия, наръчници и т.н.)

import { useState, useRef, useCallback } from 'react'

interface Props {
  value: string
  onChange: (url: string) => void
  folder?: string
  label?: string
  height?: number
  // ✅ Продуктово име/slug — прави файловото име описателно за SEO
  //    (armonika-pk-25-32-a1b2c.webp вместо случайни символи)
  nameHint?: string
}

const MAX_RAW_MB   = 15   // лимит за оригиналния файл, преди компресия
const MAX_DIMENSION = 1600 // px по дългата страна след resize
const WEBP_QUALITY   = 0.82

// ── Смалява/компресира снимка чрез <canvas>, връща нов File (WebP) ─────────
// GIF-ове (могат да са анимирани) се качват без промяна — canvas ще ги "убие"
function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    if (file.type === 'image/gif') { resolve(file); return }

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let { width, height } = img
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height)
        width  = Math.round(width * scale)
        height = Math.round(height * scale)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        blob => {
          if (!blob) { resolve(file); return }
          // Ако компресията не помага (малка снимка вече), пази оригинала
          if (blob.size >= file.size) { resolve(file); return }
          const newName = file.name.replace(/\.[^.]+$/, '') + '.webp'
          resolve(new File([blob], newName, { type: 'image/webp' }))
        },
        'image/webp',
        WEBP_QUALITY
      )
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file) }
    img.src = objectUrl
  })
}

export function ImageUpload({ value, onChange, folder = 'products', label = 'Снимка', height = 160, nameHint }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const [dragging, setDragging]   = useState(false)
  const [progress, setProgress]   = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useCallback(async (file: File) => {
    setUploading(true)
    setError('')
    setProgress(10)
    try {
      setProgress(20)
      const compressed = await compressImage(file)
      setProgress(40)

      const fd = new FormData()
      fd.append('file', compressed)
      fd.append('folder', folder)
      if (nameHint) fd.append('nameHint', nameHint)

      setProgress(55)
      const res  = await fetch('/api/uploads', { method: 'POST', body: fd })
      setProgress(85)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Upload грешка')
      setProgress(100)
      onChange(data.url)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
      setTimeout(() => setProgress(0), 500)
    }
  }, [folder, onChange, nameHint])

  const handleFile = (file: File | null | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Само изображения (JPEG, PNG, WebP, GIF)'); return }
    if (file.size > MAX_RAW_MB * 1024 * 1024) { setError(`Максимален размер: ${MAX_RAW_MB}MB`); return }
    upload(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const borderColor = dragging ? '#2d6a4f' : value ? '#d1fae5' : error ? '#fca5a5' : '#e5e7eb'
  const bgColor     = dragging ? '#f0fdf4' : value ? '#f9fafb' : '#fafafa'

  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, display: 'block' }}>
        {label}
      </label>

      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${borderColor}`,
          borderRadius: 12,
          cursor: uploading ? 'wait' : 'pointer',
          overflow: 'hidden',
          position: 'relative',
          height,
          background: bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all .2s',
        }}
      >
        {/* Progress bar */}
        {uploading && progress > 0 && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, height: 3,
            width: `${progress}%`, background: '#2d6a4f',
            transition: 'width .3s ease', borderRadius: '0 2px 0 0',
          }} />
        )}

        {uploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#2d6a4f', borderRadius: '50%', animation: 'img-spin .7s linear infinite' }} />
            <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Качва се... {progress}%</span>
          </div>
        ) : value ? (
          <>
            <img src={value} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
            <div
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.45)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}
            >
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, background: 'rgba(0,0,0,.55)', padding: '8px 16px', borderRadius: 8, opacity: 0, transition: 'opacity .2s', pointerEvents: 'none' }}
                ref={el => {
                  if (el) {
                    el.parentElement!.addEventListener('mouseenter', () => { el.style.opacity = '1' })
                    el.parentElement!.addEventListener('mouseleave', () => { el.style.opacity = '0' })
                  }
                }}
              >
                🔄 Смени снимката
              </span>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🖼️</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Кликни или плъзни снимка тук
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>JPEG, PNG, WebP, GIF · до {MAX_RAW_MB}MB · автоматично се смалява</div>
          </div>
        )}
      </div>

      {/* URL input fallback
          ✅ ФИКС: input-ът беше `flex: 1` без `minWidth: 0` — по подразбиране
          браузърът не свива <input> под собствената му min-content ширина
          (~170-190px), затова в тесен родителски ред (block editor панел на
          мобилен) редът изтичаше извън екрана. Добавен и minWidth:0 на
          самия wrapper за същата причина. */}
      <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
        <input
          type="url"
          placeholder="или въведи URL на снимка..."
          value={value}
          onChange={e => { setError(''); onChange(e.target.value) }}
          style={{ flex: 1, minWidth: 0, padding: '8px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}
          onFocus={e => e.target.style.borderColor = '#2d6a4f'}
          onBlur={e => e.target.style.borderColor = '#e5e7eb'}
        />
        {value && (
          <button type="button" onClick={() => onChange('')} style={{ background: '#fee2e2', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: '#991b1b', fontSize: 13 }}>
            ✕
          </button>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#dc2626', background: '#fee2e2', borderRadius: 6, padding: '6px 10px' }}>
          ⚠️ {error}
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
      <style>{`@keyframes img-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
