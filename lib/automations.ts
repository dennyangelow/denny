// lib/automations.ts — v10
//
// ПОПРАВКИ v10 (спрямо v9) — логика на "Изоставена поръчка":
//   ✅ Тригерът order_placed вече хваща поръчки със статус 'shipped'
//      (изпратена), чийто shipped_at е по-стар от 24ч и които още не са
//      'delivered'. Поръчки в 'new'/'confirmed' НЕ задействат нищо — при
//      ръчно изпращане не се знае кога ще тръгнат, а клиентът още няма
//      пратка за получаване. (Вътрешното име order_placed е запазено, за да
//      не трябва SQL миграция; в админа е преименувано.)
//   ✅ С 2 стъпки (стъпка 1: 0 дни, стъпка 2: +1 ден) = напомняне на 24-ия и
//      на 48-ия час след изпращането. Guard-ът преди всяко писмо проверява
//      на живо, че поръчката още е 'shipped' — щом е маркирана 'delivered'
//      (или отказана), серията спира.
//   ✅ Не се пипат пратки, изпратени преди повече от 7 дни (защита, ако
//      забравиш да маркираш 'delivered' — да не тръгнат закъснели писма).
//   ✅ enrollPoll(): enrollment-ът е уникален по (workflow, lead), затова
//      досега един клиент можеше да получи автоматизацията само веднъж
//      завинаги (втора поръчка/количка — нищо). Сега, ако записът е НОВ
//      (друг order_id/cart_id) и предишният enrollment е приключил, той се
//      рестартира с новия контекст. Същият запис никога не се праща два пъти.
//   ✅ В context за поръчката влизат tracking_number и courier
//      ({{tracking_number}}, {{courier}} в темплейтите).
//
// ПОПРАВКИ v9 (спрямо v8) — видимост "работи ли cron-ът?":
//   ✅ pollTriggers() вече връща колко кандидати е намерил (поръчки >24ч в
//      'new', колички >2ч) и колко НОВИ enrollment-а е създал.
//   ✅ processDueEnrollments() записва резултата на всяко пускане в
//      settings['automations_last_tick'] (JSON). Админ панелът (Автоматизации)
//      го показва: "последно пускане преди X мин, кандидати/пратени" —
//      веднага се вижда дали hourly cron-ът изобщо тика и защо дадена
//      автоматизация не праща (напр. няма нито една поръчка в 'new').
//
// ПРОМЕНИ спрямо v7:
//   ✅ recordFailure() вече прави exponential backoff вместо фиксирано
//      ~15 мин между опитите (което идваше случайно от LEASE_MINUTES,
//      не беше замислено като retry интервал): опит 1 → +15 мин,
//      опит 2 → +60 мин, опит 3 (последен) → дава отказ.
//      Логиката зад това: ако SES временно трепне (напр. rate limit за
//      секунда), 15 мин стигат. Ако проблемът е по-сериозен (невалиден
//      темплейт, грешка в данните), по-дългата пауза намалява шанса
//      три опита да се изгърмят един след друг напразно.
//   ✅ Когато enrollment-ът СЕ ОТКАЗВА (3-ти неуспешен опит), last_error
//      вече започва с "[DEAD-LETTER] " — лесно разпознаваем маркер.
//      Email Stats таб-ът вече показва тези грешки (sampleErrors), но
//      досега бяха смесени с обичайни "излизания" (lead отписан, купил
//      е междувременно) — сега се различават на пръв поглед, а и можеш
//      да филтрираш в Supabase с `last_error LIKE '[DEAD-LETTER]%'`.
//   ✅ НОВО: app/api/admin/automations/retry-failed/route.ts (отделен
//      файл) — POST { enrollment_id } връща dead-letter enrollment
//      обратно в 'active' (attempts=0, next_run_at=сега), за ръчен
//      повторен опит от админ панела, след като си оправил проблема
//      (напр. добавил липсващ темплейт).
//
// Всичко останало е непроменено спрямо v7 — пълната история на
// промените v1→v7 е описана там.

