// lib/systemeio.ts — v23
// ФИНАЛНИ ПОПРАВКИ v23:
//
//  1. createContact: phoneNumber → TOP-LEVEL поле (не fields[phone_number]!)
//     Официалната документация: POST body = { email, firstName, lastName, phoneNumber, fields[] }
//     fields[] е САМО за custom полета (naruchnici и др.)
//     Грешката: телефонът се записваше в custom field phone_number → записваше се без "+"
//
//  2. patchContactDirect: phoneNumber → TOP-LEVEL при PATCH също
//     Systeme.io приема phoneNumber като top-level при merge-patch
//
//  3. Имената при PATCH: изпращат се ВИНАГИ (дори "") — вече работи (v22)
//
//  4. getTagId: cursor-based pagination с startingAfter (не page=N) — v22
//
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
  const firstName = parts[0]                 || ''
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

function isFieldSlugMissing(status: number, data: any): boolean {
  if (status !== 422) return false
  const violations: any[] = data?.violations || []
  return violations.some(
    (v: any) => (v?.propertyPath || '').startsWith('fields[') &&
                (v?.message || '').toLowerCase().includes('does not exist')
  )
}

function isEmailInvalid(status: number, data: any): boolean {
  if (status !== 422) return false
  if (isFieldSlugMissing(status, data)) return false

  const violations: any[] = data?.violations || []
  const hasEmailViolation = violations.some(
    (v: any) => v?.propertyPath === 'email'
  )
  if (hasEmailViolation) return true

  if (violations.length === 0) {
    const detail = (data?.detail || '').toLowerCase()
    return detail.includes('email') && !isDuplicateEmail(status, data)
  }
  return false
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
    !isFieldSlugMissing(res.status, data) &&
    res.status !== 429
  ) {
    console.warn(`[Sio] ${method} ${path} → ${res.status}:`, text.slice(0, 300))
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
  return found?.id ? String(found.id) : null
}

// ── Create contact ────────────────────────────────────────────────────────────
// ✅ ПРАВИЛНО (официална документация):
//   POST body: { email, firstName, lastName, phoneNumber, fields[] }
//   phoneNumber → TOP-LEVEL системно поле
//   fields[]    → САМО за custom полета (naruchnici и др.)
//
async function createContact(
  apiKey:         string,
  email:          string,
  firstName:      string,
  lastName:       string,
  phone?:         string,
  naruchnikSlug?: string
): Promise<{ contactId: string | null; error?: string; emailInvalid?: boolean }> {

  // Custom fields — САМО naruchnici (phone е top-level!)
  const fields: { slug: string; value: string }[] = []
  if (naruchnikSlug) fields.push({ slug: 'naruchnici', value: naruchnikSlug })

  const body: Record<string, unknown> = { email, firstName, lastName }
  if (phone)          body.phoneNumber = phone          // ← TOP-LEVEL!
  if (fields.length)  body.fields      = fields

  console.info(`[Sio] POST /api/contacts body:`, JSON.stringify(body))
  const res = await sioFetch(apiKey, 'POST', '/api/contacts', body)

  if (res.ok) {
    console.info(`[Sio] POST ok → contactId=${res.data?.id}`)
    return { contactId: String(res.data?.id) }
  }

  if (isDuplicateEmail(res.status, res.data)) {
    await sleep(400)
    return { contactId: await findContactByEmail(apiKey, email) }
  }

  if (isEmailInvalid(res.status, res.data)) {
    const detail = res.data?.violations?.[0]?.message || res.data?.detail || 'Invalid email'
    console.info(`[Sio] Invalid email "${email}": ${detail}`)
    return { contactId: null, error: `EMAIL_INVALID: ${detail}`, emailInvalid: true }
  }

  // fields[] slug не съществува → retry без custom fields
  if (isFieldSlugMissing(res.status, res.data)) {
    console.info(`[Sio] POST fields[] rejected → retry без custom fields`)
    const body2: Record<string, unknown> = { email, firstName, lastName }
    if (phone) body2.phoneNumber = phone
    const r2 = await sioFetch(apiKey, 'POST', '/api/contacts', body2)
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
    return { contactId: null, error: `POST 429 retry ${r2.status}: ${r2.text?.slice(0, 200)}` }
  }

  return { contactId: null, error: `POST ${res.status}: ${res.text?.slice(0, 200)}` }
}

