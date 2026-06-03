import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnerAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import { fetchPlans, resolveEffectiveFees } from '@/lib/internal-clients'
import { getRestaurantPlanLimits, isPlanUpgrade } from '@/lib/plan-limits'
import { computePlanProration } from '@/lib/plan-proration'
import { recordPlanChange } from '@/lib/plan-change-history'
import type { Plan } from '@/types/internal'

export async function POST(req: NextRequest) {
  try {
    const access = await requireOwnerAccess()
    const body = await req.json() as { planId?: string }
    const targetPlanId = body.planId?.trim()

    if (!targetPlanId) {
      return NextResponse.json({ error: 'Selecione o novo plano.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const [plans, limits, restaurantRes] = await Promise.all([
      fetchPlans(admin),
      getRestaurantPlanLimits(admin, access.restaurantId),
      admin
        .from('restaurants')
        .select(`
          id, plan_id,
          subscription:restaurant_subscriptions (
            id, plan_id, monthly_fee_override,
            platform_fee_percent_override, platform_fee_fixed_override,
            plan:plans ( id, name, monthly_fee, max_tables, platform_fee_percent, platform_fee_fixed )
          )
        `)
        .eq('id', access.restaurantId)
        .single(),
    ])

    const targetPlan = plans.find(p => p.id === targetPlanId)
    if (!targetPlan) {
      return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 })
    }

    if (!isPlanUpgrade(limits.planId, targetPlanId)) {
      return NextResponse.json({ error: 'Só é possível fazer upgrade para um plano superior.' }, { status: 400 })
    }

    if (targetPlan.max_tables != null && targetPlan.max_tables < limits.currentTableCount) {
      return NextResponse.json({
        error: `O plano ${targetPlan.name} suporta até ${targetPlan.max_tables} mesas. Você já tem ${limits.currentTableCount}.`,
      }, { status: 400 })
    }

    const subRaw = restaurantRes.data?.subscription
    const sub = Array.isArray(subRaw) ? subRaw[0] : subRaw
    const currentPlanRaw = (sub as { plan?: unknown } | null)?.plan
    const currentPlan = (Array.isArray(currentPlanRaw) ? currentPlanRaw[0] : currentPlanRaw) as Plan | null
    const currentPlanId = limits.planId

    const oldMonthlyFee = Number(
      (sub as { monthly_fee_override?: number } | null)?.monthly_fee_override
      ?? currentPlan?.monthly_fee
      ?? 199,
    )
    const newMonthlyFee = Number(targetPlan.monthly_fee)

    const changedAt = new Date()
    const proration = computePlanProration(oldMonthlyFee, newMonthlyFee, changedAt)
    const fees = resolveEffectiveFees(targetPlan, {
      platform_fee_percent_override: (sub as { platform_fee_percent_override?: number | null } | null)?.platform_fee_percent_override,
      platform_fee_fixed_override: (sub as { platform_fee_fixed_override?: number | null } | null)?.platform_fee_fixed_override,
    })

    const subscriptionId = (sub as { id?: string } | null)?.id ?? null

    const logResult = await recordPlanChange(admin, {
      restaurantId: access.restaurantId,
      subscriptionId,
      fromPlanId: currentPlanId,
      toPlanId: targetPlanId,
      oldMonthlyFee,
      newMonthlyFee,
      changedBy: access.user.id,
      source: 'owner_upgrade',
      notes: `Upgrade self-service: ${limits.currentTableCount} mesas · limite ${limits.maxTables ?? '∞'}`,
      changedAt,
    })

    if (!logResult.ok) {
      return NextResponse.json({ error: 'Erro ao registrar upgrade. Rode a migração subscription_plan_changes.' }, { status: 500 })
    }

    await admin.from('restaurants').update({
      plan_id: targetPlanId,
      platform_fee_percent: fees.platform_fee_percent,
      platform_fee_fixed: fees.platform_fee_fixed,
    }).eq('id', access.restaurantId)

    if (subscriptionId) {
      await admin.from('restaurant_subscriptions').update({
        plan_id: targetPlanId,
        updated_at: changedAt.toISOString(),
      }).eq('id', subscriptionId)
    }

    const newLimits = await getRestaurantPlanLimits(admin, access.restaurantId)

    return NextResponse.json({
      ok: true,
      planId: targetPlanId,
      planName: targetPlan.name,
      maxTables: targetPlan.max_tables,
      proration,
      limits: newLimits,
      message: `Plano atualizado para ${targetPlan.name}. Mensalidade deste mês: ${proration.totalProratedFee.toFixed(2)} (rateio proporcional).`,
    })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Plan upgrade POST]', err)
    return NextResponse.json({ error: 'Erro ao atualizar plano.' }, { status: 500 })
  }
}
