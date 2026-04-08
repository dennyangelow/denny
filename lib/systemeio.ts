// lib/systemeio.ts — v10
//
// ═══════════════════════════════════════════════════════════════
//  ЗАЩО v9 НЕ РАБОТЕШЕ:
//
//  Стар поток за вече синхронизиран контакт (Случай A):
//    1. GET /api/contacts/{id}        ← проверка дали съществува
//    2. PATCH /api/contacts/{id}      ← обновяване на данни
//    3. GET /api/tags?limit=200       ← намиране на tag ID
//    4. POST /api/contacts/{id}/tags  ← слагане на таг
//    = 4 заявки × 329 контакта = 1316 заявки
//    При rate limit 60/мин → трябва 22 мин.
//    Vercel timeout = 30 сек → sync се прекъсва след ~25 контакта
//
//  НОВИЯТ поток (v10):
//    1. PATCH /api/contacts/{id}      ← директно, без предварителна проверка
//       - Ако 404: намираме/създаваме контакта
//    2. POST /api/contacts/{id}/tags  ← tag ID е в кеша (1 GET за всички)
//    = 2 заявки × контакт (+ 1 GET за тагове веднъж за целия batch)
//
//  ОПРАВЕНИ ПРОБЛЕМИ:
//  ✅ phoneNumber е top-level поле (НЕ custom field slug)
//  ✅ naruchnici custom field се попълва с slug на наръчника
//  ✅ Премахнат предварителен GET per-контакт
//  ✅ Tag ID се взема ВЕДНЪЖ за целия sync (не per-контакт)
//  ✅ При 404 на PATCH → намираме/създаваме → после PATCH пак
// ═══════════════════════════════════════════════════════════════

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Tag ID cache — зарежда се веднъж за целия процес ─────────────────────────
const tagIdCache: Record<string, number | null> = {}

// ── Phone formatter ───────────────────────────────────────────────────────────
export function formatPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined
  const raw    = phone.trim()
  const digits = raw.replace(/[\s\-().+]/g, '')
  if (!digits || digits.length < 7) return undefined
  if (raw.startsWith('+'))      return raw.replace(/\s/g, '')
  if (digits.startsWith('359')) return `+${digits}`
  if (digits.startsWith('0'))   return `+359${digits.slice(1)}`
  return `+359${digits}`
}

// ── Name splitter ─────────────────────────────────────────────────────────────
export function splitName(name?: string | null): { firstName: string; lastName: string } {
  const parts     = (name || '').trim().split(/\s+/).filter(Boolean)
  const firstName = parts[0]            || ''
  const lastName  = parts.slice(1).join(' ') || ''
  return { firstName, lastName }
}

// ── Response classifiers ──────────────────────────────────────────────────────
function isDuplicateEmail(status: number, data: any): boolean {
  if (status === 409) return true
  if (status !== 422) return false
  const d = (data?.detail || data?.violations?.[0]?.message || '').toLowerCase()
  return d.includes('already used') || d.includes('already exists')
}

function isEmailInvalid(status: number, data: any): boolean {
  if (status !== 422) return false
  const violations: any[] = data?.violations || []
  const hasEmailViolation = violations.some(
    (v: any) => v?.propertyPath === 'email' || (v?.message || '').toLowerCase().includes('email')
  )
  if (hasEmailViolation) return true
  const detail = (data?.detail || '').toLowerCase()
  return detail.includes('email') && !isDuplicateEmail(status, data)
}

function isPlanLimit(status: number, data: any): boolean {
  if (status !== 422 && status !== 400) return false
  const d = (data?.detail || data?.violations?.[0]?.message || '').toLowerCase()
  return d.includes('upgrade') || d.includes('plan')
}

function safeJson(text: string): any {
  try { return JSON.parse(text) } catch { return undefined }
}