import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail } from '@/lib/mailer'
import { buildCustomEmail } from '@/lib/email-templates'

/** delay_days + delay_hours → общо милисекунди. Единна формула, ползвана навсякъде. */
function delayMs(delayDays: number | null | undefined, delayHours: number | null | undefined): number {
  return ((Number(delayDays) || 0) * 24 + (Number(delayHours) || 0)) * 3600000
}

interface EnrollmentRow {
  id: string
  workflow_id: string
  lead_id: string
  current_step: number
  attempts: number
  // ✅ context носи каквото template-ът/guard-ът за тази стъпка се нуждае:
  //    { naruchnik_slug } за изтегляне, { order_id, tracking_number, courier } за order_placed,
  //    { cart_id, items, total } за cart_abandoned.
  context: Record<string, any>
  created_at: string
  leads?: { email: string; name?: string | null; subscribed?: boolean | null; tags?: string[] | null } | null
}

interface LeadOrderStats {
  order_count: number
  last_order_at: string | null
  total_spent: number
  products_bought: string[]
}

async function getLeadOrderStats(email: string): Promise<LeadOrderStats | null> {
  const { data } = await supabaseAdmin
    .from('lead_order_stats').select('*').eq('email', email.toLowerCase()).maybeSingle()
  return data as LeadOrderStats | null
}

interface PollStats { staleOrders: number; staleCarts: number; newEnrollments: number }

const MAX_SEND_ATTEMPTS = 3
const LEASE_MINUTES     = 15   // колко "заключваме" enrollment-а, докато го обработваме
const TICK_BATCH        = 30

// ✅ v8 — exponential backoff за retry между неуспешни опити за изпращане.
// Индекс = attempts-1 (1-ви неуспешен опит → BACKOFF_MINUTES[0], и т.н.).
// Последният елемент не се ползва реално (при attempts >= MAX_SEND_ATTEMPTS
// вече се отказваме), но е там за безопасност ако MAX_SEND_ATTEMPTS порасне.
const BACKOFF_MINUTES = [15, 60, 240]

// ✅ v10 — пратки, изпратени преди повече от толкова дни, не се пипат от тригера.
const SHIPPED_MAX_AGE_DAYS = 7

/** Записва lead-а във всички АКТИВНИ workflows от даден trigger_type (само НОВИ enrollments се връщат). */
export async function enrollLead(
  triggerType: string,
  leadId: string,
  context: Record<string, any> = {}
): Promise<string[]> {
  const { data: workflows } = await supabaseAdmin
    .from('workflows').select('id').eq('trigger_type', triggerType).eq('active', true)

  const newlyEnrolled: string[] = []
  for (const wf of workflows || []) {
    // delay на първата стъпка → кога е дължима (0 = веднага)
    const { data: first } = await supabaseAdmin
      .from('workflow_steps').select('delay_days, delay_hours')
      .eq('workflow_id', wf.id).eq('step_number', 1).eq('active', true).maybeSingle()

    // ignoreDuplicates + .select(): само наистина новосъздаден ред се връща
    const { data, error } = await supabaseAdmin.from('workflow_enrollments')
      .upsert(
        {
          workflow_id:  wf.id,
          lead_id:      leadId,
          current_step: 0,
          next_run_at:  new Date(Date.now() + delayMs(first?.delay_days, first?.delay_hours)).toISOString(),
          status:       'active',
          context,
        },
        { onConflict: 'workflow_id,lead_id', ignoreDuplicates: true }
      )
      .select('id')

    if (!error && data && data.length > 0) newlyEnrolled.push(wf.id)
  }
  return newlyEnrolled
}

/**
 * ✅ v10 — enrollLead() за poll тригерите (поръчка/количка).
 * enrollLead() пропуска вече съществуващ (workflow_id, lead_id), т.е. клиент,
 * минал веднъж през автоматизацията, не влизаше в нея повече. Тук:
 *   • няма enrollment → нов (през enrollLead);
 *   • има за СЪЩИЯ запис (order_id/cart_id) → пропуска (вече е обработен);
 *   • има за друг запис, но още върви → пропуска (изчакваме да приключи);
 *   • има за друг запис и е приключил → рестартира се с новия контекст.
 * Връща броя нови/рестартирани enrollments.
 */
