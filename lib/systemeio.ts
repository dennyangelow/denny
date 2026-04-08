// lib/systemeio.ts — v9
//
// ═══════════════════════════════════════════════════════════════
//  КАКВО Е ОПРАВЕНО (спрямо v8):
//
//  ✅ FIX 1 — phoneNumber е TOP-LEVEL поле в Systeme.io API,
//     НЕ custom field. Старият код пращаше:
//       fields: [{ slug: 'phone_number', value: '+359...' }]
//     → Systeme.io го игнорираше (slug не съществува).
//     Правилното: { phoneNumber: '+359...' } в тялото на заявката.
//
//  ✅ FIX 2 — naruchnici custom field трябва да се попълни.
//     В Systeme.io всеки контакт има custom field с slug 'naruchnici'.
//     Трябва да се праща: fields: [{ slug: 'naruchnici', value: '...' }]
//     Старият код изобщо не пращаше този field.
//
//  ✅ FIX 3 — syncContact приема naruchnikSlug параметър
//     за да знае каква стойност да запише в naruchnici field.
//     Подава се от route.ts при всеки sync.
//
//  ✅ FIX 4 — Tag логика: ПЪРВО търсим в списъка (тагът 'naruchnik'
//     вече съществува), само ако не го намерим — опитваме да го създадем.
// ═══════════════════════════════════════════════════════════════

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Tag ID cache ──────────────────────────────────────────────────────────────
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

// ── Core API fetch ────────────────────────────────────────────────────────────
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
  const data = safeParseJson(text)

  if (
    !res.ok &&
    !isDuplicateEmail(res.status, data) &&
    !isEmailInvalid(res.status, data) &&
    !isPlanLimit(res.status, data) &&
    res.status !== 429
  ) {
    console.warn(`[Systeme.io] ${method} ${path} → ${res.status}:`, text.slice(0, 400))
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

// ── Get or create tag ─────────────────────────────────────────────────────────
async function getOrCreateTagId(apiKey: string, tagName: string): Promise<number | null> {
  if (tagName in tagIdCache) return tagIdCache[tagName]

  // 1. Търсим в списъка — тагът вероятно вече съществува
  const listRes = await sioFetch(apiKey, 'GET', '/api/tags?limit=200')
  if (listRes.ok) {
    const items = listRes.data?.items || listRes.data?.['hydra:member'] || []
    const found = items.find((t: any) => t.name?.toLowerCase() === tagName.toLowerCase())
    if (found?.id) {
      tagIdCache[tagName] = Number(found.id)
      console.info(`[Systeme.io] Таг "${tagName}" намерен → ID ${tagIdCache[tagName]}`)
      return tagIdCache[tagName]
    }
  }

  // 2. Не съществува → създаваме
  const createRes = await sioFetch(apiKey, 'POST', '/api/tags', { name: tagName })
  if (createRes.ok && createRes.data?.id) {
    tagIdCache[tagName] = Number(createRes.data.id)
    console.info(`[Systeme.io] Таг "${tagName}" създаден → ID ${tagIdCache[tagName]}`)
    return tagIdCache[tagName]
  }

  if (isPlanLimit(createRes.status, createRes.data)) {
    console.info(`[Systeme.io] Таг "${tagName}" — план лимит. Пропускаме.`)
    tagIdCache[tagName] = null
    return null
  }

  if (createRes.status === 409 || createRes.status === 422) {
    await sleep(400)
    const retry = await sioFetch(apiKey, 'GET', '/api/tags?limit=200')
    if (retry.ok) {
      const items = retry.data?.items || retry.data?.['hydra:member'] || []
      const found = items.find((t: any) => t.name?.toLowerCase() === tagName.toLowerCase())
      if (found?.id) {
        tagIdCache[tagName] = Number(found.id)
        return tagIdCache[tagName]
      }
    }
  }

  if (createRes.status === 429) {
    await sleep(6000)
    const retry = await sioFetch(apiKey, 'POST', '/api/tags', { name: tagName })
    if (retry.ok && retry.data?.id) {
      tagIdCache[tagName] = Number(retry.data.id)
      return tagIdCache[tagName]
    }
  }

  console.warn(`[Systeme.io] Не можем да вземем tagId за "${tagName}"`)
  tagIdCache[tagName] = null
  return null
}

// ── Build create body ─────────────────────────────────────────────────────────
// ✅ FIX 1: phoneNumber е top-level поле
// ✅ FIX 2: naruchnici е custom field (slug = 'naruchnici')
function buildCreateBody(
  email:          string,
  firstName:      string,
  lastName:       string,
  phone?:         string,
  naruchnikSlug?: string
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    email,
    firstName,
    lastName,
  }

  // ✅ phoneNumber = официалното Systeme.io поле за телефон
  if (phone) body.phoneNumber = phone

  // ✅ naruchnici = custom field, задължително се попълва
  body.fields = [
    { slug: 'naruchnici', value: naruchnikSlug || 'naruchnici' },
  ]

  return body
}

