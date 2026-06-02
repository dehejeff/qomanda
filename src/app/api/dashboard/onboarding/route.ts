import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnerAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import { computeRestaurantOnboarding } from '@/lib/restaurant-onboarding'

export async function GET() {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()
    const state = await computeRestaurantOnboarding(admin, access.restaurantId)
    return NextResponse.json(state)
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Onboarding GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar onboarding.' }, { status: 500 })
  }
}