async function enrollPoll(
  triggerType: string,
  leadId: string,
  context: Record<string, any>,
  keyField: 'order_id' | 'cart_id'
): Promise<number> {
  const fresh = new Set(await enrollLead(triggerType, leadId, context))
  let count = fresh.size

  const { data: workflows } = await supabaseAdmin
    .from('workflows').select('id').eq('trigger_type', triggerType).eq('active', true)

  for (const wf of workflows || []) {
    if (fresh.has(wf.id)) continue
    const { data: existing } = await supabaseAdmin
      .from('workflow_enrollments').select('id, status, context')
      .eq('workflow_id', wf.id).eq('lead_id', leadId).maybeSingle()
    if (!existing) continue
    if (existing.context?.[keyField] === context[keyField]) continue
    if (existing.status === 'active') continue

    const { data: first } = await supabaseAdmin
      .from('workflow_steps').select('delay_days, delay_hours')
      .eq('workflow_id', wf.id).eq('step_number', 1).eq('active', true).maybeSingle()

    const { error } = await supabaseAdmin.from('workflow_enrollments').update({
      current_step: 0,
      attempts:     0,
      last_error:   null,
      status:       'active',
      context,
      next_run_at:  new Date(Date.now() + delayMs(first?.delay_days, first?.delay_hours)).toISOString(),
      updated_at:   new Date().toISOString(),
    }).eq('id', existing.id)
    if (!error) count++
  }
  return count
}

/**
 * Poll тригерите (cart_abandoned/order_placed) нямат "лийд, който попълни
 * форма" — имат клиентски имейл на поръчка/количка. Намираме съществуващ
 * lead по email, или създаваме нов (source: 'order'/'cart') — така цялата
 * ти аудитория остава В ЕДНА таблица (`leads`), не фрагментирана.
 */
async function findOrCreateLead(email: string, name: string | null, source: string): Promise<string | null> {
  const cleanEmail = email.toLowerCase().trim()
  const { data: existing } = await supabaseAdmin
    .from('leads').select('id').eq('email', cleanEmail).maybeSingle()
  if (existing) return existing.id

  const { data: created, error } = await supabaseAdmin
    .from('leads')
    .insert({ email: cleanEmail, name, source, subscribed: true, created_at: new Date().toISOString() })
    .select('id').single()
  if (error) { console.error('[automations] findOrCreateLead:', error.message); return null }
  return created?.id ?? null
}

/**
 * Сканира orders/abandoned_carts за НОВОквалифицирали се записи и ги
 * записва в подходящите активни workflows. Вика се веднъж В НАЧАЛОТО на
 * всеки tick (виж processDueEnrollments) — след това нормалната
 * enrollLead()/runStep() машинария поема нататък. Идемпотентно е по
 * дизайн: enrollLead() пропуска вече съществуващ (workflow_id, lead_id).
 */
