// app/api/leads/route.ts — v3 с email sequence

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'
import { rateLimit, getIP } from '@/lib/rate-limit'
import { welcomeEmail } from '@/lib/email-templates'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = rateLimit(`leads:${ip}`, { limit: 5, window: 600 })
  if (!rl.success) {
    return NextResponse.json(
      { error: `Твърде много заявки. Изчакай ${rl.resetIn} секунди.` },
      { status: 429, headers: { 'Retry-After': String(rl.resetIn) } }
    )
  }

  try {
    const body = await req.json()
    const { email, name, phone, source, utm_source, utm_campaign, naruchnik_slug } = body

    if (!email || !email.includes('@') || email.length > 255) {
      return NextResponse.json({ error: 'Невалиден имейл' }, { status: 400 })
    }

    const slug = naruchnik_slug || 'super-domati'
    const now  = new Date().toISOString()

    // Upsert lead
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .upsert(
        {
          email:            email.toLowerCase().trim(),
          name:             name?.trim() || null,
          phone:            phone?.trim() || null,
          source:           source || 'naruchnik',
          naruchnik_slug:   slug,
          utm_source:       utm_source || null,
          utm_campaign:     utm_campaign || null,
          downloaded_at:    now,
          subscribed:       true,
          last_email_sent_at: now,
          updated_at:       now,
        },
        { onConflict: 'email', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (error && error.code !== '23505') throw error

    // Записваме welcome имейл log
    if (lead) {
      try {
        await supabaseAdmin.from('email_logs').insert({
          lead_id:       lead.id,
          sequence_name: 'naruchnik',
          step_number:   1,
          sent_at:       now,
        })
      } catch (logError) {
        console.warn('Email log failed, but continuing...', logError)
      }}

    // Изпращаме welcome имейл
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey) {
      const resend = new Resend(apiKey)
      const { subject, html } = welcomeEmail({
        email: email.trim(),
        name: name?.trim(),
        slug,
      })
      await resend.emails.send({
        from: 'Denny Angelow <denny@dennyangelow.com>',
        to: email.trim(),
        subject,
        html,
      }).catch(console.error)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
  console.error('Lead error:', error)
  return NextResponse.json({ error: error?.message || error?.code || String(error) }, { status: 500 })
}
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page   = Math.max(1, parseInt(searchParams.get('page')  || '1'))
  const limit  = Math.min(1000, parseInt(searchParams.get('limit') || '500'))
  const tag    = searchParams.get('tag')
  const subscribed = searchParams.get('subscribed')

  let query = supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (tag) {
    query = query.contains('tags', [tag])
  }
  if (subscribed !== null) {
    query = query.eq('subscribed', subscribed === 'true')
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leads: data, total: count })
}