// ── Core fetch ────────────────────────────────────────────────────────────────
async function sioFetch(
  apiKey:      string,
  method:      string,
  path:        string,
  body?:       Record<string, unknown>,
  contentType = 'application/json'
): Promise<{ ok: boolean; status: number; data?: any; text?: string }> {
  const res = await fetch(`https://api.systeme.io${path}`, {
    method,
    headers: { 'Content-Type': contentType, 'X-API-Key': apiKey },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = safeJson(text)

  if (
    !res.ok &&
    !isDuplicateEmail(res.status, data) &&
    !isEmailInvalid(res.status, data) &&
    !isPlanLimit(res.status, data) &&
    res.status !== 429
  ) {
    console.warn(`[Sio] ${method} ${path} → ${res.status}:`, text.slice(0, 300))
  }

  return { ok: res.ok, status: res.status, data, text }
}

// ── Find contact by email ─────────────────────────────────────────────────────
async function findContactByEmail(apiKey: string, email: string): Promise<string | null> {
  const { ok, data } = await sioFetch(
    apiKey, 'GET', `/api/contacts?email=${encodeURIComponent(email)}&limit=10`
  )
  if (!ok || !data) return null
  const items = data.items || data['hydra:member'] || []
  const found = items.find((c: any) => c.email?.toLowerCase() === email.toLowerCase())
  return found?.id ? String(found.id) : null
}

// ── Create contact ────────────────────────────────────────────────────────────
async function createContact(
  apiKey:         string,
  email:          string,
  firstName:      string,
  lastName:       string,
  phone?:         string,
  naruchnikSlug?: string
): Promise<{ contactId: string | null; error?: string; emailInvalid?: boolean }> {
  const body: Record<string, unknown> = { email, firstName, lastName }
  if (phone) body.phoneNumber = phone                                   // ✅ top-level поле
  body.fields = [{ slug: 'naruchnici', value: naruchnikSlug || 'naruchnici' }]  // ✅ custom field

  const res = await sioFetch(apiKey, 'POST', '/api/contacts', body)

  if (res.ok) return { contactId: String(res.data?.id) }

  if (isDuplicateEmail(res.status, res.data)) {
    await sleep(400)
    return { contactId: await findContactByEmail(apiKey, email) }
  }

  if (isEmailInvalid(res.status, res.data)) {
    const detail = res.data?.violations?.[0]?.message || res.data?.detail || 'Invalid email'
    console.info(`[Sio] Invalid email "${email}": ${detail}`)
    return { contactId: null, error: `EMAIL_INVALID: ${detail}`, emailInvalid: true }
  }

  if (res.status === 429) {
    await sleep(8000)
    const r2 = await sioFetch(apiKey, 'POST', '/api/contacts', body)
    if (r2.ok) return { contactId: String(r2.data?.id) }
    if (isDuplicateEmail(r2.status, r2.data)) {
      await sleep(400)
      return { contactId: await findContactByEmail(apiKey, email) }
    }
    if (isEmailInvalid(r2.status, r2.data)) {
      const detail = r2.data?.violations?.[0]?.message || r2.data?.detail || 'Invalid email'
      return { contactId: null, error: `EMAIL_INVALID: ${detail}`, emailInvalid: true }
    }
    return { contactId: null, error: `POST retry ${r2.status}: ${r2.text?.slice(0, 200)}` }
  }

  return { contactId: null, error: `POST ${res.status}: ${res.text?.slice(0, 200)}` }
}

// ── Patch contact ─────────────────────────────────────────────────────────────
// Връща: ok | notFound | rateLimited | error
async function patchContactDirect(
  apiKey:         string,
  contactId:      string,
  firstName:      string,
  lastName:       string,
  phone?:         string,
  naruchnikSlug?: string
): Promise<'ok' | 'notFound' | 'rateLimited' | 'error'> {
  const body: Record<string, unknown> = {}
  if (firstName)     body.firstName   = firstName
  if (lastName)      body.lastName    = lastName
  if (phone)         body.phoneNumber = phone                                   // ✅ top-level
  body.fields = [{ slug: 'naruchnici', value: naruchnikSlug || 'naruchnici' }]  // ✅ custom field

  const res = await sioFetch(
    apiKey, 'PATCH', `/api/contacts/${contactId}`,
    body, 'application/merge-patch+json'
  )

  if (res.ok)               return 'ok'
  if (res.status === 404)   return 'notFound'
  if (res.status === 429)   return 'rateLimited'
  return 'error'
}

// ── Get tag ID (кеширано — само 1 GET за целия batch) ─────────────────────────
async function getTagId(apiKey: string, tagName: string): Promise<number | null> {
  if (tagName in tagIdCache) return tagIdCache[tagName]

  // Взимаме всички тагове (1 заявка за целия sync процес)
  const res = await sioFetch(apiKey, 'GET', '/api/tags?limit=200')
  if (res.ok) {
    const items = res.data?.items || res.data?.['hydra:member'] || []
    for (const t of items) {
      // Кешираме всички тагове наведнъж
      if (t?.id && t?.name) tagIdCache[t.name.toLowerCase()] = Number(t.id)
    }
    if (tagName.toLowerCase() in tagIdCache) {
      console.info(`[Sio] Таг "${tagName}" → ID ${tagIdCache[tagName.toLowerCase()]}`)
      // Нормализираме ключа
      tagIdCache[tagName] = tagIdCache[tagName.toLowerCase()]
      return tagIdCache[tagName]
    }
  }

  // Тагът не съществува → опитваме да го създадем
  if (isPlanLimit(res.status, res.data)) {
    console.info(`[Sio] Таг "${tagName}" — план лимит`)
    tagIdCache[tagName] = null
    return null
  }

  const createRes = await sioFetch(apiKey, 'POST', '/api/tags', { name: tagName })
  if (createRes.ok && createRes.data?.id) {
    tagIdCache[tagName] = Number(createRes.data.id)
    console.info(`[Sio] Таг "${tagName}" създаден → ID ${tagIdCache[tagName]}`)
    return tagIdCache[tagName]
  }

  if (isPlanLimit(createRes.status, createRes.data)) {
    tagIdCache[tagName] = null
    return null
  }

  tagIdCache[tagName] = null
  return null
}

// ── Add tag (само ако все още не е добавен) ───────────────────────────────────
async function addTag(apiKey: string, contactId: string, tagName: string): Promise<void> {
  const tagId = await getTagId(apiKey, tagName)
  if (tagId === null) return

  const res = await sioFetch(apiKey, 'POST', `/api/contacts/${contactId}/tags`, { tagId })

  if (res.status === 429) {
    await sleep(5000)
    await sioFetch(apiKey, 'POST', `/api/contacts/${contactId}/tags`, { tagId })
    return
  }
  // 409 = вече има тага → нормално, не логваме
  if (!res.ok && res.status !== 409) {
    console.warn(`[Sio] addTag ${tagName} → ${res.status}`)
  }
}

// ── MAIN syncContact ──────────────────────────────────────────────────────────
//
//  НОВИ 2 ЗАЯВКИ НА КОНТАКТ (вместо 4):
//
//  Ако имаме contactId:
//    1. PATCH /api/contacts/{id}          ← директно, без GET предварително
//       - Ако 404: findByEmail или create → после PATCH пак
//       - Ако 429: изчакваме → retry
//    2. POST /api/contacts/{id}/tags      ← tagId е в кеша
//
//  Ако нямаме contactId:
//    1. POST /api/contacts                ← create (включва phone + naruchnici)
//       - Ако 409 (дублиран): findByEmail
//    2. POST /api/contacts/{id}/tags
//
export async function syncContact(params: {
  apiKey:         string
  email:          string
  name?:          string | null
  phone?:         string | null
  contactId?:     string | null
  tag?:           string
  naruchnikSlug?: string | null
}): Promise<{ ok: boolean; contactId?: string; error?: string; emailInvalid?: boolean }> {
  const { apiKey, email, tag = 'naruchnik' } = params
  const { firstName, lastName } = splitName(params.name)
  const phone = formatPhone(params.phone)
  const slug  = params.naruchnikSlug || 'naruchnici'

  let contactId: string | null = params.contactId || null

  // ── Имаме contactId → PATCH директно (без предварителен GET) ─────────────
  if (contactId) {
    const patchResult = await patchContactDirect(apiKey, contactId, firstName, lastName, phone, slug)

    if (patchResult === 'ok') {
      await sleep(200)
      await addTag(apiKey, contactId, tag)
      return { ok: true, contactId }
    }

    if (patchResult === 'rateLimited') {
      // Rate limit → изчакваме и retry
      await sleep(8000)
      const retry = await patchContactDirect(apiKey, contactId, firstName, lastName, phone, slug)
      if (retry === 'ok') {
        await sleep(200)
        await addTag(apiKey, contactId, tag)
        return { ok: true, contactId }
      }
      if (retry !== 'notFound') {
        return { ok: false, error: `PATCH rate limited for ${email}` }
      }
    }

    if (patchResult === 'notFound') {
      // Контактът е изтрит в Systeme.io → ще го намерим/създадем
      contactId = null
    }

    if (patchResult === 'error') {
      // Непознат error → опитваме findByEmail преди да се откажем
      const found = await findContactByEmail(apiKey, email)
      if (found) {
        contactId = found
        await sleep(200)
        await patchContactDirect(apiKey, contactId, firstName, lastName, phone, slug)
        await sleep(200)
        await addTag(apiKey, contactId, tag)
        return { ok: true, contactId }
      }
      return { ok: false, error: `PATCH error for ${email}` }
    }
  }

  // ── Нямаме contactId (или 404) → create or find ───────────────────────────
  const created = await createContact(apiKey, email, firstName, lastName, phone, slug)

  if (created.emailInvalid) return { ok: false, error: created.error, emailInvalid: true }
  if (created.error)        return { ok: false, error: created.error }

  contactId = created.contactId
  if (!contactId) {
    console.warn('[Sio] Не можем да вземем ID за:', email)
    return { ok: false, error: 'No contact ID' }
  }

  // При create: данните вече са включени в POST тялото,
  // но ако е намерен чрез findByEmail (дублиран) → правим PATCH
  if (params.contactId === null || params.contactId === undefined) {
    // Нов контакт → данните са в CREATE body, само таг
    await sleep(200)
    await addTag(apiKey, contactId, tag)
  } else {
    // Намерен след 404 → PATCH + таг
    await sleep(200)
    await patchContactDirect(apiKey, contactId, firstName, lastName, phone, slug)
    await sleep(200)
    await addTag(apiKey, contactId, tag)
  }

  return { ok: true, contactId }
}

// ── Sync with retry ───────────────────────────────────────────────────────────
export async function syncContactWithRetry(
  params:  Parameters<typeof syncContact>[0],
  retries = 2
): Promise<{ ok: boolean; contactId?: string; error?: string; emailInvalid?: boolean }> {
  for (let i = 0; i <= retries; i++) {
    const result = await syncContact(params)
    if (result.ok)           return result
    if (result.emailInvalid) return result
    if (i < retries) {
      const delay = 2000 * (i + 1)
      console.warn(`[Sio] Retry ${i + 1} за ${params.email} след ${delay}ms:`, result.error)
      await sleep(delay)
    }
  }
  return { ok: false, error: 'Max retries exceeded' }
}
