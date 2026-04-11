// lib/validation.ts — v5
// ═══════════════════════════════════════════════════════════════
// ЖЕЛЕЗНА ВАЛИДАЦИЯ — споделена между frontend и backend
//
// Поправки v5:
//   1. validateEmail — отхвърля ВСИЧКО с non-ASCII символи (кирилица, emoji и др.)
//      чрез /^[\x00-\x7F]+$/ проверка преди всичко друго
//   2. validatePhone — отхвърля букви (кирилски И латински) с директен regex
//      Само цифри, +, интервали, тирета и скоби са позволени
//   3. serverValidate — разширена черна листа на disposable домейни
//   4. Всичко от v4 е запазено
// ═══════════════════════════════════════════════════════════════

// ── DISPOSABLE домейни ────────────────────────────────────────────────────────
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'yopmail.com', 'tempmail.com', 'guerrillamail.com',
  'throwaway.email', 'maildrop.cc', 'sharklasers.com', 'guerrillamailblock.com',
  'grr.la', 'guerrillamail.info', 'guerrillamail.biz', 'guerrillamail.de',
  'guerrillamail.net', 'guerrillamail.org', 'spam4.me', 'trashmail.com',
  'trashmail.me', 'trashmail.net', 'trashmail.at', 'trashmail.io',
  'dispostable.com', 'fakeinbox.com', 'mailnull.com', 'spamgourmet.com',
  'spamgourmet.net', 'spamgourmet.org', 'mailnesia.com', 'discard.email',
  'spamspot.com', 'spam.la', 'getnada.com', 'mohmal.com', 'mailfreeonline.com',
  'tempinbox.com', 'mailtemp.net', '10minutemail.com', '10minutemail.net',
  '10minutemail.org', 'minutemailbox.com', 'tempr.email', 'discard.email',
  'mailsac.com', 'armyspy.com', 'cuvox.de', 'dayrep.com', 'einrot.com',
  'fleckens.hu', 'gustr.com', 'jourrapide.com', 'rhyta.com', 'superrito.com',
  'teleworm.us', 'supermailer.jp',
])

// ── Очевидно фалшиви patterns ─────────────────────────────────────────────────
const FAKE_LOCAL_PATTERNS = [
  /^test[\d.]*$/i,
  /^aaa+$/i,
  /^bbb+$/i,
  /^ccc+$/i,
  /^\d+$/,            // само цифри
  /^(asdf|qwerty|zxcv)/i,
  /^(noreply|no-reply|donotreply)/i,
  /^(admin|root|postmaster|abuse|spam|null|undefined|example)/i,
  /^(.)\1{4,}$/,      // повтарящ се символ 5+ пъти (aaaa@, 11111@)
]

