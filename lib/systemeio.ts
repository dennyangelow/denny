// lib/systemeio.ts — v7 FIXED
//
// Промени спрямо v6:
//   - getOrCreateTagId: ако планът не позволява нови тагове (422 "upgrade plan"),
//     СПИРАМЕ да се опитваме — кешираме tagName → null и пропускаме тага безшумно
//     вместо да спамим API-то при всеки лийд.
//   - ensureContact: имейли отхвърлени от Systeme.io като невалидни (422 email violation)
//     се маркират с специален error код "EMAIL_INVALID" — caller-ът може да ги
//     запише в БД и да НЕ retry-ва повече.
//   - syncContact: ако error е "EMAIL_INVALID", връщаме ok:false + emailInvalid:true
//     за да може route.ts да запише systemeio_email_invalid=true в БД.
//   - isDuplicateEmail: по-стриктна проверка — само email violations, не всяко 422.
//   - Всички 422 с "upgrade" → тихо игнориране без console.warn spam.

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Tag ID cache ──────────────────────────────────────────────────────────────
// null = знаем, че тагът не може да се създаде (план лимит или не съществува)
const tagIdCache: Record<string, number | null> = {}

// ── Phone formatter ───────────────────────────────────────────────────────────
export function formatPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined
  const raw    = phone.trim()
  const digits = raw.replace(/[\s\-().+]/g, '')
  if (!digits || digits.length < 7) return undefined
  if (raw.startsWith('+'))          return raw
  if (digits.startsWith('359'))     return `+${digits}`
  if (digits.startsWith('0'))       return `+359${digits.slice(1)}`
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

/** Проверява дали 422/409 отговорът е "duplicate email" специфично */
function isDuplicateEmail(status: number, data: any): boolean {
  if (status === 409) return true
  if (status !== 422) return false
  const detail: string = data?.detail || data?.violations?.[0]?.message || ''
  const lower = detail.toLowerCase()
  return lower.includes('already used') || lower.includes('already exists')
}

/** Проверява дали 422 е заради невалиден имейл (домейн без MX, невалиден формат и т.н.) */
function isEmailInvalid(status: number, data: any): boolean {
  if (status !== 422) return false
  const violations: any[] = data?.violations || []
  // Проверяваме дали има violation за email поле
  const emailViolation = violations.find(
    (v: any) => v?.propertyPath === 'email' || (v?.message || '').toLowerCase().includes('email')
  )
  if (!emailViolation) {
    // Проверяваме и detail полето
    const detail: string = data?.detail || ''
    return detail.toLowerCase().includes('email') && !isDuplicateEmail(status, data)
  }
  return true
}

/** Проверява дали 422 е заради план лимит */
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
  apiKey: string,
  method: string,
  path: string,
  body?: Record<string, unknown>,
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
  const { ok, data } = await sioFetch(apiKey, 'GET', `/api/contacts?email=${encodeURIComponent(email)}&limit=10`)
  if (!ok || !data) return null
  const items   = data.items || data['hydra:member'] || []
  const contact = items.find((c: any) => c.email?.toLowerCase() === email.toLowerCase())
  return contact?.id ? String(contact.id) : null
}

