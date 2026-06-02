import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireWaiterAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import { fetchWaiterLoyaltyAlerts } from '@/lib/waiter-garcom'

export async function GET() {
  try {
    const access = await requireWaiterAccess()
    const admin = createAdminClient()
    const alerts = await fetchWaiterLoyaltyAlerts(admin, access.restaurantId)

    return NextResponse.json({
      alerts,
      activeCount: alerts.filter(a => a.status === 'active').length,
    })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Waiter alerts]', err)
    return NextResponse.json({ error: 'Erro ao carregar alertas.' }, { status: 500 })
  }
}

export type WaiterAlertsResponse = {
  alerts: import('@/lib/waiter-garcom').WaiterLoyaltyAlert[]
  activeCount: number
}
