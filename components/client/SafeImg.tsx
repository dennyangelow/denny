'use client'

// components/client/SafeImg.tsx — v3
// ✅ ФИКС спрямо v2: добавен `priority` prop — БЕЗ него Next.js third-parties
//    всяка снимка (вкл. hero/LCP изображението) като lazy-loaded, което бави
//    Largest Contentful Paint. Извикващият компонент трябва да подаде
//    priority={true} САМО за снимката, която е видима над первия fold
//    (напр. главната продуктова снимка на hero секцията) — за всичко друго
//    (продуктови карти надолу по страницата, галерии) priority остава false
//    по подразбиране, за да не пречи на lazy loading там, където е полезно.
// ✅ ФИКС: добавен `sizes` prop — позволява на Next.js Image Optimizer да
//    генерира по-прецизен srcset спрямо реалния viewport, вместо по-тежкия
//    default. Ако не подадеш sizes, поведението е same as v2 (fallback към
//    ширината в px), значи backward-compatible.
// ✅ Запазено от v2: next/image конверсия, React state fallback при грешка.

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
  /**
   * Сложи true САМО за снимката, която е LCP елементът на страницата
   * (напр. главната hero/продуктова снимка над fold-а). Preaload-ва я и
   * я маха от lazy-loading опашката — не слагай true навсякъде, ще
   * навреди на performance вместо да помогне.
   */
  priority?: boolean
  /**
   * Responsive size hint за по-прецизен srcset избор от браузъра.
   * Пример: "(max-width: 768px) 100vw, 300px"
   * Ако не подадеш нищо, Next.js ползва фиксирания width за изчисление.
   */
  sizes?: string
}

export function SafeImg({
  src,
  alt,
  fallbackEmoji = '🌿',
  style,
  className,
  width = 300,
  height = 300,
  priority = false,
  sizes,
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
      priority={priority}
      sizes={sizes}
      onError={() => setErrored(true)}
    />
  )
}
