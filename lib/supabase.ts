// lib/supabase.ts

import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY     || 'placeholder'

export const supabase      = createClient(supabaseUrl, supabaseAnonKey)
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

// ── Interfaces ──────────────────────────────────────────────

export interface Product {
  id: string
  slug: string
  name: string
  description: string
  price: number
  compare_price?: number
  unit: string
  stock: number
  image_url?: string
  active: boolean
  sort_order: number
}

export interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  customer_email?: string
  customer_address: string
  customer_city: string
  customer_notes?: string
  payment_method: 'cod' | 'bank' | 'card'
  payment_status: 'pending' | 'paid' | 'refunded'
  status: 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  courier?: 'econt' | 'speedy'
  subtotal: number
  shipping: number
  total: number
  tracking_number?: string
  utm_source?: string
  utm_campaign?: string
  created_at: string
  updated_at: string
  shipped_at?: string
  delivered_at?: string
  order_items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id?: string
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
}

export interface Lead {
  id: string
  email: string
  name?: string
  phone?: string
  source: string
  naruchnik_slug?: string
  subscribed: boolean
  tags?: string[]
  engagement_score?: number
  total_purchases?: number
  last_email_sent_at?: string
  last_email_opened_at?: string
  utm_source?: string
  utm_campaign?: string
  unsubscribe_reason?: string
  created_at: string
}

export interface EmailSequenceStep {
  id: string
  sequence_name: string
  step_number: number
  delay_days: number
  subject: string
  template: string
  active: boolean
}

export interface EmailLog {
  id: string
  lead_id: string
  sequence_name: string
  step_number: number
  sent_at: string
  opened_at?: string
  clicked_at?: string
}

export interface AffiliateAnalytics {
  total: number
  last30days: number
  byPartner: Record<string, number>
  byProduct: Record<string, number>
}
