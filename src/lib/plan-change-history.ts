import type { SupabaseClient } from '@supabase/supabase-js'
import { computePlanProration } from '@/lib/plan-proration'

export type PlanChangeSource = 'owner_upgrade' | 'internal_portal' | 'system'

export type PlanChangeDto = {
  id: string
  fromPlanId: string
  fromPlanName: string
  toPlanId: string
  toPlanName: string
  changedAt: string
  source: PlanChangeSource
  sourceLabel: string
  oldMonthlyFee: number
  newMonthlyFee: number
  daysOnOldPlan: number
  daysOnNewPlan: number
  proratedOldAmount: number
  proratedNewAmount: number
  proratedTotal: number
  prorationPeriodLabel: string
  notes: string | null
}

const SOURCE_LABELS: Record<PlanChangeSource, string> = {
  owner_upgrade: 'Upgrade pelo restaurante',
  internal_portal: 'Alteração pela KiComanda',
  system: 'Sistema',
}

function periodLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export async function fetchPlanChangeHistory(
  admin: SupabaseClient,
  restaurantId: string,
  limit = 24,
): Promise<PlanChangeDto[]> {
  const { data: rows, error } = await admin
    .from('subscription_plan_changes')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('changed_at', { ascending: false })
    .limit(limit)

  if (error || !rows?.length) return []

  const planIds = [...new Set(rows.flatMap(r => [r.from_plan_id, r.to_plan_id]))]
  const { data: plans } = await admin.from('plans').select('id, name').in('id', planIds)
  const names = new Map((plans ?? []).map(p => [p.id, p.name as string]))

  return rows.map(row => {
    const source = row.source as PlanChangeSource
    return {
      id: row.id,
      fromPlanId: row.from_plan_id,
      fromPlanName: names.get(row.from_plan_id) ?? row.from_plan_id,
      toPlanId: row.to_plan_id,
      toPlanName: names.get(row.to_plan_id) ?? row.to_plan_id,
      changedAt: row.changed_at,
      source,
      sourceLabel: SOURCE_LABELS[source] ?? source,
      oldMonthlyFee: Number(row.old_monthly_fee),
      newMonthlyFee: Number(row.new_monthly_fee),
      daysOnOldPlan: row.days_on_old_plan,
      daysOnNewPlan: row.days_on_new_plan,
      proratedOldAmount: Number(row.prorated_old_amount),
      proratedNewAmount: Number(row.prorated_new_amount),
      proratedTotal: Number(row.prorated_old_amount) + Number(row.prorated_new_amount),
      prorationPeriodLabel: periodLabel(row.proration_period_year, row.proration_period_month),
      notes: row.notes,
    }
  })
}

export async function recordPlanChange(
  admin: SupabaseClient,
  input: {
    restaurantId: string
    subscriptionId: string | null
    fromPlanId: string
    toPlanId: string
    oldMonthlyFee: number
    newMonthlyFee: number
    changedBy?: string | null
    source: PlanChangeSource
    notes?: string | null
    changedAt?: Date
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const changedAt = input.changedAt ?? new Date()
  const proration = computePlanProration(input.oldMonthlyFee, input.newMonthlyFee, changedAt)

  const { error } = await admin.from('subscription_plan_changes').insert({
    restaurant_id: input.restaurantId,
    subscription_id: input.subscriptionId,
    from_plan_id: input.fromPlanId,
    to_plan_id: input.toPlanId,
    changed_at: changedAt.toISOString(),
    changed_by: input.changedBy ?? null,
    source: input.source,
    old_monthly_fee: input.oldMonthlyFee,
    new_monthly_fee: input.newMonthlyFee,
    proration_period_year: proration.periodYear,
    proration_period_month: proration.periodMonth,
    days_in_month: proration.daysInMonth,
    days_on_old_plan: proration.daysOnOldPlan,
    days_on_new_plan: proration.daysOnNewPlan,
    prorated_old_amount: proration.proratedOldAmount,
    prorated_new_amount: proration.proratedNewAmount,
    notes: input.notes?.trim() || null,
  })

  if (error) {
    console.error('[recordPlanChange]', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