// ── Patch contact ─────────────────────────────────────────────────────────────
// ✅ ПРАВИЛНО (официална документация):
//   PATCH Content-Type: application/merge-patch+json
//   { firstName, lastName, phoneNumber, fields[] }
//   phoneNumber → TOP-LEVEL (не fields[phone_number]!)
//   fields[]    → само custom полета (naruchnici)
//
async function patchContactDirect(
  apiKey:         string,
  contactId:      string,
  firstName:      string,
  lastName:       string,
  phone?:         string,
  naruchnikSlug?: string
): Promise<'ok' | 'notFound' | 'rateLimited' | 'error'> {

  const fn = firstName?.trim() || ''
  const ln = lastName?.trim()  || ''

  // Custom fields — САМО naruchnici
  const fields: { slug: string; value: string }[] = []
  if (naruchnikSlug) fields.push({ slug: 'naruchnici', value: naruchnikSlug })

  const hasData = fn !== '' || ln !== '' || !!phone || fields.length > 0
  if (!hasData) {
    console.info(`[Sio] PATCH skip ${contactId} — no data`)
    return 'ok'
  }

  const body: Record<string, unknown> = {
    firstName: fn,
    lastName:  ln,
  }
  if (phone)         body.phoneNumber = phone   // ← TOP-LEVEL!
  if (fields.length) body.fields      = fields

  console.info(`[Sio] PATCH body за ${contactId}:`, JSON.stringify(body))

  const res = await sioFetch(
    apiKey, 'PATCH', `/api/contacts/${contactId}`,
    body, 'application/merge-patch+json'
  )

  console.info(`[Sio] PATCH status=${res.status} ok=${res.ok}`)

  if (res.ok) {
    if (phone) {
      const saved = res.data?.phoneNumber
      console.info(`[Sio] phoneNumber: sent="${phone}" → saved="${saved || 'не е в response'}"`)
    }
    if (fn || ln) {
      console.info(`[Sio] firstName="${res.data?.firstName}" lastName="${res.data?.lastName}"`)
    }
    return 'ok'
  }

  if (res.status === 404) return 'notFound'
  if (res.status === 429) return 'rateLimited'

  // fields[] slug не съществува → retry само с имена + телефон (без custom fields)
  if (isFieldSlugMissing(res.status, res.data)) {
    console.info(`[Sio] PATCH fields[] rejected → retry без custom fields`)
    const body2: Record<string, unknown> = { firstName: fn, lastName: ln }
    if (phone) body2.phoneNumber = phone
    const res2 = await sioFetch(
      apiKey, 'PATCH', `/api/contacts/${contactId}`,
      body2, 'application/merge-patch+json'
    )
    if (res2.ok) {
      console.info(`[Sio] PATCH retry (без fields) → ok ✅`)
      return 'ok'
    }
    if (res2.status === 404) return 'notFound'
    if (res2.status === 429) return 'rateLimited'
    console.warn(`[Sio] PATCH retry failed: ${res2.status} ${res2.text?.slice(0, 200)}`)
    return 'error'
  }

  console.warn(`[Sio] PATCH error: ${res.status} ${res.text?.slice(0, 200)}`)
  return 'error'
}

// ── Get tag ID (cursor-based pagination) ──────────────────────────────────────
// Systeme.io: cursor-based pagination с startingAfter=<last_id>, НЕ page=N
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
      if (isPlanLimit(res.status, res.data)) {
        tagIdCache[key] = null
        return null
      }
      console.warn(`[Sio] GET /api/tags → ${res.status}`)
      break
    }

    const items: any[] = res.data?.items || res.data?.['hydra:member'] || []

    for (const t of items) {
      if (t?.id && t?.name) {
        tagIdCache[t.name.toLowerCase()] = Number(t.id)
      }
    }

    if (key in tagIdCache) {
      console.info(`[Sio] Таг "${tagName}" → ID ${tagIdCache[key]}`)
      return tagIdCache[key] ?? null
    }

    const hasMore = res.data?.hasMore === true
    if (!hasMore || items.length === 0) break

    lastId = Number(items[items.length - 1]?.id) || null
    if (!lastId) break
    await sleep(300)
  }

  // Тагът не съществува → създаваме го
  console.info(`[Sio] Тагът "${tagName}" не е намерен → създаваме`)
  const createRes = await sioFetch(apiKey, 'POST', '/api/tags', { name: tagName })
  if (createRes.ok && createRes.data?.id) {
    tagIdCache[key] = Number(createRes.data.id)
    console.info(`[Sio] Таг "${tagName}" създаден → ID ${tagIdCache[key]}`)
    return tagIdCache[key] ?? null
  }
  if (isPlanLimit(createRes.status, createRes.data)) {
    tagIdCache[key] = null
    return null
  }
  console.warn(`[Sio] Не можем да създадем таг "${tagName}": ${createRes.text?.slice(0, 200)}`)
  tagIdCache[key] = null
  return null
}

