// lib/systemeio.ts — v27
// ═══════════════════════════════════════════════════════════════
// КЛЮЧОВИ ОТКРИТИЯ (от официалната документация на Systeme.io):
//
//  POST /api/contacts (CREATE):
//    - email, firstName, lastName, phoneNumber → горно ниво ✅
//    - fields: [{slug:"naruchnici", value:...}] → custom fields ✅
//
//  PATCH /api/contacts/{id} (UPDATE) с Content-Type: application/merge-patch+json:
//    - firstName, lastName → горно ниво ✅
//    - phoneNumber         → НЕ работи на горно ниво при PATCH ❌
//                            ПРАВИЛНИЯТ начин: fields:[{slug:"phone_number", value:...}]
//    - custom fields       → fields:[{slug:"naruchnici", value:...}] ✅
//
//  PUT /api/contacts/{id} → 405 Method Not Allowed ❌ (НЕ СЪЩЕСТВУВА)
//
//  Официален пример за PATCH от документацията:
//  {
//    "locale": "en",
//    "fields": [
//      { "slug": "country", "value": "US" },
//      { "slug": "phone_number", "value": null }
//    ]
//  }
// ═══════════════════════════════════════════════════════════════

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const tagIdCache: Record<string, number | null> = {}

// ── Phone formatter ───────────────────────────────────────────────────────────
export function formatPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined
  const raw = phone.trim()
  if (!raw) return undefined
  const digits = raw.replace(/[\s\-().+]/g, '')
  if (!digits || digits.length < 7 || digits.length > 15) return undefined
  if (raw.startsWith('+')) return raw.replace(/\s/g, '')
  if (digits.startsWith('359') && digits.length >= 11) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 10) return `+359${digits.slice(1)}`
  return `+359${digits}`
}

// ── Name splitter ─────────────────────────────────────────────────────────────
export function splitName(name?: string | null): { firstName: string; lastName: string } {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
  }
}

function safeJson(text: string): any {
  try { return JSON.parse(text) } catch { return undefined }
}

// ── Response classifiers ──────────────────────────────────────────────────────
function isDuplicateEmail(status: number, data: any): boolean {
  if (status === 409) return true
  if (status !== 422) return false
  const d = (data?.detail || data?.violations?.[0]?.message || '').toLowerCase()
  return d.includes('already used') || d.includes('already exists')
}

function isFieldSlugMissing(status: number, data: any): boolean {
  if (status !== 422) return false
  return (data?.violations || []).some(
    (v: any) =>
      (v?.propertyPath || '').startsWith('fields[') &&
      (v?.message || '').toLowerCase().includes('does not exist')
  )
}

function isPhoneInvalid(status: number, data: any): boolean {
  if (status !== 422) return false
  return (data?.violations || []).some(
    (v: any) => (v?.propertyPath || '') === 'phoneNumber'
  )
}

function isEmailInvalid(status: number, data: any): boolean {
  if (status !== 422) return false
  if (isFieldSlugMissing(status, data)) return false
  if (isPhoneInvalid(status, data)) return false
  const violations: any[] = data?.violations || []
  if (violations.some((v: any) => v?.propertyPath === 'email')) return true
  if (violations.length === 0) {
    const d = (data?.detail || '').toLowerCase()
    return d.includes('not a valid email') || d.includes('email address is not valid')
  }
  return false
}

function isPlanLimit(status: number, data: any): boolean {
  if (status !== 422 && status !== 400) return false
  const d = (data?.detail || data?.violations?.[0]?.message || '').toLowerCase()
  return d.includes('upgrade') || d.includes('plan')
}

// ── Core fetch ────────────────────────────────────────────────────────────────
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
      'X-API-Key': apiKey,
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = safeJson(text)

  if (!res.ok) {
    console.warn(`[Sio] ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`)
  } else {
    console.info(`[Sio] ${method} ${path} → ${res.status} ok`)
  }

  return { ok: res.ok, status: res.status, data, text }
}

