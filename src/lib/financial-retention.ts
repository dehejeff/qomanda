/** Retenção de dados financeiros detalhados (logs, NF-e, recibos, transações). */
export const FINANCIAL_RETENTION_DAYS = 90

export type FinancialRetentionRun = {
  id: string
  retentionDays: number
  cutoffAt: string
  auditEventsDeleted: number
  snapshotsDeleted: number
  nfeDeleted: number
  paymentsDeleted: number
  ordersDeleted: number
  orderItemsDeleted: number
  monthsRolledUp: number
  triggeredBy: string
  createdAt: string
}

export type RetentionStatus = {
  retentionDays: number
  lastRun: FinancialRetentionRun | null
  monthlyStatsMonths: number
}

export async function fetchRetentionStatus(
  admin: import('@supabase/supabase-js').SupabaseClient,
  restaurantId?: string,
): Promise<RetentionStatus> {
  const [{ data: lastRun }, { count: statsCount }] = await Promise.all([
    admin
      .from('financial_retention_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    restaurantId
      ? admin
          .from('restaurant_monthly_stats')
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
      : admin.from('restaurant_monthly_stats').select('*', { count: 'exact', head: true }),
  ])

  return {
    retentionDays: FINANCIAL_RETENTION_DAYS,
    lastRun: lastRun ? mapRetentionRun(lastRun) : null,
    monthlyStatsMonths: statsCount ?? 0,
  }
}

export async function runFinancialRetentionPurge(
  admin: import('@supabase/supabase-js').SupabaseClient,
  triggeredBy: 'cron' | 'staff' = 'cron',
): Promise<FinancialRetentionRun | null> {
  const { data, error } = await admin.rpc('fn_purge_financial_retention', {
    p_retention_days: FINANCIAL_RETENTION_DAYS,
    p_triggered_by: triggeredBy,
  })

  if (error) {
    console.error('[runFinancialRetentionPurge]', error)
    return null
  }

  return data ? mapRetentionRun(data as Record<string, unknown>) : null
}

function mapRetentionRun(row: Record<string, unknown>): FinancialRetentionRun {
  return {
    id: row.id as string,
    retentionDays: row.retention_days as number,
    cutoffAt: row.cutoff_at as string,
    auditEventsDeleted: row.audit_events_deleted as number,
    snapshotsDeleted: row.snapshots_deleted as number,
    nfeDeleted: row.nfe_deleted as number,
    paymentsDeleted: row.payments_deleted as number,
    ordersDeleted: row.orders_deleted as number,
    orderItemsDeleted: row.order_items_deleted as number,
    monthsRolledUp: row.months_rolled_up as number,
    triggeredBy: row.triggered_by as string,
    createdAt: row.created_at as string,
  }
}
