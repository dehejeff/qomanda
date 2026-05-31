import type { SupabaseClient } from '@supabase/supabase-js'
import type { RestaurantTable } from '@/types'
import { sortTablesByNumber } from '@/lib/sort-tables'
import type { OverviewOrder } from '@/components/dashboard/overview-orders-panel'

export type DashboardOverviewStats = {
  occupied: number
  total: number
  openOrders: number
  revenue: number
}

export type DashboardOverviewData = {
  stats: DashboardOverviewStats
  tables: RestaurantTable[]
  orders: OverviewOrder[]
}

function startOfTodayIso() {
  return new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
}

export async function fetchDashboardOverview(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<DashboardOverviewData> {
  const [tablesRes, ordersRes, paymentsRes, recentRes] = await Promise.all([
    supabase
      .from('tables')
      .select('id, number, status, restaurant_id, qr_code_url, check_in_token, created_at')
      .eq('restaurant_id', restaurantId)
      .order('number'),
    supabase
      .from('orders')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready']),
    supabase
      .from('payments')
      .select('amount')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'paid')
      .gte('created_at', startOfTodayIso()),
    supabase
      .from('orders')
      .select(`
        id, status, created_at,
        items:order_items(unit_price, quantity),
        session:sessions(table:tables(number)),
        customer:customers(first_name, last_name)
      `)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(1000),
  ])

  const tables = sortTablesByNumber((tablesRes.data ?? []) as RestaurantTable[])
  const occupied = tables.filter(t => t.status === 'occupied').length
  const revenue = (paymentsRes.data ?? []).reduce((a, p) => a + p.amount, 0)

  return {
    stats: {
      occupied,
      total: tables.length,
      openOrders: (ordersRes.data ?? []).length,
      revenue,
    },
    tables,
    orders: (recentRes.data ?? []) as OverviewOrder[],
  }
}