// ── Find contact by email ─────────────────────────────────────────────────────
async function findContactByEmail(apiKey: string, email: string): Promise<string | null> {
  const { ok, data } = await sioFetch(
    apiKey, 'GET',
    `/api/contacts?email=${encodeURIComponent(email)}&limit=10&order=asc`
  )
  if (!ok || !data) return null
  const items = data.items || data['hydra:member'] || []
  const found = items.find((c: any) => c.email?.toLowerCase() === email.toLowerCase())
  const id = found?.id ? String(found.id) : null
  console.info(`[Sio] findByEmail ${email} → ${id || 'не намерен'}`)
  return id
}

// ── CREATE contact (POST) ─────────────────────────────────────────────────────
// При POST: email/firstName/lastName/phoneNumber са на горно ниво
// Custom fields (naruchnici) са в fields[]
async function createContact(
  apiKey: string,
  email: string,
  firstName: string,
  lastName: string,
  phone?: string,
  naruchnikSlug?: string
): Promise<{ contactId: string | null; error?: string; emailInvalid?: boolean }> {

  const body: Record<string, unknown> = { email }
  if (firstName) body.firstName = firstName
  if (lastName) body.lastName = lastName
  if (phone) body.phoneNumber = phone
  if (naruchnikSlug) body.fields = [{ slug: 'naruchnici', value: naruchnikSlug }]

  console.info(`[Sio] CREATE body: ${JSON.stringify(body)}`)

  const res = await sioFetch(apiKey, 'POST', '/api/contacts', body)

  if (res.ok) {
    const id = res.data?.id ? String(res.data.id) : null
    console.info(`[Sio] CREATE ok → id=${id} fn="${res.data?.firstName}" ln="${res.data?.lastName}"`)
    return { contactId: id }
  }

  if (isDuplicateEmail(res.status, res.data)) {
    console.info(`[Sio] Duplicate → findByEmail`)
    await sleep(500)
    return { contactId: await findContactByEmail(apiKey, email) }
  }

  if (isEmailInvalid(res.status, res.data)) {
    const msg = res.data?.violations?.find((v: any) => v?.propertyPath === 'email')?.message
      || res.data?.detail || 'Invalid email'
    return { contactId: null, error: `EMAIL_INVALID: ${msg}`, emailInvalid: true }
  }

  if (isPhoneInvalid(res.status, res.data)) {
    console.warn(`[Sio] Phone invalid при CREATE → retry без телефон`)
    const b2: Record<string, unknown> = { email }
    if (firstName) b2.firstName = firstName
    if (lastName) b2.lastName = lastName
    if (naruchnikSlug) b2.fields = [{ slug: 'naruchnici', value: naruchnikSlug }]
    const r2 = await sioFetch(apiKey, 'POST', '/api/contacts', b2)
    if (r2.ok) return { contactId: String(r2.data?.id) }
    if (isDuplicateEmail(r2.status, r2.data)) return { contactId: await findContactByEmail(apiKey, email) }
    if (isEmailInvalid(r2.status, r2.data)) return { contactId: null, error: 'EMAIL_INVALID', emailInvalid: true }
    return { contactId: null, error: `CREATE no-phone → ${r2.status}` }
  }

  if (isFieldSlugMissing(res.status, res.data)) {
    console.warn(`[Sio] Field slug missing при CREATE → retry без fields`)
    const b2: Record<string, unknown> = { email }
    if (firstName) b2.firstName = firstName
    if (lastName) b2.lastName = lastName
    if (phone) b2.phoneNumber = phone
    const r2 = await sioFetch(apiKey, 'POST', '/api/contacts', b2)
    if (r2.ok) return { contactId: String(r2.data?.id) }
    if (isDuplicateEmail(r2.status, r2.data)) return { contactId: await findContactByEmail(apiKey, email) }
    if (isEmailInvalid(r2.status, r2.data)) return { contactId: null, error: 'EMAIL_INVALID', emailInvalid: true }
    return { contactId: null, error: `CREATE no-fields → ${r2.status}` }
  }

  if (res.status === 429) {
    console.info(`[Sio] Rate limited → чакам 8s`)
    await sleep(8000)
    const r2 = await sioFetch(apiKey, 'POST', '/api/contacts', body)
    if (r2.ok) return { contactId: String(r2.data?.id) }
    if (isDuplicateEmail(r2.status, r2.data)) return { contactId: await findContactByEmail(apiKey, email) }
    return { contactId: null, error: `CREATE 429 retry → ${r2.status}` }
  }

  return { contactId: null, error: `CREATE ${res.status}: ${res.text?.slice(0, 200)}` }
}

