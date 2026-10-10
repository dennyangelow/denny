// lib/email-settings.ts — v1 (НОВ файл)
//
// Защо: в SettingsTab.tsx вече съществуват полетата "Email от (Имена)",
// "Email от (Имейл)" и "Reply-To" (секция ✉️ Email настройки) — но НИКЪДЕ
// в кода не се четат. lib/mailer.ts праща винаги от хардкоднатото
// 'Denny Angelow <support@dennyangelow.com>', а footer текстът
// ("Получаваш този имейл, защото се регистрира на dennyangelow.com") и
// малкият taglinе под логото в писмата ("Denny Angelow — Агро Консултант")
// са вкопани статично в lib/email-templates.ts. Администраторът пипа
// полетата в Настройки и нищо не се променя в реално изпратените писма.
//
// Този файл е единствената точка, от която lib/mailer.ts и
// lib/email-templates.ts четат тези стойности — от `settings` таблицата,
// със същия 1-минутен кеш модел като lib/currency.ts (getCurrencySymbol),
// за да не правим DB round-trip при всеки имейл.

import { supabaseAdmin } from '@/lib/supabase'

export interface EmailSettings {
  fromName:      string  // 'Email от (Имена)'
  fromAddr:      string  // 'Email от (Имейл)'
  replyTo:       string  // 'Reply-To'
  footerText:    string  // текстът НАД "Отпиши се тук" линка в писмата
  senderTagline: string  // малкия сив ред под логото в header-а на писмата
}

const DEFAULTS: EmailSettings = {
  fromName:      'Denny Angelow',
  fromAddr:      'support@dennyangelow.com',
  replyTo:       'support@dennyangelow.com',
  footerText:    'Получаваш този имейл, защото се регистрира на dennyangelow.com.',
  senderTagline: 'Denny Angelow — Агро Консултант',
}

const KEYS = ['email_from_name', 'email_from_addr', 'email_reply_to', 'email_footer_text', 'email_sender_tagline'] as const

let _cache: EmailSettings | null = null
let _cacheTime = 0
const CACHE_TTL = 60_000 // 1 минута — същият модел като lib/currency.ts

export async function getEmailSettings(): Promise<EmailSettings> {
  const now = Date.now()
  if (_cache && now - _cacheTime < CACHE_TTL) return _cache

  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('key, value')
      .in('key', KEYS)

    const map = new Map((data || []).map(r => [r.key, r.value]))

    const result: EmailSettings = {
      fromName:      map.get('email_from_name')      || DEFAULTS.fromName,
      fromAddr:      map.get('email_from_addr')      || DEFAULTS.fromAddr,
      replyTo:       map.get('email_reply_to')        || DEFAULTS.replyTo,
      footerText:    map.get('email_footer_text')     || DEFAULTS.footerText,
      senderTagline: map.get('email_sender_tagline')  || DEFAULTS.senderTagline,
    }

    _cache = result
    _cacheTime = now
    return result
  } catch (err) {
    console.error('[email-settings] четенето от settings гръмна, пада се на defaults:', err)
    return DEFAULTS
  }
}

/** Готов "Име <имейл>" низ за SES Source полето, от текущите настройки. */
export async function buildFromHeader(): Promise<string> {
  const s = await getEmailSettings()
  return `${s.fromName} <${s.fromAddr}>`
}
