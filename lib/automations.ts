// lib/automations.ts — v3
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
//
// Фаза 1 умишлено НЕ пипа съдържанието на имейлите — TEMPLATE_REGISTRY сочи
// към email-templates.ts. Редактор на съдържание = Фаза 3.

import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail } from '@/lib/mailer'
import {
  welcomeEmail,
  followUp2Email,
  followUp5Email,
  followUp10Email,
  abandonedOrderEmail,
  abandonedCartEmail,
} from '@/lib/email-templates'

// ✅ ФИКС: връщан тип вече е Promise — welcomeEmail/followUp*/abandoned*
// станаха async (виж lib/email-templates.ts v2 — unsubscribe линкът сега
// носи подписан token, а изчисляването му е async).
type TemplateFn = (p: { email: string; name?: string; slug?: string; context?: Record<string, any> }) => Promise<{ subject: string; html: string }>

// ✅ Добавяй нов ред тук ВИНАГИ заедно с нов ред в AutomationsTab.tsx (TEMPLATE_OPTIONS).
export const TEMPLATE_REGISTRY: Record<string, TemplateFn> = {
  naruchnik_welcome:    welcomeEmail,
  naruchnik_followup2:  followUp2Email,
  naruchnik_followup5:  followUp5Email,
  naruchnik_followup10: followUp10Email,
  // ✅ НОВО (poll тригери) — виж abandonedOrderEmail/abandonedCartEmail в
  //    lib/email-templates.ts. context.order_id / context.cart_id идват от
  //    pollTriggers() по-долу, templateFn ги ползва за да сложи реалните
  //    продукти/сума в текста (не generic "имаш нещо в количката").
  abandoned_order:       abandonedOrderEmail,
  abandoned_cart:        abandonedCartEmail,
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
  leads?: { email: string; name?: string | null; subscribed?: boolean | null } | null
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
      .from('workflow_steps').select('delay_days')
      .eq('workflow_id', wf.id).eq('step_number', 1).eq('active', true).maybeSingle()
    const firstDelay = Number(first?.delay_days) || 0

    // ignoreDuplicates + .select(): само наистина новосъздаден ред се връща
    const { data, error } = await supabaseAdmin.from('workflow_enrollments')
      .upsert(
        {
          workflow_id:  wf.id,
          lead_id:      leadId,
          current_step: 0,
          next_run_at:  new Date(Date.now() + firstDelay * 86400000).toISOString(),
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

  const templateFn = TEMPLATE_REGISTRY[step.template_key]
  if (!templateFn) {
    return { sent: false, error: await recordFailure(enr, `непознат template_key: ${step.template_key}`) }
  }

  // ✅ ФИКС: templateFn вече е async — виж бележката при TemplateFn по-горе.
  const { subject, html } = await templateFn({
    email,
    name: enr.leads?.name || undefined,
    slug: enr.context?.naruchnik_slug,
    // ✅ НОВО — abandonedOrderEmail/abandonedCartEmail четат items/total/
    //    order_number оттук (виж pollTriggers() по-горе за какво пълни context).
    context: enr.context,
  })

  try {
    await sendEmail({ to: email, subject, html })
  } catch (sendErr: any) {
    return { sent: false, error: await recordFailure(enr, `sendEmail: ${sendErr?.message || sendErr}`) }
  }

  await supabaseAdmin.from('email_logs').insert({
    lead_id:       enr.lead_id,
    sequence_name: `workflow:${enr.workflow_id}`,
    step_number:   step.step_number,
    sent_at:       now,
  })
  await supabaseAdmin.from('leads').update({ last_email_sent_at: now }).eq('id', enr.lead_id)

  const { data: nextStep } = await supabaseAdmin
    .from('workflow_steps').select('delay_days')
    .eq('workflow_id', enr.workflow_id).eq('step_number', nextStepNumber + 1).eq('active', true)
    .maybeSingle()

  await supabaseAdmin.from('workflow_enrollments').update({
    current_step: nextStepNumber,
    next_run_at:  nextStep ? new Date(Date.now() + Number(nextStep.delay_days) * 86400000).toISOString() : now,
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
    .select('*, leads(email, name, subscribed)')
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
    .select('*, leads(email, name, subscribed)')
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
