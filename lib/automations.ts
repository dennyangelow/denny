// lib/automations.ts — v1 (Фаза 1)
//
// Генерален automation engine — заменя hardcoded-ната naruchnik sequence
// логика в app/api/leads/sequence/route.ts с конфигурируем от админ
// панела модел (workflows/workflow_steps/workflow_enrollments — виж
// migrations/001_workflows.sql).
//
// ✅ Фаза 1 умишлено НЕ пипа съдържанието на имейлите — TEMPLATE_REGISTRY
//    по-долу просто сочи към съществуващите функции в email-templates.ts.
//    Пълен, администрируем от панела редактор на съдържание е Фаза 3.
//
// ✅ enrollAndRunFirstStep() е специално важна разлика спрямо "чист" cron
//    модел: наръчникът трябва да пристигне ВЕДНАГА (човекът чака точно
//    сега), не до час по-късно на следващия hourly tick. Затова стъпка 1
//    (обикновено delay_days=0) се изпраща синхронно, в рамките на самата
//    /api/leads заявка — hourly tick-ът поема само следващите стъпки.

import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail } from '@/lib/mailer'
import {
  welcomeEmail,
  followUp2Email,
  followUp5Email,
  followUp10Email,
} from '@/lib/email-templates'

type TemplateFn = (p: { email: string; name?: string; slug?: string }) => { subject: string; html: string }

// ✅ Добавяй нов ред тук при нова стъпка/шаблон — трябва да съвпада с
//    template_key стойността, записана в workflow_steps (виж
//    AutomationsTab.tsx за клиентския списък със същите ключове).
export const TEMPLATE_REGISTRY: Record<string, TemplateFn> = {
  naruchnik_welcome:    welcomeEmail,
  naruchnik_followup2:  followUp2Email,
  naruchnik_followup5:  followUp5Email,
  naruchnik_followup10: followUp10Email,
}

interface EnrollmentRow {
  id: string
  workflow_id: string
  lead_id: string
  current_step: number
  attempts: number
  context: Record<string, any>
  leads?: { email: string; name?: string | null } | null
}

// ✅ След толкова неуспешни sendEmail() опити подред, enrollment-ът
//    излиза от активен статус вместо hourly tick-ът да го опитва вечно
//    (бъг №2 — виж migrations/002_workflow_retry.sql за attempts/last_error).
const MAX_SEND_ATTEMPTS = 3

/**
 * Записва lead-а във всички АКТИВНИ workflows от даден trigger_type.
 * Връща само id-тата на workflows, в които enrollment-ът е НОВОСЪЗДАДЕН
 * (не вече съществуващ) — виж бележката в enrollAndRunFirstStep() защо
 * това разграничение е важно.
 */
export async function enrollLead(
  triggerType: string,
  leadId: string,
  context: Record<string, any> = {}
): Promise<string[]> {
  const { data: workflows } = await supabaseAdmin
    .from('workflows')
    .select('id')
    .eq('trigger_type', triggerType)
    .eq('active', true)

  const newlyEnrolledWorkflowIds: string[] = []
  for (const wf of workflows || []) {
    // ✅ ФИКС (бъг №1): .select() тук е ключово. upsert с
    //    ignoreDuplicates:true прави INSERT ... ON CONFLICT DO NOTHING —
    //    ако (workflow_id, lead_id) вече съществува, редът се пропуска И
    //    .select() връща 0 реда точно за него. Само по резултата от
    //    .select() можем да различим "лийдът е записан ТУК СЕГА за
    //    първи път" от "вече си беше тук". Преди нямахме тази проверка —
    //    втори lead за същия workflow (напр. втори имейл capture form
    //    submit) щеше да минава пак през enrollAndRunFirstStep() и да
    //    прати СЛЕДВАЩАТА чакаща стъпка веднага, вместо на нейния delay.
    const { data, error } = await supabaseAdmin.from('workflow_enrollments')
      .upsert(
        {
          workflow_id:  wf.id,
          lead_id:      leadId,
          current_step: 0,
          next_run_at:  new Date().toISOString(),
          status:       'active',
          context,
        },
        { onConflict: 'workflow_id,lead_id', ignoreDuplicates: true }
      )
      .select('id')

    if (!error && data && data.length > 0) newlyEnrolledWorkflowIds.push(wf.id)
  }
  return newlyEnrolledWorkflowIds
}

