'use client'

// components/client/SafeImg.tsx
// Обикновен img с onError fallback — трябва client заради event handler-а

interface Props {
  src: string
  alt: string
  fallbackEmoji?: string
  style?: React.CSSProperties
  className?: string
}

export function SafeImg({ src, alt, fallbackEmoji = '🌿', style, className }: Props) {
  return (
    <img
      src={src}
      alt={alt}
      style={style}
      className={className}
      onError={e => {
        const img = e.currentTarget as HTMLImageElement
        img.style.display = 'none'
        const w = img.parentElement
        if (w) w.innerHTML = `<span style="font-size:72px;display:flex;align-items:center;justify-content:center;height:100%">${fallbackEmoji}</span>`
      }}
    />
  )
}
