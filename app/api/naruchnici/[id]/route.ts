// app/api/naruchnici/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    
    // 1. Изолираме защитените полета, за да не гърми Supabase
    const { id, created_at, downloads, ...updateData } = body

    const { data, error } = await supabaseAdmin
      .from('naruchnici')
      .update({ 
        ...updateData, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Supabase Error (Naruchnik):', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ naruchnik: data })
  } catch (error: any) {
    console.error('Server Error (Naruchnik):', error.message)
    return NextResponse.json({ error: 'Възникна сървърна грешка' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!params.id) {
      return NextResponse.json({ error: 'Липсва ID' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('naruchnici')
      .delete()
      .eq('id', params.id)

    if (error) throw error
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete Error (Naruchnik):', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data, error } = await supabaseAdmin
      .from('naruchnici')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) throw error
    
    return NextResponse.json({ naruchnik: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
}