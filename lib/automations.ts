// lib/automations.ts — v7
//
// ПРОМЕНИ спрямо v6:
//   ✅ sendEmail() сега връща { messageId } (lib/mailer.ts v3 / lib/ses.ts
//      v4) — пазим го в email_logs.ses_message_id. Без това,
//      app/api/webhooks/ses/route.ts не може да различи кое ТОЧНО писмо е
//      било отворено/кликнато, когато lead-ът е получил няколко писма от
//      серията — досега винаги се ъпдейтваше "последният пратен" ред,
//      независимо кое реално е отворено.
//      ⚠️ Изисква SQL: ALTER TABLE email_logs ADD COLUMN ses_message_id text;
//      (виж миграцията, дадена отделно в чата). Без тази колона insert-ът
//      просто игнорира полето (Supabase не гърми на непозната колона в
//      .insert() само ако схемата вече я има — та трябва да пуснеш SQL-а
//      ПРЕДИ да качиш този файл).
//
// ПРОМЕНИ спрямо v5 — Мега план: пълна база-само темплейти + часове + условия:
//   ✅ ПРЕМАХНАТ TEMPLATE_REGISTRY fallback изцяло. Писмата ВИНАГИ идват от
//      email_templates таблицата (библиотека, редактируема от админ панела).
//      Няма вече "код по подразбиране" — 6-те стари темплейта се местят в
//      базата еднократно чрез SQL insert (виж migration-а, даден в чата).
//      Липсващ ред в email_templates за даден template_key = грешка,
//      записана през recordFailure() (стъпката не може да прати нищо).
//   ✅ НОВО: delay_hours — забавянето на стъпка вече е delay_days*24+delay_hours
//      часа, не само цели дни. Позволява "3 часа след" без да чакаш цял ден.
//   ✅ НОВО: conditions (jsonb на workflow_steps) — условия преди изпращане:
//      require_tag/exclude_tag (по lead.tags), min_days_since_last_order/
//      has_bought_product/total_spent_gte (по lead_order_stats изгледа —
//      виж SQL migration-а), require_opened_previous_step/
//      require_clicked_previous_step (по email_logs), и
//      skip_if_purchased_since_enrollment (излиза от ЦЯЛАТА автоматизация,
//      не само тази стъпка — целта е постигната, клиентът купи междувременно).
//      Условие, което не е изпълнено за "require_*" → стъпката се ПРЕСКАЧА
//      (напредва current_step без изпращане), не праща грешка.
//
// ПРОМЕНИ спрямо v3:
//   ✅ abandoned_carts.reminded_at вече СЕ пише след успешен cart-reminder
//      имейл (виж блока точно след email_logs insert-а по-долу) — преди
//      това не ставаше никъде, значи email-stats "Получили reminder"
//      винаги показваше 0 и pollTriggers() намираше същата количка отново
//      и отново на всеки tick (безвредно заради enrollLead() dedup-а, но
//      грешна статистика).
//
// ПРОМЕНИ спрямо v1 (открити при одит на реалните данни):
//   ✅ Engine-ът вече НЕ праща на отписани (leads.subscribed=false) — v1 изобщо
//      не проверяваше, значи след unsubscribe/bounce/complaint followup-ите
//      продължаваха (вреди на SES репутацията, нарушава отписването).
//   ✅ Непознат template_key вече се брои като неуспешен опит (преди се
//      опитваше вечно, всеки час — остатък от бъг №2).
//   ✅ Lease (claim) преди изпращане — синхронният първи опит и hourly tick-ът,
//      или два застъпили се tick-а, вече не могат да пратят една стъпка два пъти.
//   ✅ delay_days на СТЪПКА 1 вече се зачита (преди се игнорираше и се пращаше веднага).
//   ✅ leads.last_email_sent_at се обновява САМО след реално изпращане (преди
//      се слагаше безусловно при upsert → 2561/2561 лийда "получили имейл").
//   ✅ По-малък batch на tick (30) — Vercel функциите имат лимит за време.
//
// ПРОМЕНИ спрямо v2 (обединяване на двата cron-а в един):
//   ✅ НОВО: "poll" тригери — cart_abandoned/order_placed нямат дискретно
//      "случи се" събитие (за разлика от naruchnik_download), а условие,
//      което узрява с времето ("количка, недокосната >2ч"). pollTriggers()
//      сканира orders/abandoned_carts В НАЧАЛОТО на всеки tick, намира
//      новоквалифициралите се, upsert-ва lead по email (findOrCreateLead),
//      после нормалният enrollLead()/runStep() поема оттам нататък.
//      Резултат: ЕДИН cron (/api/automations/tick) покрива всичко.
//      app/api/leads/sequence/route.ts вече не е нужен — виж бележка накрая.
//   ✅ Guard преди изпращане: за order_placed/cart_abandoned проверяваме
//      ЖИВО дали поръчката/количката още е "недовършена" точно преди да
//      пратим — не само в момента на enrollment-а. Ако междувременно се е
//      потвърдила/конвертирала, enrollment излиза, вместо да продължи да
//      праща "довърши поръчката" на вече платил клиент.

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
  //    { naruchnik_slug } за изтегляне, { order_id } за order_placed,
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