async function pollTriggers(): Promise<PollStats> {
  const stats: PollStats = { staleOrders: 0, staleCarts: 0, newEnrollments: 0 }
  // ── Изпратени поръчки, които още не са доставени >24ч ──────────────
  //    (ръчен процес: 'new'/'confirmed' не задействат нищо — виж v10)
  const shippedCutoff = new Date(Date.now() - 24 * 3600000).toISOString()
  const shippedLimit  = new Date(Date.now() - SHIPPED_MAX_AGE_DAYS * 24 * 3600000).toISOString()
  const { data: staleOrders } = await supabaseAdmin
    .from('orders')
    .select('id, customer_email, customer_name, order_number, total, tracking_number, courier, order_items(product_name, quantity)')
    .eq('status', 'shipped')
    .not('shipped_at', 'is', null)
    .lt('shipped_at', shippedCutoff)
    .gt('shipped_at', shippedLimit)
    .not('customer_email', 'is', null)
    .limit(100)

  stats.staleOrders = (staleOrders || []).length
  for (const o of staleOrders || []) {
    if (!o.customer_email) continue
    const leadId = await findOrCreateLead(o.customer_email, o.customer_name || null, 'order')
    if (!leadId) continue
    stats.newEnrollments += await enrollPoll('order_placed', leadId, {
      order_id: o.id, order_number: o.order_number, total: o.total,
      tracking_number: o.tracking_number || '', courier: o.courier || '',
      items: (o as any).order_items || [],
    }, 'order_id')
  }

  // ── Колички, недокоснати >2ч, все още неконвертирани, без вече пратен reminder ──
  const cartCutoff = new Date(Date.now() - 2 * 3600000).toISOString()
  const { data: staleCarts } = await supabaseAdmin
    .from('abandoned_carts')
    .select('id, email, name, items, total')
    .eq('converted', false)
    .is('reminded_at', null)
    .lt('updated_at', cartCutoff)
    .not('email', 'is', null)
    .limit(100)

  stats.staleCarts = (staleCarts || []).length
  for (const c of staleCarts || []) {
    if (!c.email) continue
    const leadId = await findOrCreateLead(c.email, c.name || null, 'cart')
    if (!leadId) continue
    stats.newEnrollments += await enrollPoll('cart_abandoned', leadId, { cart_id: c.id, items: c.items, total: c.total }, 'cart_id')
  }
  return stats
}

/** Атомарно "заключване": само един изпълнител може да вземе дължимия enrollment. */
async function claim(enr: EnrollmentRow): Promise<boolean> {
  const now   = new Date()
  const lease = new Date(now.getTime() + LEASE_MINUTES * 60000).toISOString()
  const { data } = await supabaseAdmin
    .from('workflow_enrollments')
    .update({ next_run_at: lease })
    .eq('id', enr.id)
    .eq('current_step', enr.current_step)
    .eq('status', 'active')
    .lte('next_run_at', now.toISOString())
    .select('id')
  return !!data && data.length > 0
}

// ✅ v8 — exponential backoff + ясен [DEAD-LETTER] маркер при окончателен отказ.
async function recordFailure(enr: EnrollmentRow, message: string): Promise<string> {
  const attempts = (enr.attempts || 0) + 1
  const giveUp   = attempts >= MAX_SEND_ATTEMPTS
  const backoffMinutes = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)]

  const updates: Record<string, any> = {
    attempts,
    last_error: (giveUp ? '[DEAD-LETTER] ' : '') + message.slice(0, 480),
    status:     giveUp ? 'exited' : 'active',
    updated_at: new Date().toISOString(),
  }
  // При отказ next_run_at е без значение (status вече не е 'active' и tick-ът
  // го подминава) — пипаме го само докато все още се очаква следващ опит.
  if (!giveUp) updates.next_run_at = new Date(Date.now() + backoffMinutes * 60000).toISOString()

  await supabaseAdmin.from('workflow_enrollments').update(updates).eq('id', enr.id)

  return giveUp
    ? `опит ${attempts}/${MAX_SEND_ATTEMPTS}, отказано (dead-letter): ${message}`
    : `опит ${attempts}/${MAX_SEND_ATTEMPTS}, следващ опит след ${backoffMinutes} мин: ${message}`
}

interface StepConditions {
  require_tag?: string
  exclude_tag?: string
  min_days_since_last_order?: number
  has_bought_product?: string          // substring match (case-insensitive) в product_name
  total_spent_gte?: number
  require_opened_previous_step?: boolean
  require_clicked_previous_step?: boolean
  skip_if_purchased_since_enrollment?: boolean
}

/**
 * Оценява conditions (jsonb на стъпката) срещу текущото състояние на лийда.
 * - 'exit'  → цялата автоматизация спира (целта е постигната/вече неактуална)
 * - 'skip'  → тази стъпка не се праща, но enrollment-ът продължава напред
 * - 'send'  → всички условия са изпълнени, пращаме
 */
