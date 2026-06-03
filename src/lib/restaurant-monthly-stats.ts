import type { SupabaseClient } from '@supabase/supabase-js'

export type RestaurantMonthlyStat = {
  periodYear: number
  periodMonth: number
  periodLabel: string
  revenueTotal: number
  paymentCount: number
  orderCount: number
  gmvDigital: number
  commissionTotal: number
}

function periodLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

export async function fetchRestaurantMonthlyStats(
  admin: SupabaseClient,
  restaurantId: string,
  limit = 24,
): Promise<RestaurantMonthlyStat[]> {
  const { data, error } = await admin
    .from('restaurant_monthly_stats')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
    .limit(limit)

  if (error || !data?.length) return []

  return data.map(row => ({
    periodYear: row.period_year,
    periodMonth: row.period_month,
    periodLabel: periodLabel(row.period_year, row.period_month),
    revenueTotal: Number(row.revenue_total),
    paymentCount: row.payment_count,
    orderCount: row.order_count,
    gmvDigital: Number(row.gmv_digital),
    commissionTotal: Number(row.commission_total),
  }))
}

/** GMV digital de um mês — usa agregado se transações detalhadas já foram purgadas. */
export async function digitalGmvForMonthWithFallback(
  admin: SupabaseClient,
  restaurantId: string,
  year: number,
  month: number,
  liveGmv: number,
): Promise<number> {
  if (liveGmv > 0) return liveGmv

  const { data } = await admin
    .from('restaurant_monthly_stats')
    .select('gmv_digital')
    .eq('restaurant_id', restaurantId)
    .eq('period_year', year)
    .eq('period_month', month)
    .maybeSingle()

  return data ? Number(data.gmv_digital) : 0
}

export async function fetchCustomerRestaurantLifetimeTotals(
  admin: SupabaseClient,
  customerId: string,
): Promise<Map<string, { totalSpent: number; paymentCount: number; lastPaymentAt: string | null }>> {
  const { data } = await admin
    .from('customer_restaurant_totals')
    .select('restaurant_id, total_spent, payment_count, last_payment_at')
    .eq('customer_id', customerId)

  const map = new Map<string, { totalSpent: number; paymentCount: number; lastPaymentAt: string | null }>()
  for (const row of data ?? []) {
    map.set(row.restaurant_id, {
      totalSpent: Number(row.total_spent),
      paymentCount: row.payment_count,
      lastPaymentAt: row.last_payment_at,
    })
  }
  return map
}
