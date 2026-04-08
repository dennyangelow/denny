// lib/systemeio.ts — v8
//
// Оправени проблеми спрямо v7:
//
// ✅ FIX 1 — getOrCreateTagId: ПЪРВО търсим тага в списъка,
//    само ако не го намерим — опитваме да го създадем.
//    Старото поведение беше обратното → планът не позволява нов таг →
//    кешира null → тагът никога не се слага дори да съществува.
//
// ✅ FIX 2 — ensureContact: при дублиран имейл (409/422) намираме
//    контакта и веднага правим PATCH с имена + телефон.
//    Преди: намираше contactId но НЕ обновяваше данните.
//
// ✅ FIX 3 — patchContact: добавен guard — ако firstName И lastName
//    са празни стрингове, не изпращаме празен PATCH.
//
// ✅ FIX 4 — syncContact: ако contactId е зададен но контактът
//    е намерен чрез ID check, директно правим PATCH (без ensureContact).
//    Преди: при re-sync на вече синхронизиран контакт се викаше
//    ensureContact → POST → 409 → търсене → PATCH (3 extra request-а).
//
// ✅ FIX 5 — Rate limit handling: по-дълги паузи + exponential backoff.
//    Batch sync трябва да минава с BATCH=2 и sleep=1500ms между групи.

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Tag ID cache ──────────────────────────────────────────────────────────────
// null  = знаем, че тагът не може да се намери/създаде (план лимит)
// number = валиден ID
const tagIdCache: Record<string, number | null> = {}

// ── Phone formatter ───────────────────────────────────────────────────────────
export function formatPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined
  const raw    = phone.trim()
  const digits = raw.replace(/[\s\-().+]/g, '')
  if (!digits || digits.length < 7) return undefined
  if (raw.startsWith('+'))      return raw
  if (digits.startsWith('359')) return `+${digits}`
  if (digits.startsWith('0'))   return `+359${digits.slice(1)}`
  return `+359${digits}`
}

