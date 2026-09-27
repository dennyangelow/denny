// lib/mx-check.ts — v1
// ✅ НОВ файл. hasValidMx() беше в lib/validation.ts, но lib/validation.ts
//    се импортва и от CLIENT компоненти (HandbooksPanel.tsx, NaruchnikClient.tsx,
//    BlogHandbookEmbed.tsx) за инстантния UX feedback на name/email/phone.
//    hasValidMx() тегли 'dns/promises' (чист Node модул) — webpack се
//    опитва да пакетира и него в клиентския бъндъл и build-ът гърми:
//    "Module not found: Can't resolve 'dns/promises'".
//
//    Изнесено тук — само app/api/leads/route.ts (server-side, Node
//    runtime) го импортва. lib/validation.ts никога не пипа dns/fs/crypto.
//
// ⚠️ Изисква Node runtime — провери, че app/api/leads/route.ts НЯМА
//    `export const runtime = 'edge'` (dns/promises не работи в Edge).

import { resolveMx } from 'dns/promises'

// ✅ Реална DNS проверка дали домейнът на имейла приема поща. Хваща случаи
//    като "asdas@aasdasd.bg" — синтактично валиден, никога регистриран
//    домейн, който validateEmail()/serverValidate() пропускат (проверяват
//    само ФОРМАТ).
//
//    Fail-OPEN на неясни грешки (timeout, DNS резолверът временно
//    недостъпен) — не блокираме реален потребител заради наш
//    инфраструктурен проблем. Fail-CLOSED само на еднозначни "домейнът не
//    съществува" кодове (ENOTFOUND/ENODATA).
export async function hasValidMx(email: string): Promise<boolean> {
  const domain = email.trim().toLowerCase().split('@')[1]
  if (!domain) return false

  try {
    const records = await Promise.race([
      resolveMx(domain),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('mx-lookup-timeout')), 3000)),
    ])
    return records.length > 0
  } catch (err: any) {
    if (err?.code === 'ENOTFOUND' || err?.code === 'ENODATA') return false
    console.error('[hasValidMx] DNS lookup issue, пропускам проверката:', err?.message || err)
    return true
  }
}
