import type { SupabaseClient } from '@supabase/supabase-js'

export type ProrationSplit = {
  periodYear: number
  periodMonth: number
  daysInMonth: number
  daysOnOldPlan: number
  daysOnNewPlan: number
  proratedOldAmount: number
  proratedNewAmount: number
  totalProratedFee: number
}

/** Calcula rateio da mensalidade quando o upgrade ocorre no meio do mês. */
export function computePlanProration(
  oldMonthlyFee: number,
  newMonthlyFee: number,
  changedAt: Date = new Date(),
): ProrationSplit {
  const periodYear = changedAt.getFullYear()
  const periodMonth = changedAt.getMonth() + 1
  const daysInMonth = new Date(periodYear, periodMonth, 0).getDate()
  const dayOfMonth = changedAt.getDate()

  // Dias 1..(D-1) no plano antigo; dia D até fim no plano novo
  const daysOnOldPlan = Math.max(0, dayOfMonth - 1)
  const daysOnNewPlan = daysInMonth - daysOnOldPlan

  const proratedOldAmount = roundMoney((daysOnOldPlan / daysInMonth) * oldMonthlyFee)
  const proratedNewAmount = roundMoney((daysOnNewPlan / daysInMonth) * newMonthlyFee)

  return {
    periodYear,
    periodMonth,
    daysInMonth,
    daysOnOldPlan,
    daysOnNewPlan,
    proratedOldAmount,
    proratedNewAmount,
    totalProratedFee: roundMoney(proratedOldAmount + proratedNewAmount),
  }
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/** Mensalidade do mês considerando upgrades proporcionais registrados. */
export async function monthlyFeeForBillingPeriod(
  admin: SupabaseClient,
  restaurantId: string,
  year: number,
  month: number,
  fallbackMonthlyFee: number,
): Promise<{ monthlyFee: number; prorationApplied: boolean; prorationNote?: string }> {
  const { data: changes } = await admin
    .from('subscription_plan_changes')
    .select('from_plan_id, to_plan_id, days_on_old_plan, days_on_new_plan, prorated_old_amount, prorated_new_amount')
    .eq('restaurant_id', restaurantId)
    .eq('proration_period_year', year)
    .eq('proration_period_month', month)
    .order('changed_at', { ascending: true })

  if (!changes?.length) {
    return { monthlyFee: fallbackMonthlyFee, prorationApplied: false }
  }

  if (changes.length === 1) {
    const c = changes[0]
    const total = roundMoney(Number(c.prorated_old_amount) + Number(c.prorated_new_amount))
    return {
      monthlyFee: total,
      prorationApplied: true,
      prorationNote: `${c.days_on_old_plan}d ${c.from_plan_id} + ${c.days_on_new_plan}d ${c.to_plan_id}`,
    }
  }

  // Vários upgrades no mesmo mês: soma dos trechos registrados
  let total = 0
  const parts: string[] = []
  for (const c of changes) {
    total += Number(c.prorated_old_amount) + Number(c.prorated_new_amount)
    parts.push(`${c.from_plan_id}→${c.to_plan_id}`)
  }
  return {
    monthlyFee: roundMoney(total),
    prorationApplied: true,
    prorationNote: parts.join(', '),
  }
}
