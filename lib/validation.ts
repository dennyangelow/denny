// lib/validation.ts — v1
// Споделена валидация за LeadForm + NaruchnikClient + API route
// Използва се на ТРИ места: frontend (две форми) + backend (route.ts)

// ── Disposable / фалшиви домейни ──────────────────────────────────────────────
// Списък с най-често срещаните временни/фалшиви имейл домейни
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwam.com',
  'sharklasers.com', 'guerrillamailblock.com', 'grr.la', 'guerrillamail.info',
  'spam4.me', 'trashmail.com', 'trashmail.me', 'trashmail.net', 'dispostable.com',
  'yopmail.com', 'yopmail.fr', 'cool.fr.nf', 'jetable.fr.nf', 'nospam.ze.tc',
  'nomail.xl.cx', 'mega.zik.dj', 'speed.1s.fr', 'courriel.fr.nf',
  'moncourrier.fr.nf', 'monemail.fr.nf', 'monmail.fr.nf',
  'mailnull.com', 'spamgourmet.com', 'spamgourmet.net', 'spamgourmet.org',
  'maildrop.cc', 'discard.email', 'spamfree24.org', 'spamfree24.de',
  'fakeinbox.com', 'throwam.com', 'throwaway.email', 'tempinbox.com',
  'tempr.email', 'dispostable.com', 'mailnew.com', 'getonemail.com',
  'spambox.us', 'spamevader.com', 'filzmail.com', 'mail-temporaire.fr',
  'jetable.org', 'jetable.net', 'jetable.com', 'nada.email', 'spamgrap.net',
  'bugmenot.com', 'crapmail.org', 'fakemailgenerator.com', 'mtmdev.com',
  'e4ward.com', 'mailexpire.com', 'safe-mail.net', 'incognitomail.net',
  'incognitomail.org', 'anonymbox.com', 'antispam.de', 'wegwerfmail.de',
  'wegwerfmail.net', 'wegwerfmail.org', 'einrot.com', 'trashmail.at',
  'trashmail.io', 'trashmail.xyz', '10minutemail.com', '10minutemail.net',
  '10minutemail.org', 'tempmail.net', 'tempmail.org', 'temp-mail.org',
  'temp-mail.ru', 'tempemail.net', 'tmpmail.net', 'tmpmail.org',
  'mailtemp.info', 'mailtemp.net', 'mail-temp.com', 'spamtemp.com',
  'anonbox.net', 'anonymail.dk', 'disign-concept.eu', 'disign-revelation.com',
  'mt2014.com', 'mt2015.com', 'nwytg.com', 'spamoff.de',
])

// ── Очевидно фалшиви patterns ─────────────────────────────────────────────────
// Имейли като test@, aaa@, 123@, asdf@ и т.н.
const FAKE_LOCAL_PATTERNS = [
  /^test\d*$/i,
  /^asdf/i,
  /^qwer/i,
  /^zxcv/i,
  /^abc\d*$/i,
  /^aaa+$/i,
  /^bbb+$/i,
  /^ccc+$/i,
  /^xxx+$/i,
  /^yyy+$/i,
  /^zzz+$/i,
  /^1234/,
  /^0000/,
  /^fake/i,
  /^noemail/i,
  /^nope/i,
  /^none/i,
  /^no@/i,
  /^spam/i,
  /^blah/i,
  /^trash/i,
  /^delete/i,
  /^remove/i,
  /^invalid/i,
  /^user\d*$/i,
  /^email\d*$/i,
  /^mail\d*$/i,
  /^(.)\1{4,}$/,  // aaaaaa@ — повтаряща се буква 4+ пъти
]

