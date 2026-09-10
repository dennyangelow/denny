// lib/settings.ts — v1
// ✅ НОВ файл. Липсваше досега — currency.ts чете settings по един key
//    наведнъж (.eq('key', 'currency_symbol').single()), но няма bulk
//    четене на ВСИЧКИ настройки в един Record<string,string>, каквото е
//    нужно за header-cart конфигурацията (cart_produkt_enabled и т.н.)
//    и за всяко бъдещо място, което иска settings.some_key.
//
// Схемата на таблицата (потвърдена от lib/currency.ts): 'settings' с
// колони key / value — не единичен ред с JSONB, а по един ред на настройка.
//
// Ползване:
//   const settings = await getSettings()
//   settings['cart_produkt_enabled'] // 'true' | 'false' | undefined

import { supabaseAdmin } from '@/lib/supabase'

// ── Кратък in-memory кеш — settings се четат на всеки page load, а се
//    сменят рядко (само от админ панела). 30 сек TTL пази от излишни
//    заявки при бърз последователен трафик, без да бави реални промени. ──
let _cache:     Record<string, string> | null = null
let _cacheTime = 0
const CACHE_TTL = 30_000 // 30 секунди

export async function getSettings(): Promise<Record<string, string>> {
  const now = Date.now()
  if (_cache && now - _cacheTime < CACHE_TTL) return _cache

  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('key, value')

    if (error) throw error

    const result: Record<string, string> = {}
    for (const row of data || []) {
      if (row.key) result[row.key] = row.value ?? ''
    }

    _cache     = result
    _cacheTime = now
    return result
  } catch (err) {
    console.error('[lib/settings] getSettings:', err)
    // ✅ При грешка връщаме празен обект вместо да гърмим страницата —
    //    извикващият код (getHeaderCartConfig и т.н.) вече има разумни
    //    defaults за липсващи ключове.
    return _cache || {}
  }
}

// ── Единичен ключ — за места, които не се нуждаят от целия обект
//    (напр. ако искаш да замениш ръчната заявка в currency.ts по-късно). ──
export async function getSetting(key: string): Promise<string | null> {
  const all = await getSettings()
  return all[key] ?? null
}