const MAX_SEND_ATTEMPTS = 3
const LEASE_MINUTES     = 15   // колко "заключваме" enrollment-а, докато го обработваме
const TICK_BATCH        = 30

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
async function pollTriggers(): Promise<void> {
  // ── Поръчки, заседнали в 'new' >24ч ──────────────────────────────────
  const orderCutoff = new Date(Date.now() - 24 * 3600000).toISOString()
  const { data: staleOrders } = await supabaseAdmin
    .from('orders')
    .select('id, customer_email, customer_name, order_number, total, order_items(product_name, quantity)')
    .eq('status', 'new')
    .lt('created_at', orderCutoff)
    .not('customer_email', 'is', null)
    .limit(100)

  for (const o of staleOrders || []) {
    if (!o.customer_email) continue
    const leadId = await findOrCreateLead(o.customer_email, o.customer_name || null, 'order')
    if (!leadId) continue
    await enrollLead('order_placed', leadId, {
      order_id: o.id, order_number: o.order_number, total: o.total,
      items: (o as any).order_items || [],
    })
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

  for (const c of staleCarts || []) {
    if (!c.email) continue
    const leadId = await findOrCreateLead(c.email, c.name || null, 'cart')
    if (!leadId) continue
    await enrollLead('cart_abandoned', leadId, { cart_id: c.id, items: c.items, total: c.total })
  }
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

async function recordFailure(enr: EnrollmentRow, message: string): Promise<string> {
  const attempts = (enr.attempts || 0) + 1
  const giveUp   = attempts >= MAX_SEND_ATTEMPTS
  await supabaseAdmin.from('workflow_enrollments').update({
    attempts,
    last_error: message.slice(0, 500),
    status:     giveUp ? 'exited' : 'active',
    updated_at: new Date().toISOString(),
  }).eq('id', enr.id)
  // next_run_at остава = края на lease-а → следващ опит след ~15 мин, не веднага
  return `опит ${attempts}/${MAX_SEND_ATTEMPTS}${giveUp ? ', отказано' : ''}: ${message}`
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

  // ✅ НОВО: guard за poll тригерите — проверяваме ЖИВО дали условието още
  //    важи, точно преди да пратим. Enrollment-ът може да е стар с часове;
  //    ако поръчката вече е потвърдена / количката вече е конвертирана
  //    междувременно, спираме — не пращаме "довърши поръчката" на човек,
  //    който вече е платил.
  if (enr.context?.order_id) {
    const { data: order } = await supabaseAdmin
      .from('orders').select('status').eq('id', enr.context.order_id).maybeSingle()
    if (!order || order.status !== 'new') {
      await supabaseAdmin.from('workflow_enrollments')
        .update({ status: 'exited', last_error: 'поръчката вече не е "new"', updated_at: now }).eq('id', enr.id)
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

  // ✅ НОВО (v6) — условия на стъпката (conditions jsonb). 'exit' спира
  // ЦЯЛАТА автоматизация, 'skip' напредва без да праща тази стъпка.
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

  // ✅ v6 — ВИНАГИ от базата (email_templates), никакъв код fallback повече.
  // Библиотеката е единственият източник на съдържание — виж SQL migration-а
  // за еднократния пренос на старите 6 темплейта.
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

  // ✅ v7 — messageId се пази в email_logs.ses_message_id по-долу, за да
  // може webhook-ът (Open/Click) да мачва ТОЧНО това писмо, не "последното".
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

  // ✅ ФИКС: abandoned_carts.reminded_at никога не се пишеше оттук — значи
  //    email-stats "Получили reminder" статистиката винаги показваше 0, а
  //    pollTriggers() намираше същата количка отново и отново на всеки
  //    tick (безвредно благодарение на enrollLead() dedup-а, но излишно).
  //    /api/carts/track POST нарочно НУЛИРА reminded_at при всяко
  //    редактиране на количката (нов шанс за reminder) — тук е мястото,
  //    където то реално се маркира "пратено", симетрично на това.
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
): Promise<{ processed: number; sent: number; errors: string[] }> {
  const errors: string[] = []
  let sent = 0

  // ✅ НОВО: едно сканиране на orders/abandoned_carts преди обичайната
  //    опашка от дължими стъпки — вижте pollTriggers() по-горе.
  try {
    await pollTriggers()
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
  return { processed: (due || []).length, sent, errors }
}
