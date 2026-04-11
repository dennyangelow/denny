// lib/validation.ts — v6
export function validateName(name: string): string {
  const v = name.trim()
  if (!v) return 'Моля, въведи твоето ime'
  if (v.length < 2) return 'Поне 2 символа'
  if (v.length > 100) return 'Прекалено дълго'
  if (!/^[\p{L}\s'\-]+$/u.test(v)) return 'Невалидни символи в името'
  return ''
}
export function validateEmail(email: string): string {
  const v = email.trim().toLowerCase()
  if (!v) return 'Въведи имейл адрес'
  if (!/^[\x00-\x7F]+$/.test(v)) return 'Само латиница — без кирилица'
  if (!v.includes('@')) return 'Невалиден имейл'
  const parts = v.split('@')
  if (parts.length !== 2) return 'Невалиден имейл'
  const [local, domain] = parts
  if (!local || local.length < 1) return 'Невалиден имейл'
  if (local.length > 64) return 'Невалиден имейл'
  if (!/^[a-z0-9._%+\-]+$/.test(local)) return 'Невалиден имейл'
  if (!domain || domain.length < 4) return 'Невалиден домейн'
  if (!/^[a-z0-9][a-z0-9\-.]*\.[a-z]{2,}$/.test(domain)) return 'Невалиден домейн'
  if (domain.includes('..')) return 'Невалиден домейн'
  const tld = domain.split('.').pop() || ''
  if (tld.length < 2 || !/^[a-z]+$/.test(tld)) return 'Невалиден домейн'
  return ''
}
export function validatePhone(phone: string): string {
  const v = phone.trim()
  if (!v) return 'Въведи телефон'
  if (/\p{L}/u.test(v)) return 'Само цифри — без букви'
  if (/[^0-9+\s\-().]/.test(v)) return 'Невалидни символи'
  const digits = v.replace(/[^0-9]/g, '')
  if (digits.length < 7) return 'Твърде кратък (мин. 7 цифри)'
  if (digits.length > 15) return 'Твърде дълъг (макс. 15 цифри)'
  return ''
}
export function serverValidate(params: { email: string; name?: string | null; phone?: string | null }): { ok: boolean; error?: string; field?: 'email' | 'phone' | 'name' } {
  const email = params.email?.trim().toLowerCase() || ''
  const name  = params.name?.trim() || ''
  const phone = params.phone?.trim() || ''
  const emailErr = validateEmail(email)
  if (emailErr) return { ok: false, error: emailErr, field: 'email' }
  const DISPOSABLE = new Set(['mailinator.com','yopmail.com','tempmail.com','guerrillamail.com','throwaway.email','maildrop.cc','trashmail.com','trashmail.me','trashmail.net','10minutemail.com','mailsac.com','spam4.me'])
  const domain = email.split('@')[1] || ''
  const local  = email.split('@')[0] || ''
  if (DISPOSABLE.has(domain)) return { ok: false, error: 'Използвай реален имейл', field: 'email' }
  const FAKE = [/^test[\d.]*$/i, /^aaa+$/i, /^\d+$/, /^(asdf|qwerty|zxcv)/i, /^(.)\1{4,}$/]
  for (const p of FAKE) { if (p.test(local)) return { ok: false, error: 'Въведи реален имейл', field: 'email' } }
  if (phone) { const pe = validatePhone(phone); if (pe) return { ok: false, error: pe, field: 'phone' } }
  if (name)  { const ne = validateName(name);   if (ne) return { ok: false, error: ne,  field: 'name'  } }
  return { ok: true }
}