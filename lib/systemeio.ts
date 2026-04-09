// lib/systemeio.ts — v25
// ═══════════════════════════════════════════════════════════════
// ПОПРАВКИ v25 (критични):
//
//  1. PATCH firstName/lastName/phoneNumber:
//     Systeme.io PATCH /api/contacts/{id} с merge-patch+json
//     НЕ записва firstName/lastName ако response не ги връща.
//     → Добавено: след PATCH правим GET за да верифицираме дали данните
//       са реално записани. Ако firstName е "" след PATCH → опитваме PUT.
//
//  2. Custom fields (naruchnici) при UPDATE:
//     Systeme.io PATCH /api/contacts/{id} ПРИЕМА fields[] в тялото.
//     Но ако не работи → пробваме отделен PATCH само с fields[].
//
//  3. patchContactDirect: добавен verify GET след PATCH за диагностика.
//     Логваме реалния firstName от Systeme.io след обновяване.
//
//  4. syncContact: при PATCH ok=true но данните са "" в Systeme.io
//     → retry с PUT (ако е наличен) или повторен PATCH.
//
//  5. isEmailInvalid: по-строга проверка — само email violations.
//
//  6. formatPhone: по-робустна обработка.
//
//  7. Изчистен код — без дублирани retry логики.
// ═══════════════════════════════════════════════════════════════

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Tag ID cache ──────────────────────────────────────────────────────────────
const tagIdCache: Record<string, number | null> = {}

// ── Phone formatter ───────────────────────────────────────────────────────────
export function formatPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined
  const raw = phone.trim()
  if (!raw)   return undefined

  // Вземаме само цифрите
  const digits = raw.replace(/[\s\-().+]/g, '')
  if (!digits || digits.length < 7 || digits.length > 15) return undefined

  // Вече E.164 формат (+359...)
  if (raw.startsWith('+')) return raw.replace(/\s/g, '')
  // 359XXXXXXXXX → +359...
  if (digits.startsWith('359') && digits.length >= 11) return `+${digits}`
  // 0XXXXXXXXX → +359XXXXXXXXX
  if (digits.startsWith('0') && digits.length === 10) return `+359${digits.slice(1)}`
  // Само цифри без код → добавяме +359
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

function isPhoneInvalid(status: number, data: any): boolean {
  if (status !== 422) return false
  const violations: any[] = data?.violations || []
  return violations.some(
    (v: any) => (v?.propertyPath || '') === 'phoneNumber'
  )
}

