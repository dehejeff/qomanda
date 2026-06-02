import { createClient, getServerUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DEV_BYPASS, mockTables, mockOrders, mockRestaurant } from '@/lib/dev-mock'
import { sortTablesByNumber } from '@/lib/sort-tables'
import { OverviewLiveDashboard } from '@/components/dashboard/overview-live-dashboard'
import type { DashboardOverviewData } from '@/lib/dashboard-fetch'

export default async function DashboardPage() {
  if (DEV_BYPASS) {
    const tables = sortTablesByNumber(mockTables)
    const occupied = tables.filter(t => t.status === 'occupied').length
    const initial: DashboardOverviewData = {
      stats: { occupied, total: tables.length, openOrders: mockOrders.length, revenue: 0 },
      tables: tables as DashboardOverviewData['tables'],
      orders: mockOrders as DashboardOverviewData['orders'],
    }
    return (
      <OverviewLiveDashboard
        restaurantId={mockRestaurant.id}
        restaurantSlug={mockRestaurant.slug}
        initial={initial}
      />
    )
  }

  const { user } = await getServerUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: restaurant } = await supabase.from('restaurants').select('id, slug').eq('owner_id', user.id).single()
  if (!restaurant) redirect('/login')

  const { fetchDashboardOverview } = await import('@/lib/dashboard-fetch')
  const initial = await fetchDashboardOverview(supabase, restaurant.id)

  return (
    <OverviewLiveDashboard
      restaurantId={restaurant.id}
      restaurantSlug={restaurant.slug}
      initial={initial}
    />
  )
}