async function checkConditions(
  step: { conditions?: StepConditions | null; step_number: number; workflow_id: string },
  enr: EnrollmentRow
): Promise<{ action: 'send' | 'skip' | 'exit'; reason?: string }> {
  const c = step.conditions || {}
  if (Object.keys(c).length === 0) return { action: 'send' }

  const email = enr.leads?.email
  const tags  = enr.leads?.tags || []

  // ✅ Излизаща проверка първо — ако клиентът вече е купил след enrollment-а,
  // целта на цялата серия е постигната, спираме я напълно.
  if (c.skip_if_purchased_since_enrollment && email) {
    const stats = await getLeadOrderStats(email)
    if (stats?.last_order_at && new Date(stats.last_order_at) > new Date(enr.created_at)) {
      return { action: 'exit', reason: 'купил е междувременно — целта е постигната' }
    }
  }

  if (c.require_tag && !tags.includes(c.require_tag)) {
    return { action: 'skip', reason: `няма таг "${c.require_tag}"` }
  }
  if (c.exclude_tag && tags.includes(c.exclude_tag)) {
    return { action: 'skip', reason: `има изключващ таг "${c.exclude_tag}"` }
  }

  if ((c.min_days_since_last_order || c.has_bought_product || c.total_spent_gte) && email) {
    const stats = await getLeadOrderStats(email)
    if (c.min_days_since_last_order) {
      const lastOrder = stats?.last_order_at ? new Date(stats.last_order_at) : null
      const daysSince = lastOrder ? (Date.now() - lastOrder.getTime()) / 86400000 : Infinity
      if (daysSince < c.min_days_since_last_order) {
        return { action: 'skip', reason: `последна поръчка преди < ${c.min_days_since_last_order} дни` }
      }
    }
    if (c.has_bought_product) {
      const needle = c.has_bought_product.toLowerCase()
      const bought = (stats?.products_bought || []).some(p => p.toLowerCase().includes(needle))
      if (!bought) return { action: 'skip', reason: `не е купувал "${c.has_bought_product}"` }
    }
    if (c.total_spent_gte && (stats?.total_spent || 0) < c.total_spent_gte) {
      return { action: 'skip', reason: `похарчено < ${c.total_spent_gte}` }
    }
  }

  if (c.require_opened_previous_step || c.require_clicked_previous_step) {
    const { data: prevLog } = await supabaseAdmin
      .from('email_logs').select('opened_at, clicked_at')
      .eq('lead_id', enr.lead_id)
      .eq('sequence_name', `workflow:${step.workflow_id}`)
      .eq('step_number', step.step_number - 1)
      .maybeSingle()
    if (c.require_opened_previous_step && !prevLog?.opened_at) {
      return { action: 'skip', reason: 'предходното писмо не е отворено' }
    }
    if (c.require_clicked_previous_step && !prevLog?.clicked_at) {
      return { action: 'skip', reason: 'няма клик в предходното писмо' }
    }
  }

  return { action: 'send' }
}

