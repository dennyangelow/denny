// app/api/customers/[phone]/notes/[noteId]/route.ts
// PATCH → закачи/откачи бележка (pinned) или редактирай текста ѝ
// DELETE → трайно изтрива бележка (напр. вкарана по грешка)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { phone: string; noteId: string } }
) {
  try {
    const body = await req.json()
    const updates: Record<string, any> = {}
    if (body.pinned !== undefined) updates.pinned = !!body.pinned
    if (body.note   !== undefined) updates.note   = String(body.note).trim()

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true })
    }

    const { data, error } = await supabaseAdmin
      .from('customer_notes')
      .update(updates)
      .eq('id', params.noteId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, note: data })
  } catch (error: any) {
    console.error('PATCH /api/customers/[phone]/notes/[noteId] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { phone: string; noteId: string } }
) {
  try {
    const { error } = await supabaseAdmin.from('customer_notes').delete().eq('id', params.noteId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE /api/customers/[phone]/notes/[noteId] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
