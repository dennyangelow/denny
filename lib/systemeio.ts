// lib/systemeio.ts — v6 FIXED
//
// Промени спрямо v5:
//   - addTag: Systeme.io изисква tagId (число), НЕ { name } директно към contacts/{id}/tags
//     Правилният flow: POST /api/tags { name } → взимаме { id } → POST /api/contacts/{id}/tags { tagId }
//   - tagId се кешира в паметта за да не се прави POST /api/tags при всяка синхронизация
//   - Rate limit: sleep между операции е увеличен

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Tag ID cache (in-memory, per process) ─────────────────────────────────────
const tagIdCache: Record<string, number> = {}

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

function isDuplicateEmail(status: number, data: any): boolean {
  if (status === 409) return true
  if (status !== 422) return false
  const detail: string = data?.detail || data?.violations?.[0]?.message || ''
  return (
    detail.toLowerCase().includes('already used') ||
    detail.toLowerCase().includes('already exists')
  )
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

  const isDuplicate = isDuplicateEmail(res.status, data)
  if (!res.ok && !isDuplicate && res.status !== 429) {
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
async function getOrCreateTagId(apiKey: string, tagName: string): Promise<number | null> {
  // 1. Проверяваме кеша
  if (tagIdCache[tagName]) return tagIdCache[tagName]

  // 2. Опитваме да създадем тага
  const createRes = await sioFetch(apiKey, 'POST', '/api/tags', { name: tagName })

  if (createRes.ok && createRes.data?.id) {
    tagIdCache[tagName] = Number(createRes.data.id)
    return tagIdCache[tagName]
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
  }

  if (createRes.status === 429) {
    await sleep(5000)
    const retry = await sioFetch(apiKey, 'POST', '/api/tags', { name: tagName })
    if (retry.ok && retry.data?.id) {
      tagIdCache[tagName] = Number(retry.data.id)
      return tagIdCache[tagName]
    }
  }

  console.warn(`[Systeme.io] Не можем да вземем tagId за "${tagName}"`)
  return null
}

// ── Create OR find contact ────────────────────────────────────────────────────
async function ensureContact(
  apiKey: string,
  email: string,
  firstName: string,
  lastName: string,
  phone?: string
): Promise<{ contactId: string | null; error?: string }> {
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

  if (res.status === 422) {
    const detail = res.data?.detail || res.data?.violations?.[0]?.message || res.text?.slice(0, 200)
    return { contactId: null, error: `422: ${detail}` }
  }

  if (res.status === 429) {
    console.warn('[Systeme.io] Rate limit при POST /api/contacts — изчакваме 5 сек...')
    await sleep(5000)
    const retry = await sioFetch(apiKey, 'POST', '/api/contacts', postBody)
    if (retry.ok)                                   return { contactId: String(retry.data?.id) }
    if (isDuplicateEmail(retry.status, retry.data)) {
      await sleep(500)
      return { contactId: await findContactByEmail(apiKey, email) }
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

// ── Add tag (правилен начин: POST /api/tags → id → POST contacts/{id}/tags { tagId }) ──
async function addTag(apiKey: string, contactId: string, tagName: string): Promise<void> {
  const tagId = await getOrCreateTagId(apiKey, tagName)
  if (!tagId) {
    console.warn(`[Systeme.io] Пропускаме тага "${tagName}" — не можем да вземем ID`)
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
}): Promise<{ ok: boolean; contactId?: string; error?: string }> {
  const { apiKey, email, tag = 'naruchnik' } = params
  const { firstName, lastName }              = splitName(params.name)
  const phone                                = formatPhone(params.phone)

  let contactId: string | null = params.contactId || null

  // 1. Проверяваме дали съществуващият ID е валиден
  if (contactId) {
    const check = await getContactById(apiKey, contactId)
    if (!check.ok) {
      if (check.notFound) {
        contactId = null
      } else {
        console.warn(`[Systeme.io] GET contact ${contactId} → ${check.status}, продължаваме`)
        contactId = null
      }
    }
  }

  // 2. Създаваме или намираме контакта
  if (!contactId) {
    const result = await ensureContact(apiKey, email, firstName, lastName, phone)
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

  // 4. Добавяме таг
  await sleep(300)
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
      await sleep(1000 * (i + 1))
    }
  }
  return { ok: false, error: 'Max retries exceeded' }
}
