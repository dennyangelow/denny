'use client'

// components/client/SafeImg.tsx — v2
// ✅ ФИКС: смени обикновен <img> с next/image — снимки от r2.dev/cloudfront/
//    supabase вече минават през вградения Next.js Image Optimizer (автоматично
//    смаляване + WebP/AVIF конверсия), вместо да се теглят в оригиналния,
//    често 3-4х по-голям от нужното, размер (виж PageSpeed "Improve image
//    delivery" — над 1MB спестявания установени). width/height подаваш от
//    извикващия компонент — те определят каква резолюция генерира Next.js,
//    реалният visual размер продължава да се управлява от style/className,
//    точно както преди.
// ✅ Fallback при грешка вече е през React state вместо императивна DOM
//    манипулация — по-чисто и съвместимо с hydration.

import { useState } from 'react'
import Image from 'next/image'

interface Props {
  src: string
  alt: string
  fallbackEmoji?: string
  style?: React.CSSProperties
  className?: string
  /** Хинт за Next.js Image Optimizer какъв размер да генерира. По подразбиране 300x300. */
  width?: number
  height?: number
}

export function SafeImg({
  src,
  alt,
  fallbackEmoji = '🌿',
  style,
  className,
  width = 300,
  height = 300,
}: Props) {
  const [errored, setErrored] = useState(false)

  if (!src || errored) {
    return (
      <span
        className={className}
        style={{
          fontSize: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          ...style,
        }}
      >
        {fallbackEmoji}
      </span>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      style={style}
      className={className}
      onError={() => setErrored(true)}
    />
  )
}
