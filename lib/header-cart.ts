// lib/header-cart.ts — v1
// ✅ НОВ файл. Чете настройките за количката в менюто за страници, които
//    нямат количка по подразбиране (afiliate продукти, /produkti каталог,
//    блог, наръчници). Управлява се от админ панела — SettingsTab.tsx,
//    секция "🛒 Количка по страници".
//
// Settings стойностите идват като плосък Record<string, string> (същия
// формат, който /api/settings връща и SettingsTab.tsx използва). За всяка
// страница пазим 3 отделни ключа:
//   cart_<page>_enabled  → 'true' | 'false'
//   cart_<page>_label    → текст на бутона, когато количката е изключена
//   cart_<page>_href     → линк на бутона, когато количката е изключена
//
// Началната страница и /products/[slug] НЕ минават през този helper —
// количката там винаги е активна (виж HeaderClient.tsx).

export type HeaderCartPageKey = 'produkt' | 'produkti' | 'blog' | 'naruchnik'

export interface HeaderCartConfig {
  enabled: boolean
  label:   string
  href:    string
}

// Разумни fallback стойности — ползват се, ако админ никога не е пипал
// настройката, или ако fetch-ът на settings се провали по някаква причина.
const DEFAULTS: Record<HeaderCartPageKey, HeaderCartConfig> = {
  produkt:   { enabled: false, label: '🌾 Всички продукти', href: '/produkti' },
  produkti:  { enabled: false, label: '🏠 Начало',          href: '/' },
  blog:      { enabled: false, label: '🛍️ Продукти',        href: '/produkti' },
  naruchnik: { enabled: false, label: '🏠 Начало',          href: '/' },
}

export function getHeaderCartConfig(
  settings: Record<string, string> | null | undefined,
  pageKey:  HeaderCartPageKey,
): HeaderCartConfig {
  const fallback = DEFAULTS[pageKey]
  if (!settings) return fallback

  const enabledRaw = settings[`cart_${pageKey}_enabled`]
  const labelRaw   = settings[`cart_${pageKey}_label`]
  const hrefRaw    = settings[`cart_${pageKey}_href`]

  return {
    enabled: enabledRaw === 'true' ? true : enabledRaw === 'false' ? false : fallback.enabled,
    label:   labelRaw?.trim() ? labelRaw : fallback.label,
    href:    hrefRaw?.trim()  ? hrefRaw  : fallback.href,
  }
}
