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

/** POST — ocultar checklist manualmente (já configurado). */
export async function POST() {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()
    const { error } = await admin
      .from('restaurants')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', access.restaurantId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Onboarding POST]', err)
    return NextResponse.json({ error: 'Erro ao ocultar checklist.' }, { status: 500 })
  }
}
