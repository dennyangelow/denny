// lib/blogRichText.tsx — v1
// ✅ Малка, безопасна помощна функция за inline линкове вътре в blog
//    content текст (paragraph, list items, quote, faq answers).
//
// ЗАЩО Е НУЖНО: BlogBlock текстовите полета се рендват като чист React
// текст (<p>{block.text}</p>), не през dangerouslySetInnerHTML — това е
// правилно и безопасно (няма риск от XSS през admin панела), но значи
// суров HTML таг <a href="..."> вътре в текста излиза буквално видим на
// страницата, не като кликаем линк.
//
// РЕШЕНИЕ: авторите пишат вътрешни/външни линкове в content-а с прост
// markdown-style синтаксис — [видим текст](/blog/друг-пост) — а тази
// функция ги парсва в реални React <a> елементи, без изобщо да минава
// през dangerouslySetInnerHTML. Остава 100% безопасно, защото просто
// строим React елементи от вече escape-натия по подразбиране низ.
//
// ✅ Позволени href-ове: само вътрешни пътища (започващи с "/") или
//    https:// линкове. Всичко друго (напр. javascript:) се игнорира —
//    рендва се само видимият текст, без <a> таг, вместо да се пропусне
//    рисково пренасочване.

import React from 'react'

export function renderRichText(text: string): React.ReactNode {
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const [, label, href] = match
    const isInternal = href.startsWith('/')
    const isExternal = href.startsWith('https://')

    if (isInternal || isExternal) {
      parts.push(
        <a
          key={`rt-${key++}`}
          href={href}
          {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {label}
        </a>
      )
    } else {
      // Небезопасен/непознат href формат — пазим видимия текст, махаме линка
      parts.push(label)
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : text
}

// ✅ За места, където имаме нужда от чист текст, не React nodes —
//    напр. schema.org/FAQPage JSON-LD в generateMetadata/page.tsx.
//    Маха [текст](линк) синтаксиса, оставя само видимия текст, за да не
//    изтече суров markdown в structured data, което Google чете буквално.
export function richTextToPlain(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}
