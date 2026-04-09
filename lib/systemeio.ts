// lib/systemeio.ts — v19
//
// ═══════════════════════════════════════════════════════════════
//  ОПРАВЕН БАГ В v11:
//
//  ❌ v10 BUG: GET /api/tags?limit=200 → 422 грешка!
//     Systeme.io приема limit само 10–100.
//     Резултат: tagId = null → тагът "naruchnik" НИКОГА не се слагаше!
//
//  ✅ v19 FIX:
//     1. patchContactDirect: само 1 PATCH заявка (не 2)
//        fields[] не се записва с merge-patch → само при POST
//     2. Имена се подават само ако НЕ са empty string
//        (merge-patch с '' изтрива полето!)
//     3. При skip (няма данни) → директно ok → само таг
//
//  ЗАПАЗЕНО ОТ v11:
//  ✅ GET /api/tags пагинация по 100
//  ✅ phoneNumber е top-level поле
//  ✅ При 404 → findByEmail → create → PATCH
//  ✅ Rate limit handling с retry
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

// Детектира 422 "custom field slug does not exist" → игнорираме (полето не е в акаунта)
function isFieldSlugMissing(status: number, data: any): boolean {
  if (status !== 422) return false
  const violations: any[] = data?.violations || []
  return violations.some(
    (v: any) => (v?.propertyPath || '').startsWith('fields[') &&
                (v?.message || '').toLowerCase().includes('does not exist')
  )
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
    apiKey, 'GET', `/api/contacts?email=${encodeURIComponent(email)}&limit=10`
  )
  if (!ok || !data) return null
  const items = data.items || data['hydra:member'] || []
  const found = items.find((c: any) => c.email?.toLowerCase() === email.toLowerCase())
  return found?.id ? String(found.id) : null
}

