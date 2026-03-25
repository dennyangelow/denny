// lib/supabase.ts

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
  subtotal: number
  shipping: number
  total: number
  utm_source?: string
  utm_campaign?: string
  created_at: string
  updated_at: string
  order_items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
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
  subscribed: boolean
  created_at: string
}

export interface AffiliateAnalytics {
  total: number
  last30days: number
  byPartner: Record<string, number>
  byProduct: Record<string, number>
}