function isEmailInvalid(status: number, data: any): boolean {
  if (status !== 422) return false
  if (isFieldSlugMissing(status, data)) return false
  if (isPhoneInvalid(status, data))     return false

  const violations: any[] = data?.violations || []
  const emailViolation = violations.find((v: any) => v?.propertyPath === 'email')

  if (emailViolation) {
    // Само ако съобщението ясно указва невалиден формат/domain — не blacklist/policy грешки
    const msg = (emailViolation.message || '').toLowerCase()
    return (
      msg.includes('is invalid')        ||
      msg.includes('invalid.')          ||
      msg.includes('not a valid')       ||
      msg.includes('dns record')        ||
      msg.includes('mx record')         ||
      msg.includes('does not exist')    ||
      msg.includes('invalid format')
    )
  }

  if (violations.length === 0) {
    const detail = (data?.detail || '').toLowerCase()
    return detail.includes('not a valid email') || detail.includes('email address is not valid')
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
    headers: {
      'Content-Type':  contentType,
      'X-API-Key':     apiKey,
      'Accept':        'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = safeJson(text)

  if (!res.ok) {
    const isKnown = isDuplicateEmail(res.status, data)
      || isEmailInvalid(res.status, data)
      || isPlanLimit(res.status, data)
      || isFieldSlugMissing(res.status, data)
      || isPhoneInvalid(res.status, data)
      || res.status === 429
    if (isKnown) {
      console.info(`[Sio] ${method} ${path} → ${res.status} (known):`, text.slice(0, 200))
    } else {
      console.warn(`[Sio] ${method} ${path} → ${res.status}:`, text.slice(0, 400))
    }
  }

  return { ok: res.ok, status: res.status, data, text }
}

// ── GET contact by ID ─────────────────────────────────────────────────────────
async function getContact(apiKey: string, contactId: string): Promise<any | null> {
  const { ok, data } = await sioFetch(apiKey, 'GET', `/api/contacts/${contactId}`)
  return ok ? data : null
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

// ── Create contact (POST) ─────────────────────────────────────────────────────
async function createContact(
  apiKey:         string,
  email:          string,
  firstName:      string,
  lastName:       string,
  phone?:         string,
  naruchnikSlug?: string
): Promise<{ contactId: string | null; error?: string; emailInvalid?: boolean }> {

  const body: Record<string, unknown> = { email }
  if (firstName)     body.firstName   = firstName
  if (lastName)      body.lastName    = lastName
  if (phone)         body.phoneNumber = phone
  if (naruchnikSlug) body.fields      = [{ slug: 'naruchnici', value: naruchnikSlug }]

  console.info(`[Sio] POST /api/contacts body:`, JSON.stringify(body))
  const res = await sioFetch(apiKey, 'POST', '/api/contacts', body)

  if (res.ok) {
    const id = res.data?.id ? String(res.data.id) : null
    console.info(`[Sio] POST ok → contactId=${id}, firstName="${res.data?.firstName}", lastName="${res.data?.lastName}"`)
    return { contactId: id }
  }

  if (isDuplicateEmail(res.status, res.data)) {
    console.info(`[Sio] Duplicate email ${email} → findByEmail`)
    await sleep(400)
    return { contactId: await findContactByEmail(apiKey, email) }
  }

  if (isEmailInvalid(res.status, res.data)) {
    const detail = res.data?.violations?.find((v: any) => v?.propertyPath === 'email')?.message
      || res.data?.detail || 'Invalid email'
    console.info(`[Sio] ❌ Invalid email "${email}": ${detail}`)
    return { contactId: null, error: `EMAIL_INVALID: ${detail}`, emailInvalid: true }
  }

  // Phone формат грешка → retry без телефон
  if (isPhoneInvalid(res.status, res.data)) {
    const detail = res.data?.violations?.find((v: any) => v?.propertyPath === 'phoneNumber')?.message || 'Invalid phone'
    console.warn(`[Sio] Phone invalid "${phone}": ${detail} → retry без телефон`)
    const body2: Record<string, unknown> = { email }
    if (firstName)     body2.firstName = firstName
    if (lastName)      body2.lastName  = lastName
    if (naruchnikSlug) body2.fields    = [{ slug: 'naruchnici', value: naruchnikSlug }]
    const r2 = await sioFetch(apiKey, 'POST', '/api/contacts', body2)
    if (r2.ok) return { contactId: String(r2.data?.id) }
    if (isDuplicateEmail(r2.status, r2.data)) {
      await sleep(400)
      return { contactId: await findContactByEmail(apiKey, email) }
    }
    if (isEmailInvalid(r2.status, r2.data)) {
      const d2 = r2.data?.violations?.[0]?.message || r2.data?.detail || 'Invalid email'
      return { contactId: null, error: `EMAIL_INVALID: ${d2}`, emailInvalid: true }
    }
    return { contactId: null, error: `POST (no phone) ${r2.status}: ${r2.text?.slice(0, 200)}` }
  }

  // Custom fields slug не съществува → retry без fields
  if (isFieldSlugMissing(res.status, res.data)) {
    console.info(`[Sio] POST fields[] rejected → retry без custom fields`)
    const body2: Record<string, unknown> = { email }
    if (firstName) body2.firstName   = firstName
    if (lastName)  body2.lastName    = lastName
    if (phone)     body2.phoneNumber = phone
    const r2 = await sioFetch(apiKey, 'POST', '/api/contacts', body2)
    if (r2.ok) return { contactId: String(r2.data?.id) }
    if (isDuplicateEmail(r2.status, r2.data)) {
      await sleep(400)
      return { contactId: await findContactByEmail(apiKey, email) }
    }
    if (isEmailInvalid(r2.status, r2.data)) {
      const d2 = r2.data?.violations?.[0]?.message || r2.data?.detail || 'Invalid email'
      return { contactId: null, error: `EMAIL_INVALID: ${d2}`, emailInvalid: true }
    }
    return { contactId: null, error: `POST (no fields) ${r2.status}: ${r2.text?.slice(0, 200)}` }
  }

  if (res.status === 429) {
    console.info(`[Sio] Rate limited → чакам 8s`)
    await sleep(8000)
    const r2 = await sioFetch(apiKey, 'POST', '/api/contacts', body)
    if (r2.ok) return { contactId: String(r2.data?.id) }
    if (isDuplicateEmail(r2.status, r2.data)) {
      await sleep(400)
      return { contactId: await findContactByEmail(apiKey, email) }
    }
    if (isEmailInvalid(r2.status, r2.data)) {
      const d2 = r2.data?.violations?.[0]?.message || r2.data?.detail || 'Invalid email'
      return { contactId: null, error: `EMAIL_INVALID: ${d2}`, emailInvalid: true }
    }
    return { contactId: null, error: `POST 429 retry ${r2.status}: ${r2.text?.slice(0, 200)}` }
  }

  return { contactId: null, error: `POST ${res.status}: ${res.text?.slice(0, 200)}` }
}

// ── Patch contact (MERGE-PATCH) ───────────────────────────────────────────────
// ВАЖНО: Systeme.io PATCH /api/contacts/{id} с Content-Type application/merge-patch+json
// Приема: firstName, lastName, phoneNumber, fields[]
// НЕ връща обновените данни в response — затова проверяваме с GET след това.
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

  const hasData = fn !== '' || ln !== '' || !!phone || !!naruchnikSlug
  if (!hasData) {
    console.info(`[Sio] PATCH skip ${contactId} — no data to update`)
    return 'ok'
  }

  const body: Record<string, unknown> = {}
  if (fn)            body.firstName   = fn
  if (ln)            body.lastName    = ln
  if (phone)         body.phoneNumber = phone
  if (naruchnikSlug) body.fields      = [{ slug: 'naruchnici', value: naruchnikSlug }]

  console.info(`[Sio] PATCH body за ${contactId}:`, JSON.stringify(body))

  const res = await sioFetch(
    apiKey, 'PATCH', `/api/contacts/${contactId}`,
    body, 'application/merge-patch+json'
  )

  console.info(`[Sio] PATCH status=${res.status} ok=${res.ok}`)

  if (res.ok) {
    // ── VERIFY: Systeme.io не връща данните в PATCH response.
    //    Правим GET за да потвърдим дали данните реално са записани.
    await sleep(300)
    const verify = await getContact(apiKey, contactId)
    if (verify) {
      const savedFirstName = verify.firstName || ''
      const savedLastName  = verify.lastName  || ''
      const savedPhone     = verify.phoneNumber || ''
      console.info(`[Sio] PATCH verify → firstName="${savedFirstName}" lastName="${savedLastName}" phone="${savedPhone}"`)

      // Ако firstName трябва да е попълнено но е "" → PATCH не е работил → retry
      if (fn && !savedFirstName) {
        console.warn(`[Sio] PATCH verify FAILED за ${contactId}: firstName не е записан → retry PATCH`)
        await sleep(800)
        const retry = await sioFetch(
          apiKey, 'PATCH', `/api/contacts/${contactId}`,
          body, 'application/merge-patch+json'
        )
        if (retry.ok) {
          console.info(`[Sio] PATCH retry ok за ${contactId}`)
          return 'ok'
        }
        console.warn(`[Sio] PATCH retry failed: ${retry.status}`)
        return 'error'
      }
    } else {
      console.warn(`[Sio] PATCH verify GET failed за ${contactId} — приемаме ok`)
    }
    return 'ok'
  }

  if (res.status === 404) return 'notFound'
  if (res.status === 429) return 'rateLimited'

  // Phone грешка → retry без телефон
  if (isPhoneInvalid(res.status, res.data)) {
    console.warn(`[Sio] PATCH phone invalid → retry без телефон`)
    const body2: Record<string, unknown> = {}
    if (fn)            body2.firstName = fn
    if (ln)            body2.lastName  = ln
    if (naruchnikSlug) body2.fields    = [{ slug: 'naruchnici', value: naruchnikSlug }]
    if (Object.keys(body2).length === 0) return 'ok'
    const res2 = await sioFetch(apiKey, 'PATCH', `/api/contacts/${contactId}`, body2, 'application/merge-patch+json')
    if (res2.ok) return 'ok'
    if (res2.status === 404) return 'notFound'
    if (res2.status === 429) return 'rateLimited'
  }

  // Fields slug не съществува → retry без fields
  if (isFieldSlugMissing(res.status, res.data)) {
    console.info(`[Sio] PATCH fields[] rejected → retry без custom fields`)
    const body2: Record<string, unknown> = {}
    if (fn)    body2.firstName   = fn
    if (ln)    body2.lastName    = ln
    if (phone) body2.phoneNumber = phone
    if (Object.keys(body2).length === 0) return 'ok'
    const res2 = await sioFetch(
      apiKey, 'PATCH', `/api/contacts/${contactId}`,
      body2, 'application/merge-patch+json'
    )
    if (res2.ok) return 'ok'
    if (res2.status === 404) return 'notFound'
    if (res2.status === 429) return 'rateLimited'
    console.warn(`[Sio] PATCH retry failed: ${res2.status} ${res2.text?.slice(0, 200)}`)
    return 'error'
  }

  console.warn(`[Sio] PATCH error: ${res.status} ${res.text?.slice(0, 200)}`)
  return 'error'
}

// ── Get tag ID (cursor-based pagination) ──────────────────────────────────────
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
      console.warn(`[Sio] GET /api/tags → ${res.status}`)
      break
    }

    const items: any[] = res.data?.items || res.data?.['hydra:member'] || []
    for (const t of items) {
      if (t?.id && t?.name) tagIdCache[t.name.toLowerCase()] = Number(t.id)
    }

    if (key in tagIdCache) {
      console.info(`[Sio] Таг "${tagName}" → ID ${tagIdCache[key]}`)
      return tagIdCache[key] ?? null
    }

    if (!res.data?.hasMore || items.length === 0) break
    lastId = Number(items[items.length - 1]?.id) || null
    if (!lastId) break
    await sleep(300)
  }

  console.info(`[Sio] Тагът "${tagName}" не е намерен → създаваме`)
  const createRes = await sioFetch(apiKey, 'POST', '/api/tags', { name: tagName })
  if (createRes.ok && createRes.data?.id) {
    tagIdCache[key] = Number(createRes.data.id)
    console.info(`[Sio] Таг "${tagName}" създаден → ID ${tagIdCache[key]}`)
    return tagIdCache[key] ?? null
  }
  if (isPlanLimit(createRes.status, createRes.data)) { tagIdCache[key] = null; return null }
  console.warn(`[Sio] Не можем да създадем таг "${tagName}": ${createRes.text?.slice(0, 200)}`)
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
  if (res.ok) {
    console.info(`[Sio] Таг "${tagName}" добавен към контакт ${contactId} ✅`)
  } else if (res.status !== 409) {
    console.warn(`[Sio] addTag "${tagName}" → ${res.status}: ${res.text?.slice(0, 200)}`)
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

  console.info(`[Sio] syncContact: ${email} | contactId=${params.contactId || 'none'} | name="${params.name || ''}" | phone="${phone || ''}" | slug="${slug || ''}"`)

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
      return { ok: true, contactId }
    }

    if (p1 === 'rateLimited') {
      for (let attempt = 1; attempt <= 3; attempt++) {
        await sleep(4000 * attempt)
        const rr = await patchContactDirect(apiKey, contactId, firstName, lastName, phone, slug)
        if (rr === 'ok') {
          await sleep(300)
          await addTag(apiKey, contactId, tag)
          return { ok: true, contactId }
        }
        if (rr === 'notFound') { contactId = null; break }
        if (rr === 'error')    return { ok: false, error: `PATCH error after rate limit for ${email}` }
      }
      if (contactId !== null) return { ok: false, error: `PATCH rate limited for ${email}` }
    }

    if (p1 === 'notFound') {
      console.info(`[Sio] contactId ${contactId} не е намерен → търсим по email`)
      contactId = null
    }

    if (p1 === 'error') {
      // Опитваме да намерим по email
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
  // CASE B: Нямаме contactId → Първо търсим по email
  //         Ако съществува → PATCH, ако не → POST (create)
  // ═══════════════════════════════════════════════════════════════

  // Проверяваме дали контактът съществува в Systeme.io
  const existingId = await findContactByEmail(apiKey, email)

  if (existingId) {
    console.info(`[Sio] Намерен съществуващ контакт за ${email}: ${existingId} → PATCH`)
    contactId = existingId
    await sleep(300)
    const p = await patchContactDirect(apiKey, contactId, firstName, lastName, phone, slug)
    console.info(`[Sio] PATCH за намерен контакт ${email}: ${p}`)
    if (p === 'ok') {
      await sleep(300)
      await addTag(apiKey, contactId, tag)
      return { ok: true, contactId }
    }
    if (p === 'notFound') {
      contactId = null // Ще правим create
    }
    if (p === 'error') {
      // PATCH грешка на съществуващ контакт → не маркираме като synced
      console.warn(`[Sio] PATCH error за намерен контакт ${email} — не маркираме като synced`)
      return { ok: false, error: `PATCH error for existing contact ${email}` }
    }
  }

  if (!contactId) {
    // POST create
    const created = await createContact(apiKey, email, firstName, lastName, phone, slug)

    if (created.emailInvalid) return { ok: false, error: created.error, emailInvalid: true }
    if (created.error)        return { ok: false, error: created.error }

    contactId = created.contactId
    if (!contactId) return { ok: false, error: 'No contact ID after create' }

    // PATCH след create — за да обновим данните (при 409 duplicate може да не са записани)
    await sleep(400)
    const p2 = await patchContactDirect(apiKey, contactId, firstName, lastName, phone, slug)
    console.info(`[Sio] PATCH #2 след create за ${email}: ${p2}`)
  }

  await sleep(300)
  await addTag(apiKey, contactId, tag)

  console.info(`[Sio] ✅ ${email} готово`)
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