// ── validateName ──────────────────────────────────────────────────────────────
export function validateName(name: string): string {
  const v = name.trim()
  if (!v) return 'Моля, въведи твоето име'
  if (v.length < 2) return 'Името трябва да е поне 2 символа'
  if (v.length > 100) return 'Името е твърде дълго'
  // Позволяваме само букви (кирилски и латински), интервали, тирета и апострофи
  if (!/^[\p{L}\s'\-]+$/u.test(v)) return 'Името съдържа невалидни символи'
  return ''
}

// ── validateEmail ─────────────────────────────────────────────────────────────
export function validateEmail(email: string): string {
  const v = email.trim().toLowerCase()

  if (!v) return 'Моля, въведи имейл адрес'

  // ── СТЪПКА 1: Само ASCII символи ─────────────────────────────────────────
  // Кирилица, emoji, и всякакви Unicode символи са напълно забранени в имейл адрес.
  // RFC 5321 изисква само 7-bit ASCII. Тази проверка е ПЪРВА — преди всичко друго.
  if (!/^[\x00-\x7F]+$/.test(v)) {
    return 'Имейл адресът трябва да съдържа само латиница'
  }

  // ── СТЪПКА 2: Основен формат ──────────────────────────────────────────────
  if (!v.includes('@')) return 'Невалиден имейл адрес'
  if (v.length > 255) return 'Имейл адресът е твърде дълъг'

  const parts = v.split('@')
  if (parts.length !== 2) return 'Невалиден имейл адрес'

  const [local, domain] = parts

  // ── СТЪПКА 3: Local part (преди @) ────────────────────────────────────────
  if (!local || local.length < 1) return 'Невалиден имейл адрес'
  if (local.length > 64) return 'Невалиден имейл адрес'
  // Само безопасни ASCII символи в local part
  if (!/^[a-z0-9._%+\-]+$/.test(local)) return 'Невалиден имейл адрес'

  // ── СТЪПКА 4: Domain (след @) ─────────────────────────────────────────────
  if (!domain || domain.length < 4) return 'Невалиден домейн'
  // Само латиница, цифри, тирета и точки — НУЛА кирилица
  if (!/^[a-z0-9][a-z0-9\-.]*\.[a-z]{2,}$/.test(domain)) return 'Невалиден домейн'
  // Не позволяваме double dots
  if (domain.includes('..')) return 'Невалиден домейн'
  // TLD трябва да е поне 2 букви
  const tld = domain.split('.').pop() || ''
  if (tld.length < 2 || !/^[a-z]+$/.test(tld)) return 'Невалиден домейн'

  // ── СТЪПКА 5: Пълен regex ────────────────────────────────────────────────
  const emailRegex = /^[a-z0-9._%+\-]+@[a-z0-9][a-z0-9\-.]*\.[a-z]{2,}$/
  if (!emailRegex.test(v)) return 'Невалиден имейл адрес'

  return ''
}

// ── validatePhone ─────────────────────────────────────────────────────────────
export function validatePhone(phone: string): string {
  const v = phone.trim()

  if (!v) return 'Моля, въведи телефонен номер'

  // ── Блокира ВСЯКАКВИ букви — кирилски И латински ─────────────────────────
  // \p{L} = всяка Unicode буква (кирилица, латиница, гръцки и т.н.)
  if (/\p{L}/u.test(v)) {
    return 'Телефонът трябва да съдържа само цифри'
  }

  // ── Блокира символи извън позволените ─────────────────────────────────────
  // Позволени: цифри, +, интервал, тире, скоби, точка
  if (/[^0-9+\s\-().]/.test(v)) {
    return 'Телефонът съдържа невалидни символи'
  }

  // ── Извличаме само цифрите за дължина проверка ────────────────────────────
  const digitsOnly = v.replace(/[^0-9]/g, '')

  if (digitsOnly.length < 7) return 'Телефонът е твърде кратък (мин. 7 цифри)'
  if (digitsOnly.length > 15) return 'Телефонът е твърде дълъг (макс. 15 цифри)'

  return ''
}

// ── serverValidate ────────────────────────────────────────────────────────────
// Само за backend — по-строги проверки
export function serverValidate(params: {
  email: string
  name?: string | null
  phone?: string | null
}): { ok: boolean; error?: string; field?: 'email' | 'phone' | 'name' } {

  const email = params.email?.trim().toLowerCase() || ''
  const name  = params.name?.trim() || ''
  const phone = params.phone?.trim() || ''

  // ── Имейл: основна валидация ──────────────────────────────────────────────
  const emailErr = validateEmail(email)
  if (emailErr) return { ok: false, error: emailErr, field: 'email' }

  const [local, domain] = email.split('@')

  // ── Disposable домейни ────────────────────────────────────────────────────
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, error: 'Моля, използвай реален имейл адрес', field: 'email' }
  }

  // ── Очевидно фалшиви local parts ─────────────────────────────────────────
  for (const pattern of FAKE_LOCAL_PATTERNS) {
    if (pattern.test(local)) {
      return { ok: false, error: 'Моля, въведи реален имейл адрес', field: 'email' }
    }
  }

  // ── Телефон (ако е подаден) ───────────────────────────────────────────────
  if (phone) {
    const phoneErr = validatePhone(phone)
    if (phoneErr) return { ok: false, error: phoneErr, field: 'phone' }
  }

  // ── Ime (ако е подадено) ──────────────────────────────────────────────────
  if (name) {
    const nameErr = validateName(name)
    if (nameErr) return { ok: false, error: nameErr, field: 'name' }
  }

  return { ok: true }
}