// ── Create contact ────────────────────────────────────────────────────────────
async function createContact(
  apiKey:          string,
  email:           string,
  firstName:       string,
  lastName:        string,
  phone?:          string,
  naruchnikSlug?:  string
): Promise<{ contactId: string | null; error?: string; emailInvalid?: boolean }> {
  const body: Record<string, unknown> = { email, firstName, lastName }
  if (phone) body.phoneNumber = phone  // top-level поле
  if (naruchnikSlug) body.fields = [{ slug: 'naruchnici', value: naruchnikSlug }]  // custom field

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
// Systeme.io: PATCH изисква "application/merge-patch+json".
// ВАЖНО: firstName/lastName се записват само ако НЕ са empty string.
//        merge-patch с празен string изтрива полето.
//        Затова подаваме само непразните стойности.
// fields[] не се поддържа от merge-patch → custom field се записва
//        само при POST (createContact). При PATCH го пропускаме.
async function patchContactDirect(
  apiKey:          string,
  contactId:       string,
  firstName:       string,
  lastName:        string,
  phone?:          string,
  naruchnikSlug?:  string  // запазен за съвместимост, не се ползва в PATCH
): Promise<'ok' | 'notFound' | 'rateLimited' | 'error'> {

  const body: Record<string, unknown> = {}
  // Записваме само непразните стойности — merge-patch с '' изтрива полето
  if (firstName?.trim()) body.firstName   = firstName.trim()
  if (lastName?.trim())  body.lastName    = lastName.trim()
  if (phone)             body.phoneNumber = phone

  // Ако няма какво да обновяваме → skip (само тага ще се добави)
  if (Object.keys(body).length === 0) {
    console.info(`[Sio] PATCH skip за ${contactId} — няма данни за обновяване`)
    return 'ok'
  }

  const res = await sioFetch(
    apiKey, 'PATCH', `/api/contacts/${contactId}`,
    body, 'application/merge-patch+json'
  )

  if (res.ok)             return 'ok'
  if (res.status === 404) return 'notFound'
  if (res.status === 429) return 'rateLimited'
  if (isFieldSlugMissing(res.status, res.data)) return 'ok'  // safety net
  return 'error'
}

// ── Get tag ID (кеширано — само 1 GET за целия batch) ─────────────────────────
// FIX: Systeme.io приема limit само между 10 и 100 (не 200!)
// Затова пагинираме: взимаме по 100 докато намерим тага
async function getTagId(apiKey: string, tagName: string): Promise<number | null> {
  const key = tagName.toLowerCase()
  if (key in tagIdCache) return tagIdCache[key]

  // Пагинираме тагове по 100 (max допустим limit)
  let page = 1
  let found = false
  while (true) {
    const res = await sioFetch(apiKey, 'GET', `/api/tags?limit=100&page=${page}`)
    if (!res.ok) {
      if (isPlanLimit(res.status, res.data)) {
        console.info(`[Sio] Таг "${tagName}" — план лимит`)
        tagIdCache[key] = null
        return null
      }
      console.warn(`[Sio] GET /api/tags page=${page} → ${res.status}`)
      break
    }

    const items: any[] = res.data?.items || res.data?.['hydra:member'] || []
    for (const t of items) {
      if (t?.id && t?.name) {
        tagIdCache[t.name.toLowerCase()] = Number(t.id)
      }
    }

    if (key in tagIdCache) {
      found = true
      console.info(`[Sio] Таг "${tagName}" → ID ${tagIdCache[key]}`)
      break
    }

    // Проверяваме дали има следваща страница
    const total   = res.data?.total ?? res.data?.['hydra:totalItems'] ?? 0
    const hasMore = res.data?.hasMore === true || (page * 100 < total)
    if (!hasMore || items.length === 0) break
    page++
    await sleep(300)
  }

  if (!found) {
    // Тагът не съществува → създаваме го
    console.info(`[Sio] Тагът "${tagName}" не е намерен → създаваме`)
    const createRes = await sioFetch(apiKey, 'POST', '/api/tags', { name: tagName })
    if (createRes.ok && createRes.data?.id) {
      tagIdCache[key] = Number(createRes.data.id)
      console.info(`[Sio] Таг "${tagName}" създаден → ID ${tagIdCache[key]}`)
      return tagIdCache[key]
    }
    if (isPlanLimit(createRes.status, createRes.data)) {
      tagIdCache[key] = null
      return null
    }
    console.warn(`[Sio] Не можем да създадем таг "${tagName}": ${createRes.text?.slice(0, 200)}`)
    tagIdCache[key] = null
    return null
  }

  return tagIdCache[key] ?? null
}

// ── Add tag (само ако все още не е добавен) ───────────────────────────────────
async function addTag(apiKey: string, contactId: string, tagName: string): Promise<void> {
  // FIX: винаги използваме lowercase за кеша
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
  // 409 = вече има тага → нормално, не логваме
  if (!res.ok && res.status !== 409) {
    console.warn(`[Sio] addTag "${tagName}" (id=${tagId}) → ${res.status}: ${res.text?.slice(0, 200)}`)
  } else if (res.ok) {
    console.info(`[Sio] Таг "${tagName}" добавен към контакт ${contactId} ✅`)
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
  const slug  = params.naruchnikSlug || undefined

  console.info(`[Sio] syncContact START: ${email} | contactId=${params.contactId || 'none'} | name="${params.name || ''}"`)

  let contactId: string | null = params.contactId || null

  // ═══════════════════════════════════════════════════════════════
  // CASE A: Имаме contactId → опитваме PATCH директно
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
      // До 3 retry с нарастваща пауза
      for (let attempt = 1; attempt <= 3; attempt++) {
        const wait = 4000 * attempt
        console.info(`[Sio] Rate limited за ${email} — чакам ${wait}ms (опит ${attempt}/3)`)
        await sleep(wait)
        const rr = await patchContactDirect(apiKey, contactId, firstName, lastName, phone, slug)
        console.info(`[Sio] PATCH retry #${attempt} за ${email}: ${rr}`)
        if (rr === 'ok') {
          await sleep(300)
          await addTag(apiKey, contactId, tag)
          console.info(`[Sio] ✅ ${email} — PATCH ok след retry`)
          return { ok: true, contactId }
        }
        if (rr === 'notFound') { contactId = null; break }
        if (rr === 'error')    { return { ok: false, error: `PATCH error after rate limit for ${email}` } }
        // rr === 'rateLimited' → следваща итерация
      }
      if (contactId !== null) {
        console.warn(`[Sio] ❌ ${email} — rate limited след 3 опита`)
        return { ok: false, error: `PATCH rate limited for ${email}` }
      }
      // contactId = null → пада в CASE B по-долу
    }

    if (p1 === 'notFound') {
      console.info(`[Sio] contactId ${contactId} не е намерен → ще търсим по email`)
      contactId = null
      // пада в CASE B
    }

    if (p1 === 'error') {
      // Неочаквана грешка → опитваме findByEmail
      console.warn(`[Sio] PATCH error за ${email} → findByEmail`)
      const found = await findContactByEmail(apiKey, email)
      if (found) {
        console.info(`[Sio] Намерен по email: ${found}`)
        await sleep(300)
        await patchContactDirect(apiKey, found, firstName, lastName, phone, slug)
        await sleep(300)
        await addTag(apiKey, found, tag)
        console.info(`[Sio] ✅ ${email} — PATCH ok след findByEmail`)
        return { ok: true, contactId: found }
      }
      console.warn(`[Sio] ❌ ${email} — не е намерен по email след PATCH error`)
      return { ok: false, error: `PATCH error for ${email}` }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CASE B: Нямаме contactId → POST (create or find by 409)
  // ═══════════════════════════════════════════════════════════════
  console.info(`[Sio] POST /api/contacts за ${email}`)
  const created = await createContact(apiKey, email, firstName, lastName, phone, slug)

  if (created.emailInvalid) {
    console.info(`[Sio] ❌ ${email} — невалиден имейл`)
    return { ok: false, error: created.error, emailInvalid: true }
  }
  if (created.error) {
    console.warn(`[Sio] ❌ ${email} — createContact error: ${created.error}`)
    return { ok: false, error: created.error }
  }

  contactId = created.contactId
  if (!contactId) {
    console.warn(`[Sio] ❌ ${email} — няма contactId след create`)
    return { ok: false, error: 'No contact ID' }
  }

  console.info(`[Sio] contactId след create/find: ${contactId} → PATCH за имена`)
  // PATCH след create — записва имена, телефон, naruchnici
  // (при 409: POST не е записал нищо, PATCH обновява съществуващия)
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
