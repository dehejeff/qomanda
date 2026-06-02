import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildMonthlyInvoicePreview,
  commissionForMonthlyGmv,
  PLAN_COMMISSION_DISCOUNT,
} from '@/lib/commission-tiers'

export async function digitalGmvForMonth(
  admin: SupabaseClient,
  restaurantId: string,
  year: number,
  month: number,
): Promise<number> {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)

  const { data } = await admin
    .from('payments')
    .select('amount, method')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'paid')
    .gte('paid_at', start.toISOString())
    .lt('paid_at', end.toISOString())

  let total = 0
  for (const p of data ?? []) {
    if (p.method === 'cash' || p.method === 'offer') continue
    total += Number(p.amount)
  }
  return Math.round(total * 100) / 100
}

export async function digitalGmvMonthToDate(
  admin: SupabaseClient,
  restaurantId: string,
  beforePaidAt?: Date,
): Promise<number> {
  const now = beforePaidAt ?? new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)

  const { data } = await admin
    .from('payments')
    .select('amount, method, paid_at')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'paid')
    .gte('paid_at', start.toISOString())
    .lt('paid_at', now.toISOString())

  let total = 0
  for (const p of data ?? []) {
    if (p.method === 'cash' || p.method === 'offer') continue
    total += Number(p.amount)
  }
  return Math.round(total * 100) / 100
}

export async function previewRestaurantMonthlyBill(
  admin: SupabaseClient,
  restaurantId: string,
  year: number,
  month: number,
): Promise<ReturnType<typeof buildMonthlyInvoicePreview> & { periodYear: number; periodMonth: number }> {
  const { data: r } = await admin
    .from('restaurants')
    .select('plan_id, subscription:restaurant_subscriptions ( monthly_fee_override, plan:plans ( monthly_fee ) )')
    .eq('id', restaurantId)
    .single()

  const subRaw = Array.isArray(r?.subscription) ? r.subscription[0] : r?.subscription
  const planRaw = (subRaw as { plan?: unknown } | null)?.plan
  const plan = (Array.isArray(planRaw) ? planRaw[0] : planRaw) as { monthly_fee?: number } | null
  const monthlyFee = Number(
    (subRaw as { monthly_fee_override?: number } | null)?.monthly_fee_override
    ?? plan?.monthly_fee
    ?? 199,
  )

  const gmvDigital = await digitalGmvForMonth(admin, restaurantId, year, month)
  const preview = buildMonthlyInvoicePreview(monthlyFee, gmvDigital, r?.plan_id ?? 'starter')
  return { ...preview, periodYear: year, periodMonth: month }
}

export { commissionForMonthlyGmv, PLAN_COMMISSION_DISCOUNT }