/** Изпълнява стъпка step_number за едно enrollment. Споделена от двата пътя по-долу. */
async function runStep(enr: EnrollmentRow): Promise<{ sent: boolean; error?: string }> {
  const nextStepNumber = enr.current_step + 1
  const now = new Date().toISOString()

  const { data: step } = await supabaseAdmin
    .from('workflow_steps')
    .select('*')
    .eq('workflow_id', enr.workflow_id)
    .eq('step_number', nextStepNumber)
    .eq('active', true)
    .maybeSingle()

  // Няма следваща стъпка (или е деактивирана) → workflow-ът е приключил за този lead.
  if (!step) {
    await supabaseAdmin.from('workflow_enrollments')
      .update({ status: 'completed', updated_at: now }).eq('id', enr.id)
    return { sent: false }
  }

  const email = enr.leads?.email
  if (!email) {
    await supabaseAdmin.from('workflow_enrollments')
      .update({ status: 'exited', updated_at: now }).eq('id', enr.id)
    return { sent: false, error: 'lead без email' }
  }

  const templateFn = TEMPLATE_REGISTRY[step.template_key]
  if (!templateFn) {
    return { sent: false, error: `непознат template_key: ${step.template_key}` }
  }

  const { subject, html } = templateFn({
    email,
    name: enr.leads?.name || undefined,
    slug: enr.context?.naruchnik_slug,
  })

  // ✅ ФИКС (бъг №2): преди sendEmail() не беше в собствен try/catch тук —
  //    грешка изхвърчаше нагоре, enrollment-ът оставаше недокоснат
  //    (next_run_at/status непроменени), значи следващият hourly tick го
  //    хващаше пак, завинаги, без граница. Сега броим опитите и след
  //    MAX_SEND_ATTEMPTS излизаме от активен статус, вместо вечен retry.
  try {
    await sendEmail({ to: email, subject, html })
  } catch (sendErr: any) {
    const attempts = (enr.attempts || 0) + 1
    const giveUp    = attempts >= MAX_SEND_ATTEMPTS
    await supabaseAdmin.from('workflow_enrollments').update({
      attempts,
      last_error: String(sendErr?.message || sendErr).slice(0, 500),
      status:     giveUp ? 'exited' : 'active',
      updated_at: now,
    }).eq('id', enr.id)
    return { sent: false, error: `sendEmail неуспешен (опит ${attempts}/${MAX_SEND_ATTEMPTS}${giveUp ? ', отказано' : ''}): ${sendErr?.message || sendErr}` }
  }

  // sequence_name пази workflow_id-то, за да може EmailStatsTab/бъдеща
  // аналитика да групира по конкретен workflow, не само по 'naruchnik'.
  await supabaseAdmin.from('email_logs').insert({
    lead_id:       enr.lead_id,
    sequence_name: `workflow:${enr.workflow_id}`,
    step_number:   step.step_number,
    sent_at:       now,
  })

  // Насрочваме следващата стъпка (ако има такава) спрямо delay_days ѝ.
  const { data: nextStep } = await supabaseAdmin
    .from('workflow_steps')
    .select('delay_days')
    .eq('workflow_id', enr.workflow_id)
    .eq('step_number', nextStepNumber + 1)
    .eq('active', true)
    .maybeSingle()

  await supabaseAdmin.from('workflow_enrollments').update({
    current_step: nextStepNumber,
    next_run_at:  nextStep ? new Date(Date.now() + nextStep.delay_days * 86400000).toISOString() : now,
    status:       nextStep ? 'active' : 'completed',
    // ✅ Успешно изпращане нулира брояча — MAX_SEND_ATTEMPTS е за ПОРЕДНИ
    //    неуспехи на конкретна стъпка, не общо за целия enrollment.
    attempts:     0,
    last_error:   null,
    updated_at:   now,
  }).eq('id', enr.id)

  return { sent: true }
}

/**
 * Записва lead-а в подходящите workflows И веднага изпраща стъпка 1 синхронно
 * (не чака hourly tick-а) — за тригери, при които човек чака резултата СЕГА
 * (напр. изтегляне на наръчник). Следващите стъпки поема processDueEnrollments().
 */
export async function enrollAndRunFirstStep(
  triggerType: string,
  leadId: string,
  context: Record<string, any> = {}
): Promise<void> {
  const workflowIds = await enrollLead(triggerType, leadId, context)
  if (workflowIds.length === 0) return

  const { data: enrollments } = await supabaseAdmin
    .from('workflow_enrollments')
    .select('*, leads(email, name)')
    .eq('lead_id', leadId)
    .in('workflow_id', workflowIds)
    .eq('status', 'active')

  for (const enr of (enrollments || []) as EnrollmentRow[]) {
    try {
      await runStep(enr)
    } catch (err: any) {
      console.error('[automations] enrollAndRunFirstStep:', err.message)
      // Нарочно не хвърляме нагоре — неуспешен instant опит НЕ трябва да
      // счупи /api/leads отговора; hourly tick-ът ще го хване по-късно,
      // защото next_run_at/current_step не са се променили при грешка.
    }
  }
}

/** Hourly tick — обхожда всички дължими enrollments (всички тригер типове наведнъж). */
export async function processDueEnrollments(
  limit = 200
): Promise<{ processed: number; sent: number; errors: string[] }> {
  const now = new Date().toISOString()
  const errors: string[] = []
  let sent = 0

  const { data: due } = await supabaseAdmin
    .from('workflow_enrollments')
    .select('*, leads(email, name)')
    .eq('status', 'active')
    .lte('next_run_at', now)
    .limit(limit)

  for (const enr of (due || []) as EnrollmentRow[]) {
    try {
      const result = await runStep(enr)
      if (result.sent) sent++
      if (result.error) errors.push(`enrollment ${enr.id}: ${result.error}`)
      // ✅ Пауза между изпращанията — SES rate limit (1/сек в sandbox),
      //    същият подход като стария app/api/leads/sequence/route.ts.
      await new Promise(r => setTimeout(r, 150))
    } catch (e: any) {
      errors.push(`enrollment ${enr.id}: ${e.message}`)
    }
  }

  return { processed: (due || []).length, sent, errors }
}
