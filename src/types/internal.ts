export type StaffRole = 'superadmin' | 'ops' | 'billing' | 'support'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled'

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

export interface Plan {
  id: string
  name: string
  max_tables: number | null
  monthly_fee: number
  platform_fee_percent: number
  platform_fee_fixed: number
  trial_days: number
  active: boolean
  display_order: number
}

export interface StaffUser {
  id: string
  user_id: string
  email: string
  name: string | null
  role: StaffRole
  active: boolean
}

export interface RestaurantSubscription {
  id: string
  restaurant_id: string
  plan_id: string
  status: SubscriptionStatus
  trial_ends_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  monthly_fee_override: number | null
  platform_fee_percent_override: number | null
  platform_fee_fixed_override: number | null
  notes: string | null
  plan?: Plan
}

export interface BillingInvoice {
  id: string
  restaurant_id: string
  subscription_id: string | null
  period_start: string
  period_end: string
  amount: number
  status: InvoiceStatus
  due_date: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
}

export interface InternalClientListItem {
  id: string
  name: string
  slug: string
  status: 'active' | 'inactive'
  phone: string | null
  plan_id: string | null
  plan_name: string | null
  subscription_status: SubscriptionStatus | null
  platform_fee_percent: number
  monthly_fee: number
  owner_email: string | null
  created_at: string
  tables_count: number
  payout_configured: boolean
  digital_status: 'inactive' | 'pending' | 'active'
}

import type { PlanChangeDto } from '@/lib/plan-change-history'

export interface InternalClientDetail extends InternalClientListItem {
  address: string | null
  owner_id: string
  restaurant_model: string | null
  operational_mode: string | null
  asaas_onboarding_status: string | null
  subscription: RestaurantSubscription | null
  recent_invoices: BillingInvoice[]
  plan_changes: PlanChangeDto[]
  profile: import('@/lib/restaurant-profile').RestaurantBusinessProfile
  nfe: import('@/lib/restaurant-nfe').RestaurantNfeProfile
  whatsapp: import('@/lib/restaurant-whatsapp').RestaurantWhatsAppStatus
}