async function runStep(enr: EnrollmentRow): Promise<{ sent: boolean; error?: string }> {
  if (!(await claim(enr))) return { sent: false }   // друг изпълнител го държи / още не е дължим

  const nextStepNumber = enr.current_step + 1
  const now = new Date().toISOString()

  const { data: step } = await supabaseAdmin
    .from('workflow_steps').select('*')
    .eq('workflow_id', enr.workflow_id).eq('step_number', nextStepNumber).eq('active', true)
    .maybeSingle()

  if (!step) {
    await supabaseAdmin.from('workflow_enrollments')
      .update({ status: 'completed', updated_at: now }).eq('id', enr.id)
    return { sent: false }
  }

  const email = enr.leads?.email
  if (!email) {
    await supabaseAdmin.from('workflow_enrollments')
      .update({ status: 'exited', last_error: 'lead без email', updated_at: now }).eq('id', enr.id)
    return { sent: false, error: 'lead без email' }
  }

  // ✅ Отписан / bounce / complaint → излизаме, не пращаме нищо повече
  if (enr.leads?.subscribed === false) {
    await supabaseAdmin.from('workflow_enrollments')
      .update({ status: 'exited', last_error: 'lead отписан', updated_at: now }).eq('id', enr.id)
    return { sent: false }
  }

  // ✅ guard за poll тригерите — проверяваме ЖИВО дали условието още важи,
  //    точно преди да пратим. Enrollment-ът може да е стар с часове; ако
  //    поръчката вече е потвърдена / количката вече е конвертирана
  //    междувременно, спираме — не пращаме "довърши поръчката" на човек,
  //    който вече е платил.
  if (enr.context?.order_id) {
    const { data: order } = await supabaseAdmin
      .from('orders').select('status').eq('id', enr.context.order_id).maybeSingle()
    if (!order || order.status !== 'shipped') {
      await supabaseAdmin.from('workflow_enrollments')
        .update({ status: 'exited', last_error: 'поръчката вече не е "shipped" (доставена/отказана)', updated_at: now }).eq('id', enr.id)
      return { sent: false }
    }
  }
  if (enr.context?.cart_id) {
    const { data: cart } = await supabaseAdmin
      .from('abandoned_carts').select('converted').eq('id', enr.context.cart_id).maybeSingle()
    if (!cart || cart.converted) {
      await supabaseAdmin.from('workflow_enrollments')
        .update({ status: 'exited', last_error: 'количката вече е конвертирана', updated_at: now }).eq('id', enr.id)
      return { sent: false }
    }
  }

  // ✅ условия на стъпката (conditions jsonb). 'exit' спира ЦЯЛАТА
  // автоматизация, 'skip' напредва без да праща тази стъпка.
  const verdict = await checkConditions(step, enr)
  if (verdict.action === 'exit') {
    await supabaseAdmin.from('workflow_enrollments')
      .update({ status: 'exited', last_error: verdict.reason || null, updated_at: now }).eq('id', enr.id)
    return { sent: false }
  }
  if (verdict.action === 'skip') {
    const { data: afterSkip } = await supabaseAdmin
      .from('workflow_steps').select('delay_days, delay_hours')
      .eq('workflow_id', enr.workflow_id).eq('step_number', nextStepNumber + 1).eq('active', true)
      .maybeSingle()
    await supabaseAdmin.from('workflow_enrollments').update({
      current_step: nextStepNumber,
      next_run_at:  afterSkip ? new Date(Date.now() + delayMs(afterSkip.delay_days, afterSkip.delay_hours)).toISOString() : now,
      status:       afterSkip ? 'active' : 'completed',
      last_error:   `прескочена стъпка ${nextStepNumber}: ${verdict.reason || ''}`.trim(),
      updated_at:   now,
    }).eq('id', enr.id)
    return { sent: false }
  }

  // ✅ ВИНАГИ от базата (email_templates), никакъв код fallback повече.
  // Библиотеката е единственият източник на съдържание.
  const { data: tpl } = await supabaseAdmin
    .from('email_templates')
    .select('subject, body_html')
    .eq('template_key', step.template_key)
    .maybeSingle()

  if (!tpl?.subject || !tpl?.body_html) {
    return { sent: false, error: await recordFailure(enr, `темплейт "${step.template_key}" липсва в библиотеката`) }
  }

  const { subject, html } = await buildCustomEmail({
    subjectTemplate:  tpl.subject,
    bodyHtmlTemplate: tpl.body_html,
    email,
    name: enr.leads?.name || undefined,
    slug: enr.context?.naruchnik_slug,
    context: enr.context,
  })

  // ✅ messageId се пази в email_logs.ses_message_id по-долу, за да може
  // webhook-ът (Open/Click) да мачва ТОЧНО това писмо, не "последното".
  let messageId: string | undefined
  try {
    const result = await sendEmail({ to: email, subject, html })
    messageId = result.messageId
  } catch (sendErr: any) {
    return { sent: false, error: await recordFailure(enr, `sendEmail: ${sendErr?.message || sendErr}`) }
  }

  await supabaseAdmin.from('email_logs').insert({
    lead_id:        enr.lead_id,
    sequence_name:  `workflow:${enr.workflow_id}`,
    step_number:    step.step_number,
    sent_at:        now,
    ses_message_id: messageId || null,
  })
  await supabaseAdmin.from('leads').update({ last_email_sent_at: now }).eq('id', enr.lead_id)

  // abandoned_carts.reminded_at се маркира "пратено" тук, симетрично на
  // /api/carts/track, което нулира полето при всяко редактиране на количката.
  if (enr.context?.cart_id) {
    await supabaseAdmin.from('abandoned_carts')
      .update({ reminded_at: now }).eq('id', enr.context.cart_id)
  }

  const { data: nextStep } = await supabaseAdmin
    .from('workflow_steps').select('delay_days, delay_hours')
    .eq('workflow_id', enr.workflow_id).eq('step_number', nextStepNumber + 1).eq('active', true)
    .maybeSingle()

  await supabaseAdmin.from('workflow_enrollments').update({
    current_step: nextStepNumber,
    next_run_at:  nextStep ? new Date(Date.now() + delayMs(nextStep.delay_days, nextStep.delay_hours)).toISOString() : now,
    status:       nextStep ? 'active' : 'completed',
    attempts:     0,
    last_error:   null,
    updated_at:   now,
  }).eq('id', enr.id)

  return { sent: true }
}