// ── UPDATE contact (PATCH) ────────────────────────────────────────────────────
// КРИТИЧНО: Systeme.io PATCH правила (потвърдени от официалната документация):
//
//   firstName / lastName  → директно в body (горно ниво)
//   phoneNumber           → чрез fields:[{slug:"phone_number", value:"+359..."}]
//   naruchnici            → чрез fields:[{slug:"naruchnici",   value:"super-domati"}]
//
// Всичко в ЕДНО PATCH извикване.
async function updateContact(
  apiKey: string,
  contactId: string,
  firstName: string,
  lastName: string,
  phone?: string,
  naruchnikSlug?: string
): Promise<'ok' | 'notFound' | 'rateLimited' | 'error'> {

  const fn = firstName?.trim() || ''
  const ln = lastName?.trim() || ''

  if (!fn && !ln && !phone && !naruchnikSlug) {
    console.info(`[Sio] UPDATE skip ${contactId} — няма данни`)
    return 'ok'
  }

  const patchBody: Record<string, unknown> = {}

  // Имена → горно ниво
  if (fn) patchBody.firstName = fn
  if (ln) patchBody.lastName = ln

  // Телефон → fields slug "phone_number" (НЕ phoneNumber на горно ниво!)
  // Custom field → fields slug "naruchnici"
  const fields: Array<{ slug: string; value: string }> = []
  if (phone) fields.push({ slug: 'phone_number', value: phone })
  if (naruchnikSlug) fields.push({ slug: 'naruchnici', value: naruchnikSlug })
  if (fields.length > 0) patchBody.fields = fields

  console.info(`[Sio] UPDATE PATCH ${contactId}: ${JSON.stringify(patchBody)}`)

  const res = await sioFetch(
    apiKey, 'PATCH', `/api/contacts/${contactId}`,
    patchBody, 'application/merge-patch+json'
  )

  if (res.ok) {
    console.info(`[Sio] UPDATE ok ${contactId} ✅ → fn="${res.data?.firstName}" ln="${res.data?.lastName}"`)
    return 'ok'
  }

  if (res.status === 404) return 'notFound'
  if (res.status === 429) return 'rateLimited'

  // phone_number slug проблем или невалиден → retry без phone
  if (isPhoneInvalid(res.status, res.data) || isFieldSlugMissing(res.status, res.data)) {
    console.warn(`[Sio] UPDATE phone/field проблем → retry без phone_number`)
    const b2: Record<string, unknown> = {}
    if (fn) b2.firstName = fn
    if (ln) b2.lastName = ln
    if (naruchnikSlug) b2.fields = [{ slug: 'naruchnici', value: naruchnikSlug }]
    if (Object.keys(b2).length === 0) return 'ok'

    const r2 = await sioFetch(apiKey, 'PATCH', `/api/contacts/${contactId}`, b2, 'application/merge-patch+json')
    if (r2.ok) return 'ok'
    if (r2.status === 404) return 'notFound'
    if (r2.status === 429) return 'rateLimited'

    // И naruchnici slug не съществува → само имена
    if (isFieldSlugMissing(r2.status, r2.data)) {
      const b3: Record<string, unknown> = {}
      if (fn) b3.firstName = fn
      if (ln) b3.lastName = ln
      if (Object.keys(b3).length === 0) return 'ok'
      const r3 = await sioFetch(apiKey, 'PATCH', `/api/contacts/${contactId}`, b3, 'application/merge-patch+json')
      if (r3.ok) return 'ok'
      if (r3.status === 404) return 'notFound'
      if (r3.status === 429) return 'rateLimited'
      return 'error'
    }

    return 'error'
  }

  console.warn(`[Sio] UPDATE error ${contactId}: ${res.status}`)
  return 'error'
}