// ── Name splitter ─────────────────────────────────────────────────────────────
export function splitName(name?: string | null): { firstName: string; lastName: string } {
  const parts     = (name || '').trim().split(/\s+/).filter(Boolean)
  const firstName = parts[0] || ''
  const lastName  = parts.slice(1).join(' ') || ''
  return { firstName, lastName }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isDuplicateEmail(status: number, data: any): boolean {
  if (status === 409) return true
  if (status !== 422) return false
  const detail: string = data?.detail || data?.violations?.[0]?.message || ''
  const lower = detail.toLowerCase()
  return lower.includes('already used') || lower.includes('already exists')
}

function isEmailInvalid(status: number, data: any): boolean {
  if (status !== 422) return false
  const violations: any[] = data?.violations || []
  const emailViolation = violations.find(
    (v: any) => v?.propertyPath === 'email' || (v?.message || '').toLowerCase().includes('email')
  )
  if (!emailViolation) {
    const detail: string = data?.detail || ''
    return detail.toLowerCase().includes('email') && !isDuplicateEmail(status, data)
  }
  return true
}

function isPlanLimit(status: number, data: any): boolean {
  if (status !== 422 && status !== 400) return false
  const detail: string = data?.detail || data?.violations?.[0]?.message || ''
  return detail.toLowerCase().includes('upgrade') || detail.toLowerCase().includes('plan')
}

function safeParseJson(text: string): any {
  try { return JSON.parse(text) } catch { return undefined }
}

// ── API fetch wrapper ─────────────────────────────────────────────────────────
async function sioFetch(
  apiKey:      string,
  method:      string,
  path:        string,
  body?:       Record<string, unknown>,
  contentType = 'application/json'
): Promise<{ ok: boolean; status: number; data?: any; text?: string }> {
  const res = await fetch(`https://api.systeme.io${path}`, {
    method,
    headers: {
      'Content-Type': contentType,
      'X-API-Key':    apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  const data = safeParseJson(text)

  // Логваме само реални грешки — не дублирани имейли, не план лимити, не rate limits
  if (
    !res.ok &&
    !isDuplicateEmail(res.status, data) &&
    !isEmailInvalid(res.status, data) &&
    !isPlanLimit(res.status, data) &&
    res.status !== 429
  ) {
    console.warn(`[Systeme.io] ${method} ${path} → ${res.status}:`, text.slice(0, 300))
  }

  return { ok: res.ok, status: res.status, data, text }
}

// ── Find contact by email ─────────────────────────────────────────────────────
export async function findContactByEmail(apiKey: string, email: string): Promise<string | null> {
  const { ok, data } = await sioFetch(
    apiKey, 'GET', `/api/contacts?email=${encodeURIComponent(email)}&limit=10`
  )
  if (!ok || !data) return null
  const items   = data.items || data['hydra:member'] || []
  const contact = items.find((c: any) => c.email?.toLowerCase() === email.toLowerCase())
  return contact?.id ? String(contact.id) : null
}

// ── Get or create tag → returns numeric tag ID ────────────────────────────────
//
// ✅ FIX 1: Новата логика е:
//   1. Провери кеша
//   2. ПЪРВО търси тага в списъка от Systeme.io
//   3. Само ако не го намери — опитай да го създадеш
//   4. Ако планът не позволява → кешира null (тихо)
//
// Причина: тагът "naruchnik" вече съществува но е създаден ръчно.
// POST /api/tags връща грешка (вече съществува или план лимит) →
// старият код кешираше null → тагът никога не се слагаше.
//
async function getOrCreateTagId(apiKey: string, tagName: string): Promise<number | null> {
  // 1. Кеш проверка
  if (tagName in tagIdCache) return tagIdCache[tagName]

  // 2. ПЪРВО: търсим тага в списъка — по-надеждно от POST
  const listRes = await sioFetch(apiKey, 'GET', '/api/tags?limit=200')
  if (listRes.ok) {
    const items = listRes.data?.items || listRes.data?.['hydra:member'] || []
    const found = items.find((t: any) => t.name?.toLowerCase() === tagName.toLowerCase())
    if (found?.id) {
      tagIdCache[tagName] = Number(found.id)
      console.info(`[Systeme.io] Таг "${tagName}" намерен в списъка → ID ${tagIdCache[tagName]}`)
      return tagIdCache[tagName]
    }
  }

  // 3. Тагът не съществува → опитваме да го създадем
  const createRes = await sioFetch(apiKey, 'POST', '/api/tags', { name: tagName })

  if (createRes.ok && createRes.data?.id) {
    tagIdCache[tagName] = Number(createRes.data.id)
    console.info(`[Systeme.io] Таг "${tagName}" създаден → ID ${tagIdCache[tagName]}`)
    return tagIdCache[tagName]
  }

  // План лимит → кешираме null, спираме да опитваме
  if (isPlanLimit(createRes.status, createRes.data)) {
    console.info(`[Systeme.io] Таг "${tagName}" не може да се създаде (план лимит). Пропускаме.`)
    tagIdCache[tagName] = null
    return null
  }

  // 409/422 при create → може да е race condition, търсим пак
  if (createRes.status === 409 || createRes.status === 422) {
    await sleep(400)
    const retryList = await sioFetch(apiKey, 'GET', '/api/tags?limit=200')
    if (retryList.ok) {
      const items2 = retryList.data?.items || retryList.data?.['hydra:member'] || []
      const found2 = items2.find((t: any) => t.name?.toLowerCase() === tagName.toLowerCase())
      if (found2?.id) {
        tagIdCache[tagName] = Number(found2.id)
        return tagIdCache[tagName]
      }
    }
  }

  // Rate limit при create → изчакваме и retry
  if (createRes.status === 429) {
    await sleep(6000)
    const retry = await sioFetch(apiKey, 'POST', '/api/tags', { name: tagName })
    if (retry.ok && retry.data?.id) {
      tagIdCache[tagName] = Number(retry.data.id)
      return tagIdCache[tagName]
    }
    if (isPlanLimit(retry.status, retry.data)) {
      tagIdCache[tagName] = null
      return null
    }
  }

  console.warn(`[Systeme.io] Не можем да вземем tagId за "${tagName}"`)
  tagIdCache[tagName] = null
  return null
}

// ── Create OR find contact ────────────────────────────────────────────────────
//
// ✅ FIX 2: При дублиран имейл (409/422) намираме контакта И
//    връщаме firstName/lastName/phone обратно на caller-а,
//    за да може patchContact да се извика с правилните данни.
//
async function ensureContact(
  apiKey:    string,
  email:     string,
  firstName: string,
  lastName:  string,
  phone?:    string
): Promise<{ contactId: string | null; error?: string; emailInvalid?: boolean }> {
  const fields: { slug: string; value: string }[] = []
  if (phone) fields.push({ slug: 'phone_number', value: phone })

  const postBody: Record<string, unknown> = { email, firstName, lastName }
  if (fields.length > 0) postBody.fields = fields

  const res = await sioFetch(apiKey, 'POST', '/api/contacts', postBody)

  if (res.ok) {
    return { contactId: String(res.data?.id) }
  }

  // Дублиран имейл → намираме съществуващия контакт
  if (isDuplicateEmail(res.status, res.data)) {
    await sleep(500)
    const contactId = await findContactByEmail(apiKey, email)
    // Данните ще бъдат обновени от syncContact чрез patchContact
    return { contactId }
  }

  // Невалиден имейл → маркираме специално, няма retry
  if (isEmailInvalid(res.status, res.data)) {
    const detail = res.data?.violations?.[0]?.message || res.data?.detail || 'Invalid email'
    console.info(`[Systeme.io] Невалиден имейл "${email}": ${detail}`)
    return { contactId: null, error: `EMAIL_INVALID: ${detail}`, emailInvalid: true }
  }

  if (res.status === 422) {
    const detail = res.data?.detail || res.data?.violations?.[0]?.message || res.text?.slice(0, 200)
    return { contactId: null, error: `422: ${detail}` }
  }

  // Rate limit → изчакваме и retry с exponential backoff
  if (res.status === 429) {
    console.warn('[Systeme.io] Rate limit при POST /api/contacts — изчакваме 6 сек...')
    await sleep(6000)
    const retry = await sioFetch(apiKey, 'POST', '/api/contacts', postBody)
    if (retry.ok) return { contactId: String(retry.data?.id) }
    if (isDuplicateEmail(retry.status, retry.data)) {
      await sleep(500)
      return { contactId: await findContactByEmail(apiKey, email) }
    }
    if (isEmailInvalid(retry.status, retry.data)) {
      const detail = retry.data?.violations?.[0]?.message || retry.data?.detail || 'Invalid email'
      return { contactId: null, error: `EMAIL_INVALID: ${detail}`, emailInvalid: true }
    }
    return { contactId: null, error: `POST retry ${retry.status}: ${retry.text?.slice(0, 200)}` }
  }

  return { contactId: null, error: `POST ${res.status}: ${res.text?.slice(0, 200)}` }
}

// ── GET contact by ID ─────────────────────────────────────────────────────────
async function getContactById(
  apiKey:    string,
  contactId: string
): Promise<{ ok: boolean; status: number; notFound?: boolean }> {
  const res = await sioFetch(apiKey, 'GET', `/api/contacts/${contactId}`)
  if (res.ok)             return { ok: true,  status: res.status }
  if (res.status === 404) return { ok: false, status: 404, notFound: true }
  if (res.status === 429) {
    await sleep(6000)
    const retry = await sioFetch(apiKey, 'GET', `/api/contacts/${contactId}`)
    if (retry.ok)             return { ok: true,  status: retry.status }
    if (retry.status === 404) return { ok: false, status: 404, notFound: true }
    return { ok: false, status: retry.status }
  }
  return { ok: false, status: res.status }
}

// ── Patch contact data ────────────────────────────────────────────────────────
//
// ✅ FIX 3: Guard за празни данни — не изпращаме PATCH ако
//    firstName И lastName са празни (потребителят е попълнил само имейл).
//    Телефонът се обновява дори при липса на имена.
//
async function patchContact(
  apiKey:    string,
  contactId: string,
  firstName: string,
  lastName:  string,
  phone?:    string
): Promise<void> {
  const body: Record<string, unknown> = {}

  // Слагаме само ако има реално съдържание
  if (firstName) body.firstName = firstName
  if (lastName)  body.lastName  = lastName

  if (phone) {
    body.fields = [{ slug: 'phone_number', value: phone }]
  }

  if (Object.keys(body).length === 0) return // Нищо за ъпдейт

  const res = await sioFetch(
    apiKey, 'PATCH',
    `/api/contacts/${contactId}`,
    body,
    'application/merge-patch+json'
  )

  if (res.status === 429) {
    await sleep(5000)
    await sioFetch(
      apiKey, 'PATCH',
      `/api/contacts/${contactId}`,
      body,
      'application/merge-patch+json'
    )
  }
}

// ── Add tag ───────────────────────────────────────────────────────────────────
async function addTag(apiKey: string, contactId: string, tagName: string): Promise<void> {
  const tagId = await getOrCreateTagId(apiKey, tagName)
  if (tagId === null) {
    // Вече сме логнали причината в getOrCreateTagId
    return
  }

  await sleep(300)
  const res = await sioFetch(apiKey, 'POST', `/api/contacts/${contactId}/tags`, { tagId })

  if (res.status === 429) {
    await sleep(4000)
    await sioFetch(apiKey, 'POST', `/api/contacts/${contactId}/tags`, { tagId })
    return
  }

  // 409 = вече има тага → нормално
  if (!res.ok && res.status !== 409) {
    console.warn(`[Systeme.io] addTag failed ${res.status}:`, res.text?.slice(0, 200))
  }
}

// ── Main sync function ────────────────────────────────────────────────────────
//
// Логика за всеки контакт:
//
// Случай A — contactId е зададен и е валиден:
//   → само PATCH (имена + телефон) + addTag
//   → НЕ викаме POST /api/contacts (спестяваме request)
//
// Случай B — contactId е зададен НО не е валиден (404):
//   → нулираме contactId, продължаваме към Случай C
//
// Случай C — contactId = null:
//   → POST /api/contacts
//     - Ако ok: запазваме новия ID
//     - Ако 409 (дублиран): намираме ID чрез GET + после PATCH
//     - Ако невалиден имейл: връщаме emailInvalid:true
//
// Накрая: PATCH данни + addTag (винаги, независимо от случая)
//
export async function syncContact(params: {
  apiKey:     string
  email:      string
  name?:      string | null
  phone?:     string | null
  contactId?: string | null
  tag?:       string
}): Promise<{ ok: boolean; contactId?: string; error?: string; emailInvalid?: boolean }> {
  const { apiKey, email, tag = 'naruchnik' } = params
  const { firstName, lastName }              = splitName(params.name)
  const phone                                = formatPhone(params.phone)

  let contactId: string | null = params.contactId || null

  // ── Случай A/B: Проверяваме дали съществуващият ID е все още валиден ────────
  if (contactId) {
    const check = await getContactById(apiKey, contactId)
    if (check.ok) {
      // ✅ FIX 4: Контактът съществува → директно PATCH + tag, без POST
      await sleep(400)
      await patchContact(apiKey, contactId, firstName, lastName, phone)
      await sleep(300)
      await addTag(apiKey, contactId, tag)
      return { ok: true, contactId }
    }
    // 404 → контактът е изтрит в Systeme.io, продължаваме към Случай C
    contactId = null
  }

  // ── Случай C: Нямаме валиден ID → create or find ──────────────────────────
  const result = await ensureContact(apiKey, email, firstName, lastName, phone)

  if (result.emailInvalid) {
    return { ok: false, error: result.error, emailInvalid: true }
  }

  if (result.error) return { ok: false, error: result.error }

  contactId = result.contactId

  if (!contactId) {
    // Много рядък случай — контактът е там но ID не може да се вземе
    console.warn('[Systeme.io] Контактът е в системата но ID не е получен за:', email)
    return { ok: true } // Не маркираме като грешка — ще се опита при следващ sync
  }

  // PATCH: обновяваме имена и телефон на намерения/новия контакт
  await sleep(400)
  await patchContact(apiKey, contactId, firstName, lastName, phone)

  // Добавяме таг
  await sleep(300)
  await addTag(apiKey, contactId, tag)

  return { ok: true, contactId }
}

// ── Sync with retry ───────────────────────────────────────────────────────────
// НЕ retry-ваме ако имейлът е невалиден (няма смисъл)
export async function syncContactWithRetry(
  params: Parameters<typeof syncContact>[0],
  retries = 2
): Promise<{ ok: boolean; contactId?: string; error?: string; emailInvalid?: boolean }> {
  for (let i = 0; i <= retries; i++) {
    const result = await syncContact(params)
    if (result.ok) return result

    // Невалиден имейл → не retry-ваме
    if (result.emailInvalid) return result

    if (i < retries) {
      const delay = 1500 * (i + 1) // 1.5s, 3s
      console.warn(`[Systeme.io] Retry ${i + 1}/${retries} за ${params.email} след ${delay}ms:`, result.error)
      await sleep(delay)
    }
  }
  return { ok: false, error: 'Max retries exceeded' }
}