/** Записва lead-а и веднага изпраща стъпка 1 (ако е с delay 0) — за "човекът чака СЕГА" тригери. */
export async function enrollAndRunFirstStep(
  triggerType: string,
  leadId: string,
  context: Record<string, any> = {}
): Promise<void> {
  const workflowIds = await enrollLead(triggerType, leadId, context)
  if (workflowIds.length === 0) return

  const { data: enrollments } = await supabaseAdmin
    .from('workflow_enrollments')
    .select('*, leads(email, name, subscribed, tags)')
    .eq('lead_id', leadId).in('workflow_id', workflowIds).eq('status', 'active')

  for (const enr of (enrollments || []) as EnrollmentRow[]) {
    try { await runStep(enr) }   // claim() сам пропуска стъпки с бъдещ next_run_at
    catch (err: any) { console.error('[automations] enrollAndRunFirstStep:', err.message) }
  }
}

/** Hourly tick — обработва дължимите enrollments (всички тригер типове). */
export async function processDueEnrollments(
  limit = TICK_BATCH
): Promise<{ processed: number; sent: number; errors: string[]; poll: PollStats }> {
  const errors: string[] = []
  let sent = 0
  let poll: PollStats = { staleOrders: 0, staleCarts: 0, newEnrollments: 0 }

  // ✅ едно сканиране на orders/abandoned_carts преди обичайната опашка от
  //    дължими стъпки — вижте pollTriggers() по-горе.
  try {
    poll = await pollTriggers()
  } catch (e: any) {
    errors.push(`pollTriggers: ${e.message}`)
  }

  const { data: due } = await supabaseAdmin
    .from('workflow_enrollments')
    .select('*, leads(email, name, subscribed, tags)')
    .eq('status', 'active')
    .lte('next_run_at', new Date().toISOString())
    .order('next_run_at', { ascending: true })
    .limit(limit)

  for (const enr of (due || []) as EnrollmentRow[]) {
    try {
      const result = await runStep(enr)
      if (result.sent) sent++
      if (result.error) errors.push(`enrollment ${enr.id}: ${result.error}`)
      await new Promise(r => setTimeout(r, 150))   // SES rate limit
    } catch (e: any) {
      errors.push(`enrollment ${enr.id}: ${e.message}`)
    }
  }

  // ✅ v9 — следа за "cron-ът тика ли?" (best-effort, никога не гърми tick-а)
  try {
    await supabaseAdmin.from('settings').upsert(
      {
        key: 'automations_last_tick',
        value: JSON.stringify({
          at: new Date().toISOString(), processed: (due || []).length, sent,
          errors: errors.length, firstError: errors[0] || null, poll,
        }),
      },
      { onConflict: 'key' }
    )
  } catch (e: any) {
    console.error('[automations] last_tick write:', e?.message)
  }

  return { processed: (due || []).length, sent, errors, poll }
}