// ── Build PATCH body ──────────────────────────────────────────────────────────
function buildPatchBody(
  firstName:      string,
  lastName:       string,
  phone?:         string,
  naruchnikSlug?: string
): Record<string, unknown> {
  const body: Record<string, unknown> = {}

  if (firstName) body.firstName   = firstName
  if (lastName)  body.lastName    = lastName
  if (phone)     body.phoneNumber = phone

  // Обновяваме naruchnici custom field
  body.fields = [
    { slug: 'naruchnici', value: naruchnikSlug || 'naruchnici' },
  ]

  return body
}

// ── Create or find contact ────────────────────────────────────────────────────
async function ensureContact(
  apiKey:         string,
  email:          string,
  firstName:      string,
  lastName:       string,
  phone?:         string,
  naruchnikSlug?: string
): Promise<{ contactId: string | null; error?: string; emailInvalid?: boolean }> {
  const postBody = buildCreateBody(email, firstName, lastName, phone, naruchnikSlug)

  const res = await sioFetch(apiKey, 'POST', '/api/contacts', postBody)

  if (res.ok) return { contactId: String(res.data?.id) }

  // Дублиран → намираме съществуващия
  if (isDuplicateEmail(res.status, res.data)) {
    await sleep(500)
    const contactId = await findContactByEmail(apiKey, email)
    return { contactId }
  }

  // Невалиден имейл → маркираме веднъж, без retry
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

// ── PATCH existing contact ────────────────────────────────────────────────────
async function patchContact(
  apiKey:         string,
  contactId:      string,
  firstName:      string,
  lastName:       string,
  phone?:         string,
  naruchnikSlug?: string
): Promise<void> {
  const body = buildPatchBody(firstName, lastName, phone, naruchnikSlug)
  if (Object.keys(body).length === 0) return

  const res = await sioFetch(
    apiKey, 'PATCH',
    `/api/contacts/${contactId}`,
    body,
    'application/merge-patch+json'
  )

  if (res.status === 429) {
    await sleep(5000)
    await sioFetch(apiKey, 'PATCH', `/api/contacts/${contactId}`, body, 'application/merge-patch+json')
  }

  if (!res.ok && res.status !== 429) {
    console.warn(`[Systeme.io] PATCH ${contactId} → ${res.status}:`, res.text?.slice(0, 200))
  }
}

// ── Add tag ───────────────────────────────────────────────────────────────────
async function addTag(apiKey: string, contactId: string, tagName: string): Promise<void> {
  const tagId = await getOrCreateTagId(apiKey, tagName)
  if (tagId === null) return

  await sleep(300)
  const res = await sioFetch(apiKey, 'POST', `/api/contacts/${contactId}/tags`, { tagId })

  if (res.status === 429) {
    await sleep(4000)
    await sioFetch(apiKey, 'POST', `/api/contacts/${contactId}/tags`, { tagId })
    return
  }

  if (!res.ok && res.status !== 409) {
    console.warn(`[Systeme.io] addTag "${tagName}" → ${res.status}:`, res.text?.slice(0, 200))
  }
}

// ── MAIN: syncContact ─────────────────────────────────────────────────────────
//
//  Случай A — contactId валиден → PATCH + addTag (без POST)
//  Случай B — contactId 404    → нулираме → Случай C
//  Случай C — без contactId    → POST (с phoneNumber + naruchnici field)
//                                → ако 409: findByEmail → PATCH
//                                → ако invalid email: emailInvalid:true
//
export async function syncContact(params: {
  apiKey:         string
  email:          string
  name?:          string | null
  phone?:         string | null
  contactId?:     string | null
  tag?:           string
  naruchnikSlug?: string | null   // slug на наръчника → записва се в custom field
}): Promise<{ ok: boolean; contactId?: string; error?: string; emailInvalid?: boolean }> {
  const { apiKey, email, tag = 'naruchnik' } = params
  const { firstName, lastName } = splitName(params.name)
  const phone = formatPhone(params.phone)
  const slug  = params.naruchnikSlug || undefined

  let contactId: string | null = params.contactId || null

  // ── Случай A/B ────────────────────────────────────────────────────────────
  if (contactId) {
    const check = await getContactById(apiKey, contactId)
    if (check.ok) {
      await sleep(300)
      await patchContact(apiKey, contactId, firstName, lastName, phone, slug)
      await sleep(300)
      await addTag(apiKey, contactId, tag)
      return { ok: true, contactId }
    }
    contactId = null // 404 → създаваме наново
  }

  // ── Случай C ──────────────────────────────────────────────────────────────
  const result = await ensureContact(apiKey, email, firstName, lastName, phone, slug)

  if (result.emailInvalid) return { ok: false, error: result.error, emailInvalid: true }
  if (result.error)        return { ok: false, error: result.error }

  contactId = result.contactId

  if (!contactId) {
    console.warn('[Systeme.io] ID не е получен за:', email)
    return { ok: true }
  }

  await sleep(300)
  await patchContact(apiKey, contactId, firstName, lastName, phone, slug)
  await sleep(300)
  await addTag(apiKey, contactId, tag)

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
      const delay = 1500 * (i + 1)
      console.warn(`[Systeme.io] Retry ${i + 1}/${retries} за ${params.email} след ${delay}ms:`, result.error)
      await sleep(delay)
    }
  }
  return { ok: false, error: 'Max retries exceeded' }
}
