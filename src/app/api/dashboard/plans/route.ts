import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnerAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import { fetchPlans } from '@/lib/internal-clients'
import { getRestaurantPlanLimits, isPlanUpgrade, planRank } from '@/lib/plan-limits'

export async function GET() {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()
    const [plans, limits] = await Promise.all([
      fetchPlans(admin),
      getRestaurantPlanLimits(admin, access.restaurantId),
    ])

    const upgrades = plans
      .filter(p => isPlanUpgrade(limits.planId, p.id))
      .filter(p => p.max_tables == null || p.max_tables > limits.currentTableCount)
      .sort((a, b) => planRank(a.id) - planRank(b.id))
      .map(p => ({
        id: p.id,
        name: p.name,
        maxTables: p.max_tables,
        monthlyFee: p.monthly_fee,
        platformFeePercent: p.platform_fee_percent,
      }))

    return NextResponse.json({
      currentPlan: {
        id: limits.planId,
        name: limits.planName,
        maxTables: limits.maxTables,
      },
      limits,
      upgrades,
    })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Dashboard plans GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar planos.' }, { status: 500 })
  }
}