// ── Валидация на имейл ────────────────────────────────────────────────────────
export function validateEmail(value: string): string {
  const v = value.trim().toLowerCase()
  if (!v) return 'Имейлът е задължителен'

  // Основен формат
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Невалиден имейл адрес'

  // Двойно @
  if ((v.match(/@/g) || []).length > 1) return 'Невалиден имейл адрес'

  // Домейн трябва да има поне 1 точка след @
  const parts = v.split('@')
  const local  = parts[0]
  const domain = parts[1]

  if (!domain || !domain.includes('.')) return 'Невалиден домейн'

  // TLD минимум 2 символа
  const tld = domain.split('.').pop() || ''
  if (tld.length < 2) return 'Невалиден имейл адрес'

  // Disposable домейни
  if (DISPOSABLE_DOMAINS.has(domain)) return 'Моля, използвай реален имейл адрес'

  // Очевидно фалшиви local части
  for (const pattern of FAKE_LOCAL_PATTERNS) {
    if (pattern.test(local)) return 'Моля, въведи реален имейл адрес'
  }

  // Прекалено кратък local (1 символ)
  if (local.length < 2) return 'Невалиден имейл адрес'

  return ''
}

// ── Валидация на телефон (BG фокус) ──────────────────────────────────────────
export function validatePhone(value: string): string {
  const v = value.trim()
  if (!v) return 'Телефонът е задължителен'

  // Само цифри, +, интервали, тирета, скоби
  if (!/^[0-9+\s\-().]+$/.test(v)) return 'Телефонът съдържа невалидни символи'

  const digits = v.replace(/\D/g, '')

  if (digits.length < 9)  return 'Телефонът е твърде кратък (мин. 9 цифри)'
  if (digits.length > 15) return 'Телефонът е твърде дълъг'

  // Очевидно фалшиви: 000000000, 111111111, 123456789, 987654321
  if (/^(\d)\1{7,}$/.test(digits)) return 'Въведи реален телефонен номер'
  if (digits === '123456789' || digits === '987654321' || digits === '0123456789') {
    return 'Въведи реален телефонен номер'
  }

  // BG мобилен: 08X или +3598X или 003598X
  const isBG = (
    /^08[7-9]\d{7}$/.test(digits) ||           // 087/088/089 XXXXXXX
    /^3598[7-9]\d{7}$/.test(digits) ||          // +359 87/88/89...
    /^003598[7-9]\d{7}$/.test(digits)           // 00359...
  )

  // Ако изглежда като BG номер (започва с 08 или 359) но е грешен формат
  if (/^08/.test(digits) && !isBG) return 'Невалиден български мобилен номер (напр. 0887 123 456)'
  if (/^359/.test(digits) && digits.length < 12) return 'Невалиден номер с код +359'

  return ''
}

// ── Валидация на имена ────────────────────────────────────────────────────────
export function validateName(value: string): string {
  const v = value.trim()
  if (!v) return 'Името е задължително'
  if (v.length < 2) return 'Въведи поне 2 символа'
  if (v.length > 100) return 'Името е прекалено дълго'

  // Само цифри
  if (/^\d+$/.test(v)) return 'Въведи реално име'

  // Само специални символи / емоджи
  if (!/[a-zA-Zа-яА-ЯёЁ]/.test(v)) return 'Въведи реално име (само букви)'

  // Повтарящ се символ 4+ пъти (aaaa, хххх)
  if (/(.)\1{3,}/.test(v)) return 'Въведи реално ime'

  // Само съгласни (безсмислени низове: dfgjk, xzxzxz)
  const noVowels = v.replace(/[^a-zA-Zа-яА-Я]/g, '')
  const vowels   = noVowels.replace(/[^aeiouаеиоуяюAEIOUАЕИОУЯЮ]/gi, '')
  if (noVowels.length > 5 && vowels.length === 0) return 'Въведи реално ime'

  return ''
}

// ── Сървърна валидация (за API route) ────────────────────────────────────────
// Връща { ok: true } или { ok: false, field: string, error: string }
export function serverValidate(data: {
  email?: string
  name?: string
  phone?: string
}): { ok: true } | { ok: false; field: string; error: string } {
  if (data.email) {
    const err = validateEmail(data.email)
    if (err) return { ok: false, field: 'email', error: err }
  }
  if (data.name) {
    const err = validateName(data.name)
    if (err) return { ok: false, field: 'name', error: err }
  }
  if (data.phone) {
    const err = validatePhone(data.phone)
    if (err) return { ok: false, field: 'phone', error: err }
  }
  return { ok: true }
}