// ── Get tag ID ────────────────────────────────────────────────────────────────
async function getTagId(apiKey: string, tagName: string): Promise<number | null> {
  const key = tagName.toLowerCase()
  if (key in tagIdCache) return tagIdCache[key]

  let lastId: number | null = null
  while (true) {
    const url = lastId
      ? `/api/tags?limit=100&startingAfter=${lastId}&order=asc`
      : `/api/tags?limit=100&order=asc`

    const res = await sioFetch(apiKey, 'GET', url)
    if (!res.ok) {
      if (isPlanLimit(res.status, res.data)) { tagIdCache[key] = null; return null }
      break
    }

    const items: any[] = res.data?.items || res.data?.['hydra:member'] || []
    for (const t of items) {
      if (t?.id && t?.name) tagIdCache[t.name.toLowerCase()] = Number(t.id)
    }

    if (key in tagIdCache) return tagIdCache[key] ?? null
    if (!res.data?.hasMore || items.length === 0) break
    lastId = Number(items[items.length - 1]?.id) || null
    if (!lastId) break
    await sleep(300)
  }

  console.info(`[Sio] Таг "${tagName}" не е намерен → създаваме`)
  const cr = await sioFetch(apiKey, 'POST', '/api/tags', { name: tagName })
  if (cr.ok && cr.data?.id) {
    tagIdCache[key] = Number(cr.data.id)
    console.info(`[Sio] Таг "${tagName}" създаден → id=${tagIdCache[key]}`)
    return tagIdCache[key] ?? null
  }
  if (isPlanLimit(cr.status, cr.data)) { tagIdCache[key] = null; return null }
  console.warn(`[Sio] Не можем да създадем таг "${tagName}": ${cr.text?.slice(0, 200)}`)
  tagIdCache[key] = null
  return null
}

// ── Add tag ───────────────────────────────────────────────────────────────────
async function addTag(apiKey: string, contactId: string, tagName: string): Promise<void> {
  const tagId = await getTagId(apiKey, tagName.toLowerCase())
  if (tagId === null) {
    console.warn(`[Sio] addTag: не можем да намерим/създадем таг "${tagName}"`)
    return
  }
  const res = await sioFetch(apiKey, 'POST', `/api/contacts/${contactId}/tags`, { tagId })
  if (res.status === 429) {
    await sleep(5000)
    await sioFetch(apiKey, 'POST', `/api/contacts/${contactId}/tags`, { tagId })
    return
  }
  if (res.ok || res.status === 409) {
    console.info(`[Sio] Таг "${tagName}" → контакт ${contactId} ✅`)
  } else {
    console.warn(`[Sio] addTag "${tagName}" error: ${res.status}`)
  }
}

