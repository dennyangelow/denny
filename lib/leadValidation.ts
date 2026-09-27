// lib/leadValidation.ts — v1
// ✅ НОВ файл. Клиентските валидатори (name/email/phone) живееха самостоятелно,
//    копирани в components/client/HandbooksPanel.tsx — при добавянето на
//    components/blog/BlogHandbookEmbed.tsx (вграждане на наръчник директно
//    в статия) щяха да се копират ЗА ТРЕТИ път. Изнесени тук веднъж,
//    внасяни навсякъде — server-side валидацията в app/api/leads/route.ts
//    (serverValidate от lib/validation.ts) си остава отделна и е
//    единственият реален guard; тези тук са само за мигновен UX feedback.

export function validateName(v: string): string {
  if (!v.trim()) return 'Името е задължително'
  if (v.trim().length < 2) return 'Въведи поне 2 символа'
  return ''
}

export function validateEmail(v: string): string {
  const val = v.trim().toLowerCase()
  if (!val) return 'Имейлът е задължителен'
  // Блокира кирилица и unicode при въвеждане
  for (let i = 0; i < val.length; i++) { if (val.charCodeAt(i) > 127) return 'Само латиница — без кирилица' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) return 'Невалиден имейл адрес'
  return ''
}

export function validatePhone(v: string): string {
  if (!v.trim()) return 'Телефонът е задължителен'
  if (v.replace(/\D/g, '').length < 9) return 'Въведи валиден телефон'
  return ''
}