// ── Get or create tag → returns numeric tag ID ────────────────────────────────
// Връща null ако:
//   - планът не позволява нови тагове
//   - тагът не може да се намери в списъка
// В такъв случай кешираме null и НЕ правим повторни опити.
async function getOrCreateTagId(apiKey: string, tagName: string): Promise<number | null> {
  // 1. Проверяваме кеша (включително null = знаем че не може)
  if (tagName in tagIdCache) return tagIdCache[tagName]

  // 2. Опитваме да създадем тага
  const createRes = await sioFetch(apiKey, 'POST', '/api/tags', { name: tagName })

  if (createRes.ok && createRes.data?.id) {
    tagIdCache[tagName] = Number(createRes.data.id)
    return tagIdCache[tagName]
  }

  // План лимит → кешираме null, спираме да опитваме
  if (isPlanLimit(createRes.status, createRes.data)) {
    console.info(`[Systeme.io] Таг "${tagName}" не може да се създаде (план лимит). Пропускаме безшумно.`)
    tagIdCache[tagName] = null
    return null
  }

  // Вече съществува → търсим в списъка
  if (createRes.status === 409 || createRes.status === 422 || createRes.status === 400) {
    await sleep(300)
    const listRes = await sioFetch(apiKey, 'GET', '/api/tags?limit=100')
    if (listRes.ok) {
      const items = listRes.data?.items || listRes.data?.['hydra:member'] || []
      const found = items.find((t: any) => t.name?.toLowerCase() === tagName.toLowerCase())
      if (found?.id) {
        tagIdCache[tagName] = Number(found.id)
        return tagIdCache[tagName]
      }
    }
    // Не можем да го намерим и не можем да го създадем → кешираме null
    console.info(`[Systeme.io] Таг "${tagName}" не е намерен и не може да се създаде.`)
    tagIdCache[tagName] = null
    return null
  }

  if (createRes.status === 429) {
    await sleep(5000)
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
async function ensureContact(
  apiKey: string,
  email: string,
  firstName: string,
  lastName: string,
  phone?: string
): Promise<{ contactId: string | null; error?: string; emailInvalid?: boolean }> {
  const fields: { slug: string; value: string }[] = []
  if (phone) fields.push({ slug: 'phone_number', value: phone })

  const postBody: Record<string, unknown> = { email, firstName, lastName }
  if (fields.length > 0) postBody.fields = fields

  const res = await sioFetch(apiKey, 'POST', '/api/contacts', postBody)

  if (res.ok) {
    return { contactId: String(res.data?.id) }
  }

  if (isDuplicateEmail(res.status, res.data)) {
    await sleep(500)
    const contactId = await findContactByEmail(apiKey, email)
    return { contactId }
  }

  // Невалиден имейл (домейн без MX, невалиден формат) → маркираме специално
  if (isEmailInvalid(res.status, res.data)) {
    const detail = res.data?.violations?.[0]?.message || res.data?.detail || 'Invalid email'
    console.info(`[Systeme.io] Невалиден имейл "${email}": ${detail}`)
    return { contactId: null, error: `EMAIL_INVALID: ${detail}`, emailInvalid: true }
  }

  if (res.status === 422) {
    const detail = res.data?.detail || res.data?.violations?.[0]?.message || res.text?.slice(0, 200)
    return { contactId: null, error: `422: ${detail}` }
  }

  if (res.status === 429) {
    console.warn('[Systeme.io] Rate limit при POST /api/contacts — изчакваме 5 сек...')
    await sleep(5000)
    const retry = await sioFetch(apiKey, 'POST', '/api/contacts', postBody)
    if (retry.ok)                                    return { contactId: String(retry.data?.id) }
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
  apiKey: string,
  contactId: string
): Promise<{ ok: boolean; status: number; notFound?: boolean }> {
  const res = await sioFetch(apiKey, 'GET', `/api/contacts/${contactId}`)
  if (res.ok)             return { ok: true,  status: res.status }
  if (res.status === 404) return { ok: false, status: 404, notFound: true }
  if (res.status === 429) {
    await sleep(5000)
    const retry = await sioFetch(apiKey, 'GET', `/api/contacts/${contactId}`)
    if (retry.ok)             return { ok: true,  status: retry.status }
    if (retry.status === 404) return { ok: false, status: 404, notFound: true }
    return { ok: false, status: retry.status }
  }
  return { ok: false, status: res.status }
}

// ── Patch contact data ────────────────────────────────────────────────────────
async function patchContact(
  apiKey: string,
  contactId: string,
  firstName: string,
  lastName: string,
  phone?: string
): Promise<void> {
  const fields: { slug: string; value: string | null }[] = []
  if (phone) fields.push({ slug: 'phone_number', value: phone })

  const body: Record<string, unknown> = {}
  if (firstName) body.firstName = firstName
  if (lastName)  body.lastName  = lastName
  if (fields.length > 0) body.fields = fields

  if (Object.keys(body).length === 0) return

  const res = await sioFetch(
    apiKey, 'PATCH',
    `/api/contacts/${contactId}`,
    body,
    'application/merge-patch+json'
  )

  if (res.status === 429) {
    await sleep(4000)
    await sioFetch(apiKey, 'PATCH', `/api/contacts/${contactId}`, body, 'application/merge-patch+json')
  }
}

// ── Add tag ───────────────────────────────────────────────────────────────────
async function addTag(apiKey: string, contactId: string, tagName: string): Promise<void> {
  const tagId = await getOrCreateTagId(apiKey, tagName)
  if (tagId === null) {
    // Тихо пропускаме — вече сме логнали причината в getOrCreateTagId
    return
  }

  await sleep(200)
  const res = await sioFetch(apiKey, 'POST', `/api/contacts/${contactId}/tags`, { tagId })

  if (res.status === 429) {
    await sleep(3000)
    await sioFetch(apiKey, 'POST', `/api/contacts/${contactId}/tags`, { tagId })
    return
  }

  // 409 = вече има тага → ок
  if (!res.ok && res.status !== 409) {
    console.warn(`[Systeme.io] addTag failed ${res.status}:`, res.text?.slice(0, 200))
  }
}

// ── Main sync function ────────────────────────────────────────────────────────
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

  // 1. Проверяваме дали съществуващият ID е валиден
  if (contactId) {
    const check = await getContactById(apiKey, contactId)
    if (!check.ok) {
      contactId = null // нулираме и продължаваме — ensureContact ще го намери/създаде
    }
  }

  // 2. Създаваме или намираме контакта
  if (!contactId) {
    const result = await ensureContact(apiKey, email, firstName, lastName, phone)

    // Невалиден имейл → веднага връщаме, без да продължаваме
    if (result.emailInvalid) {
      return { ok: false, error: result.error, emailInvalid: true }
    }

    if (result.error) return { ok: false, error: result.error }
    contactId = result.contactId
  }

  if (!contactId) {
    console.warn('[Systeme.io] Контактът е там но ID не е взет за:', email)
    return { ok: true }
  }

  // 3. PATCH данните
  await sleep(400)
  await patchContact(apiKey, contactId, firstName, lastName, phone)

  // 4. Добавяме таг (безшумно пропуска ако планът не позволява)
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
      console.warn(`[Systeme.io] Retry ${i + 1} for ${params.email}:`, result.error)
      await sleep(1000 * (i + 1))
    }
  }
  return { ok: false, error: 'Max retries exceeded' }
}
