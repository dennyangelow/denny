// app/api/leads/broadcast/route.ts — масово изпращане

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

let lastBroadcast = 0
const COOLDOWN_MS = 10 * 60 * 1000

export async function POST(req: NextRequest) {
  const now = Date.now()
  if (now - lastBroadcast < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (now - lastBroadcast)) / 1000)
    return NextResponse.json(
      { error: `Изчакай още ${remaining} секунди преди следващото изпращане` },
      { status: 429 }
    )
  }

  try {
    const { subject, body, tags, onlySubscribed = true } = await req.json()
    if (!subject?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Темата и съдържанието са задължителни' }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY не е настроен' }, { status: 500 })
    }

    let query = supabaseAdmin.from('leads').select('email, name')
    if (onlySubscribed) query = query.eq('subscribed', true)
    if (tags && tags.length > 0) query = query.overlaps('tags', tags)

    const { data: leads, error } = await query
    if (error) throw error
    if (!leads || leads.length === 0) {
      return NextResponse.json({ error: 'Няма подходящи абонати' }, { status: 400 })
    }

    const resend  = new Resend(apiKey)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dennyangelow.com'
    let sent      = 0
    const errors: string[] = []

    const BATCH = 10
    for (let i = 0; i < leads.length; i += BATCH) {
      const batch = leads.slice(i, i + BATCH)
      await Promise.all(batch.map(async lead => {
        try {
          const personalBody = body.replace(/\{\{name\}\}/g, lead.name || 'приятелю')
          const unsubUrl = `${siteUrl}/unsubscribe?email=${encodeURIComponent(lead.email)}`
          await resend.emails.send({
            from: 'Denny Angelow <denny@dennyangelow.com>',
            to: lead.email,
            subject,
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
                ${personalBody.replace(/\n/g, '<br>')}
                <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
                <p style="font-size:12px;color:#9ca3af">
                  Ако не желаеш да получаваш повече имейли:
                  <a href="${unsubUrl}" style="color:#9ca3af">отпиши се тук</a>.
                </p>
              </div>
            `,
          })
          sent++
        } catch (e: any) {
          errors.push(`${lead.email}: ${e.message}`)
        }
      }))
      if (i + BATCH < leads.length) {
        await new Promise(r => setTimeout(r, 200))
      }
    }

    lastBroadcast = Date.now()

    return NextResponse.json({
      success: true,
      sent,
      total: leads.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    console.error('Broadcast error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
