import type { SupabaseClient } from '@supabase/supabase-js'

export const PLAN_UPGRADE_ORDER = ['starter', 'growth', 'pro', 'enterprise'] as const

export type PlanLimitInfo = {
  planId: string
  planName: string
  maxTables: number | null
  currentTableCount: number
  canAddTable: boolean
  remainingTables: number | null
}

export async function getRestaurantPlanLimits(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<PlanLimitInfo> {
  const [{ count }, restaurantRes] = await Promise.all([
    admin
      .from('tables')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId),
    admin
      .from('restaurants')
      .select(`
        plan_id,
        subscription:restaurant_subscriptions (
          plan:plans ( id, name, max_tables )
        )
      `)
      .eq('id', restaurantId)
      .single(),
  ])

  const currentTableCount = count ?? 0
  const subRaw = restaurantRes.data?.subscription
  const sub = Array.isArray(subRaw) ? subRaw[0] : subRaw
  const planRaw = (sub as { plan?: unknown } | null)?.plan
  const plan = (Array.isArray(planRaw) ? planRaw[0] : planRaw) as {
    id?: string
    name?: string
    max_tables?: number | null
  } | null

  const planId = plan?.id ?? restaurantRes.data?.plan_id ?? 'starter'
  const planName = plan?.name ?? 'Starter'
  const maxTables = plan?.max_tables ?? null
  const canAddTable = maxTables == null || currentTableCount < maxTables
  const remainingTables = maxTables == null ? null : Math.max(0, maxTables - currentTableCount)

  return {
    planId,
    planName,
    maxTables,
    currentTableCount,
    canAddTable,
    remainingTables,
  }
}

export function planRank(planId: string): number {
  const idx = PLAN_UPGRADE_ORDER.indexOf(planId as typeof PLAN_UPGRADE_ORDER[number])
  return idx === -1 ? 0 : idx
}

export function isPlanUpgrade(fromPlanId: string, toPlanId: string): boolean {
  return planRank(toPlanId) > planRank(fromPlanId)
}