// ── Add tag ───────────────────────────────────────────────────────────────────
async function addTag(apiKey: string, contactId: string, tagName: string): Promise<void> {
  const tagId = await getTagId(apiKey, tagName.toLowerCase())
  if (tagId === null) {
    console.warn(`[Sio] addTag: не можем да намерим/създадем таг "${tagName}" — пропускаме`)
    return
  }

  const res = await sioFetch(apiKey, 'POST', `/api/contacts/${contactId}/tags`, { tagId })

  if (res.status === 429) {
    await sleep(5000)
    await sioFetch(apiKey, 'POST', `/api/contacts/${contactId}/tags`, { tagId })
    return
  }
  if (!res.ok && res.status !== 409) {
    console.warn(`[Sio] addTag "${tagName}" (id=${tagId}) → ${res.status}: ${res.text?.slice(0, 200)}`)
  } else if (res.ok) {
    console.info(`[Sio] Таг "${tagName}" добавен към контакт ${contactId} ✅`)
  }
}

// ── MAIN syncContact ──────────────────────────────────────────────────────────
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
  const slug  = params.naruchnikSlug || undefined

  console.info(`[Sio] syncContact START: ${email} | contactId=${params.contactId || 'none'} | name="${params.name || ''}"`)

  let contactId: string | null = params.contactId || null

  // ═══════════════════════════════════════════════════════════════
  // CASE A: Имаме contactId → PATCH директно
  // ═══════════════════════════════════════════════════════════════
  if (contactId) {
    const p1 = await patchContactDirect(apiKey, contactId, firstName, lastName, phone, slug)
    console.info(`[Sio] PATCH #1 за ${email}: ${p1}`)

    if (p1 === 'ok') {
      await sleep(300)
      await addTag(apiKey, contactId, tag)
      console.info(`[Sio] ✅ ${email} — PATCH ok`)
      return { ok: true, contactId }
    }

    if (p1 === 'rateLimited') {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const wait = 4000 * attempt
        console.info(`[Sio] Rate limited за ${email} — чакам ${wait}ms (опит ${attempt}/3)`)
        await sleep(wait)
        const rr = await patchContactDirect(apiKey, contactId, firstName, lastName, phone, slug)
        console.info(`[Sio] PATCH retry #${attempt} за ${email}: ${rr}`)
        if (rr === 'ok') {
          await sleep(300)
          await addTag(apiKey, contactId, tag)
          return { ok: true, contactId }
        }
        if (rr === 'notFound') { contactId = null; break }
        if (rr === 'error')    { return { ok: false, error: `PATCH error after rate limit for ${email}` } }
      }
      if (contactId !== null) {
        return { ok: false, error: `PATCH rate limited for ${email}` }
      }
    }

    if (p1 === 'notFound') {
      console.info(`[Sio] contactId ${contactId} не е намерен → търсим по email`)
      contactId = null
    }

    if (p1 === 'error') {
      const found = await findContactByEmail(apiKey, email)
      if (found) {
        await sleep(300)
        await patchContactDirect(apiKey, found, firstName, lastName, phone, slug)
        await sleep(300)
        await addTag(apiKey, found, tag)
        return { ok: true, contactId: found }
      }
      return { ok: false, error: `PATCH error for ${email}` }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CASE B: Нямаме contactId → POST (create)
  // ═══════════════════════════════════════════════════════════════
  console.info(`[Sio] POST /api/contacts за ${email}`)
  const created = await createContact(apiKey, email, firstName, lastName, phone, slug)

  if (created.emailInvalid) {
    return { ok: false, error: created.error, emailInvalid: true }
  }
  if (created.error) {
    return { ok: false, error: created.error }
  }

  contactId = created.contactId
  if (!contactId) {
    return { ok: false, error: 'No contact ID' }
  }

  // PATCH след create — обновява naruchnici custom field ако POST го е пропуснал
  await sleep(300)
  const p2 = await patchContactDirect(apiKey, contactId, firstName, lastName, phone, slug)
  console.info(`[Sio] PATCH #2 за ${email}: ${p2}`)
  await sleep(300)
  await addTag(apiKey, contactId, tag)

  console.info(`[Sio] ✅ ${email} — готово (CASE B)`)
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
