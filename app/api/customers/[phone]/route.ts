// app/api/customers/[phone]/route.ts
// GET   → профил (авто-създава при първо отваряне) + история на поръчките + бележки
// PATCH → запазва ръчно въведените CRM полета (култура, площ, tags, VIP...)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: { phone: string } }
) {
  try {
    const phone = decodeURIComponent(params.phone)

    // 1. Взимаме профила
    let { data: profileRows, error: profileError } = await supabaseAdmin
      .rpc('get_customer_profile', { p_phone: phone })
    if (profileError) throw profileError

    // Клиентът още няма CRM профил → създаваме го от последната му поръчка
    if (!profileRows || profileRows.length === 0) {
      const digits = phone.replace(/\D/g, '').slice(-9)
      const { data: latestOrder } = await supabaseAdmin
        .from('orders')
        .select('customer_name, customer_email, customer_city, customer_address')
        .ilike('customer_phone', `%${digits}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!latestOrder) {
        return NextResponse.json({ error: 'Няма поръчки с този телефон' }, { status: 404 })
      }

      const { error: upsertError } = await supabaseAdmin.rpc('upsert_customer_from_order', {
        p_phone:   phone,
        p_name:    latestOrder.customer_name   ?? null,
        p_email:   latestOrder.customer_email  ?? null,
        p_city:    latestOrder.customer_city   ?? null,
        p_address: latestOrder.customer_address ?? null,
      })
      if (upsertError) throw upsertError

      const retry = await supabaseAdmin.rpc('get_customer_profile', { p_phone: phone })
      if (retry.error) throw retry.error
      profileRows = retry.data
    }

    const profile = profileRows?.[0] || null
    if (!profile) {
      return NextResponse.json({ error: 'Клиентът не е намерен' }, { status: 404 })
    }

    // 2. История на поръчките (с артикулите вътре)
    const { data: orders, error: ordersError } = await supabaseAdmin
      .rpc('get_customer_orders', { p_phone: phone })
    if (ordersError) throw ordersError

    // 3. Бележки / call log
    const { data: notes, error: notesError } = await supabaseAdmin
      .from('customer_notes')
      .select('*')
      .eq('customer_id', profile.customer_id)
      .order('created_at', { ascending: false })
    if (notesError) throw notesError

    return NextResponse.json({ profile, orders: orders || [], notes: notes || [] })
  } catch (error: any) {
    console.error('GET /api/customers/[phone] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { phone: string } }
) {
  try {
    const phone = decodeURIComponent(params.phone)
    const body  = await req.json()

    const updates: Record<string, any> = {}
    if (body.name      !== undefined) updates.name      = body.name
    if (body.email     !== undefined) updates.email     = body.email
    if (body.city      !== undefined) updates.city      = body.city
    if (body.address   !== undefined) updates.address   = body.address
    if (body.crop      !== undefined) updates.crop      = body.crop
    if (body.area_size !== undefined) updates.area_size = body.area_size
    if (body.area_unit !== undefined) updates.area_unit = body.area_unit
    if (body.tags      !== undefined) updates.tags      = body.tags
    if (body.is_vip    !== undefined) updates.is_vip    = body.is_vip
    if (body.custom_fields     !== undefined) updates.custom_fields     = body.custom_fields
    if (body.next_contact_date !== undefined) updates.next_contact_date = body.next_contact_date || null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true })
    }

    // Взимаме customer_id по нормализирания телефон (профилът трябва вече да съществува — GET го създава)
    const { data: profileRows, error: profileError } = await supabaseAdmin
      .rpc('get_customer_profile', { p_phone: phone })
    if (profileError) throw profileError

    const customerId = profileRows?.[0]?.customer_id
    if (!customerId) {
      return NextResponse.json({ error: 'Клиентът не е намерен — отвори профила първо' }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin
      .from('customers')
      .update(updates)
      .eq('id', customerId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, customer: data })
  } catch (error: any) {
    console.error('PATCH /api/customers/[phone] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