// ── MAIN syncContact ──────────────────────────────────────────────────────────
export async function syncContact(params: {
  apiKey: string
  email: string
  name?: string | null
  phone?: string | null
  contactId?: string | null
  tag?: string
  naruchnikSlug?: string | null
}): Promise<{ ok: boolean; contactId?: string; error?: string; emailInvalid?: boolean }> {

  const { apiKey, email, tag = 'naruchnik' } = params
  const { firstName, lastName } = splitName(params.name)
  const phone = formatPhone(params.phone)
  const slug = params.naruchnikSlug || undefined

  console.info(`[Sio] ── syncContact: ${email} | id=${params.contactId || 'none'} | fn="${firstName}" ln="${lastName}" | phone="${phone || ''}" | slug="${slug || ''}"`)

  let contactId: string | null = params.contactId || null

  // ══════════════════════════════════════════════════════
  // CASE A: Имаме contactId → update директно
  // ══════════════════════════════════════════════════════
  if (contactId) {
    const upd = await updateContact(apiKey, contactId, firstName, lastName, phone, slug)

    if (upd === 'ok') {
      await sleep(300)
      await addTag(apiKey, contactId, tag)
      return { ok: true, contactId }
    }

    if (upd === 'rateLimited') {
      for (let i = 1; i <= 3; i++) {
        await sleep(4000 * i)
        const r = await updateContact(apiKey, contactId, firstName, lastName, phone, slug)
        if (r === 'ok') {
          await sleep(300)
          await addTag(apiKey, contactId, tag)
          return { ok: true, contactId }
        }
        if (r === 'notFound') { contactId = null; break }
        if (r === 'error') return { ok: false, error: `Rate limit retry error: ${email}` }
      }
      if (contactId !== null) return { ok: false, error: `Rate limited: ${email}` }
    }

    if (upd === 'notFound') {
      console.info(`[Sio] contactId ${contactId} не е намерен → ще търсим по email`)
      contactId = null
    }

    if (upd === 'error') {
      const found = await findContactByEmail(apiKey, email)
      if (found) {
        await sleep(300)
        await updateContact(apiKey, found, firstName, lastName, phone, slug)
        await sleep(300)
        await addTag(apiKey, found, tag)
        return { ok: true, contactId: found }
      }
      return { ok: false, error: `Update error: ${email}` }
    }
  }

  // ══════════════════════════════════════════════════════
  // CASE B: Нямаме contactId → търсим по email
  // ══════════════════════════════════════════════════════
  if (!contactId) {
    const existingId = await findContactByEmail(apiKey, email)

    if (existingId) {
      console.info(`[Sio] Намерен по email: ${existingId} → update`)
      contactId = existingId
      await sleep(300)
      await updateContact(apiKey, contactId, firstName, lastName, phone, slug)
      await sleep(300)
      await addTag(apiKey, contactId, tag)
      return { ok: true, contactId }
    }
  }

  // ══════════════════════════════════════════════════════
  // CASE C: Нов контакт → create
  // ══════════════════════════════════════════════════════
  if (!contactId) {
    const created = await createContact(apiKey, email, firstName, lastName, phone, slug)

    if (created.emailInvalid) return { ok: false, error: created.error, emailInvalid: true }
    if (created.error) return { ok: false, error: created.error }

    contactId = created.contactId
    if (!contactId) return { ok: false, error: 'No contact ID after create' }

    // PATCH след create — за да запишем phone_number slug и naruchnici
    if (phone || slug) {
      await sleep(400)
      await updateContact(apiKey, contactId, firstName, lastName, phone, slug)
    }
  }

  await sleep(300)
  await addTag(apiKey, contactId!, tag)

  console.info(`[Sio] ✅ ${email} готово. contactId=${contactId}`)
  return { ok: true, contactId: contactId! }
}

// ── Sync with retry ───────────────────────────────────────────────────────────
export async function syncContactWithRetry(
  params: Parameters<typeof syncContact>[0],
  retries = 2
): Promise<{ ok: boolean; contactId?: string; error?: string; emailInvalid?: boolean }> {
  for (let i = 0; i <= retries; i++) {
    const result = await syncContact(params)
    if (result.ok) return result
    if (result.emailInvalid) return result
    if (i < retries) {
      const delay = 2000 * (i + 1)
      console.warn(`[Sio] Retry ${i + 1} за ${params.email} след ${delay}ms: ${result.error}`)
      await sleep(delay)
    }
  }
  return { ok: false, error: 'Max retries exceeded' }
}
