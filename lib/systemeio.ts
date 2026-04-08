// lib/systemeio.ts — v4 DEFINITIVE
//
// Официална Systeme.io API документация:
//   POST   /api/contacts          → { email, firstName, lastName, fields: [{slug,value}] }
//   PATCH  /api/contacts/{id}     → Content-Type: application/merge-patch+json
//                                   { firstName, lastName, fields: [{slug,value}] }
//                                   !! phoneNumber НЕ е top-level при PATCH — използвай fields[slug=phone_number]
//   POST   /api/contacts/{id}/tags → { name: "tagName" }  (name работи, не изисква ID)
//   GET    /api/tags               → list tags
//   POST   /api/tags               → { name: "tagName" } → { id, name }
//
// Телефон: трябва E.164 → +359XXXXXXXXX

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Phone formatter ───────────────────────────────────────────────────────────
export function formatPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined
  const raw    = phone.trim()
  const digits = raw.replace(/[\s\-().+]/g, '')
  if (!digits || digits.length < 7) return undefined
  if (raw.startsWith('+'))          return raw        // вече E.164
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

// ── API fetch wrapper с логване ───────────────────────────────────────────────
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
  let data: any
  try { data = JSON.parse(text) } catch { data = undefined }

  if (!res.ok && res.status !== 409) {
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

// ── Create OR find contact ────────────────────────────────────────────────────
async function ensureContact(
  apiKey: string,
  email: string,
  firstName: string,
  lastName: string,
  phone?: string
): Promise<{ contactId: string | null; error?: string }> {
  // Build fields array — phone_number е стандартен Systeme.io slug
  const fields: { slug: string; value: string }[] = []
  if (phone) fields.push({ slug: 'phone_number', value: phone })

  const postBody: Record<string, unknown> = { email, firstName, lastName }
  if (fields.length > 0) postBody.fields = fields

  const res = await sioFetch(apiKey, 'POST', '/api/contacts', postBody)

  if (res.ok) {
    return { contactId: String(res.data.id) }
  }

  if (res.status === 409) {
    // Контактът вече съществува → намираме ID
    await sleep(500) // малка пауза преди search
    const contactId = await findContactByEmail(apiKey, email)
    return { contactId }
  }

  if (res.status === 429) {
    await sleep(3000)
    const retry = await sioFetch(apiKey, 'POST', '/api/contacts', postBody)
    if (retry.ok)              return { contactId: String(retry.data.id) }
    if (retry.status === 409)  return { contactId: await findContactByEmail(apiKey, email) }
    return { contactId: null, error: `POST retry ${retry.status}: ${retry.text?.slice(0, 200)}` }
  }

  return { contactId: null, error: `POST ${res.status}: ${res.text?.slice(0, 200)}` }
}

// ── Patch contact data ────────────────────────────────────────────────────────
async function patchContact(
  apiKey: string,
  contactId: string,
  firstName: string,
  lastName: string,
  phone?: string
): Promise<void> {
  // При PATCH: firstName/lastName са top-level, phoneNumber е в fields[]
  const fields: { slug: string; value: string | null }[] = []
  if (phone) {
    fields.push({ slug: 'phone_number', value: phone })
  }

  const body: Record<string, unknown> = {}
  if (firstName) body.firstName = firstName
  if (lastName)  body.lastName  = lastName
  if (fields.length > 0) body.fields = fields

  if (Object.keys(body).length === 0) return

  await sioFetch(
    apiKey, 'PATCH',
    `/api/contacts/${contactId}`,
    body,
    'application/merge-patch+json'
  )
}

// ── Add tag ───────────────────────────────────────────────────────────────────
async function addTag(apiKey: string, contactId: string, tagName: string): Promise<void> {
  const res = await sioFetch(apiKey, 'POST', `/api/contacts/${contactId}/tags`, { name: tagName })
  // 409 = вече има тага → ок
  if (!res.ok && res.status !== 409) {
    console.warn(`[Systeme.io] addTag failed ${res.status}:`, res.text?.slice(0, 200))
  }
}

// ── Main sync function ────────────────────────────────────────────────────────
export async function syncContact(params: {
  apiKey:    string
  email:     string
  name?:     string | null
  phone?:    string | null
  contactId?: string | null
  tag?:      string
}): Promise<{ ok: boolean; contactId?: string; error?: string }> {
  const { apiKey, email, tag = 'naruchnik' } = params
  const { firstName, lastName }              = splitName(params.name)
  const phone                                = formatPhone(params.phone)

  let contactId: string | null = params.contactId || null

  // 1. Проверяваме дали съществуващият ID е валиден
  if (contactId) {
    const check = await sioFetch(apiKey, 'GET', `/api/contacts/${contactId}`)
    if (!check.ok) {
      if (check.status === 404) contactId = null // изтрит → пресъздаваме
      else return { ok: false, error: `GET ${check.status}: ${check.text?.slice(0, 150)}` }
    }
  }

  // 2. Създаваме или намираме контакта
  if (!contactId) {
    const result = await ensureContact(apiKey, email, firstName, lastName, phone)
    if (result.error) return { ok: false, error: result.error }
    contactId = result.contactId
  }

  if (!contactId) {
    // Контактът е в Systeme.io но не можем да вземем ID — не е критично
    console.warn('[Systeme.io] Контактът е там но ID не е взет за:', email)
    return { ok: true }
  }

  // 3. PATCH данните (за да обновим имена/телефон при повторен sync)
  await sleep(400) // Systeme.io понякога е бавен след POST
  await patchContact(apiKey, contactId, firstName, lastName, phone)

  // 4. Добавяме таг
  await sleep(200)
  await addTag(apiKey, contactId, tag)

  return { ok: true, contactId }
}

// ── Sync with retry ───────────────────────────────────────────────────────────
export async function syncContactWithRetry(
  params: Parameters<typeof syncContact>[0],
  retries = 2
): Promise<{ ok: boolean; contactId?: string; error?: string }> {
  for (let i = 0; i <= retries; i++) {
    const result = await syncContact(params)
    if (result.ok) return result
    if (i < retries) {
      console.warn(`[Systeme.io] Retry ${i + 1} for ${params.email}:`, result.error)
      await sleep(800 * (i + 1))
    }
  }
  return { ok: false, error: 'Max retries exceeded' }
}
