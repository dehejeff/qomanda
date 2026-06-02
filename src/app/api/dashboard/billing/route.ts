import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnerAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import { previewRestaurantMonthlyBill } from '@/lib/commission-billing'
import { COMMISSION_TIERS, SETUP_FEE_PILOT } from '@/lib/commission-tiers'

export async function GET() {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()

    const now = new Date()
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const year = prev.getFullYear()
    const month = prev.getMonth() + 1

    const currentMonth = await previewRestaurantMonthlyBill(
      admin,
      access.restaurantId,
      now.getFullYear(),
      now.getMonth() + 1,
    )

    const previousMonth = await previewRestaurantMonthlyBill(
      admin,
      access.restaurantId,
      year,
      month,
    )

    return NextResponse.json({
      setupFeePilot: SETUP_FEE_PILOT,
      commissionTiers: COMMISSION_TIERS,
      currentMonth,
      previousMonth,
      billingDay: 5,
      model: 'restaurant_account',
      note: 'Pagamentos digitais caem 100% na sua conta. Mensalidade + comissão faturadas todo dia 5.',
    })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Billing preview]', err)
    return NextResponse.json({ error: 'Erro ao carregar faturamento.' }, { status: 500 })
  }
}
