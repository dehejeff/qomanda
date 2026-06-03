import type { SupabaseClient } from '@supabase/supabase-js'

export type FinancialEntityType = 'order' | 'order_item' | 'payment'
export type FinancialEventType =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'paid'
  | 'refunded'
  | 'failed'
  | 'cancelled'

export type FinancialAuditEventDto = {
  id: string
  entityType: FinancialEntityType
  entityId: string
  eventType: FinancialEventType
  eventLabel: string
  restaurantId: string | null
  sessionId: string | null
  customerId: string | null
  previousStatus: string | null
  newStatus: string | null
  integrityHash: string
  createdAt: string
  amount: number | null
  method: string | null
  confirmationCode: string | null
}

export type FinancialAuditSummary = {
  paidPaymentsCount: number
  paidVolume: number
  ordersCount: number
  auditEventsCount: number
  lastPaidAt: string | null
  /** Volume histórico agregado (meses anteriores ao purge) */
  archivedRevenue: number
  archivedMonths: number
}

const EVENT_LABELS: Record<FinancialEventType, string> = {
  created: 'Criado',
  updated: 'Atualizado',
  status_changed: 'Status alterado',
  paid: 'Pagamento confirmado',
  refunded: 'Estornado',
  failed: 'Falhou',
  cancelled: 'Cancelado',
}

function payloadAmount(payload: Record<string, unknown> | null): number | null {
  if (!payload) return null
  const row = (payload.new ?? payload.old) as Record<string, unknown> | undefined
  if (!row || row.amount == null) return null
  return Number(row.amount)
}

function payloadField(payload: Record<string, unknown> | null, field: string): string | null {
  if (!payload) return null
  const row = (payload.new ?? payload.old) as Record<string, unknown> | undefined
  const val = row?.[field]
  return val != null ? String(val) : null
}

export async function fetchFinancialAuditSummary(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<FinancialAuditSummary> {
  const [
    { count: paidCount },
    { data: paidRows },
    { count: ordersCount },
    { count: auditCount },
    { data: archivedStats },
  ] = await Promise.all([
    admin
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'paid'),
    admin
      .from('payments')
      .select('amount, paid_at')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(5000),
    admin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId),
    admin
      .from('financial_audit_events')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId),
    admin
      .from('restaurant_monthly_stats')
      .select('revenue_total')
      .eq('restaurant_id', restaurantId),
  ])

  const paidVolume = (paidRows ?? []).reduce((sum, row) => sum + Number(row.amount), 0)
  const lastPaidAt = paidRows?.[0]?.paid_at ?? null
  const archivedRevenue = (archivedStats ?? []).reduce((s, r) => s + Number(r.revenue_total), 0)

  return {
    paidPaymentsCount: paidCount ?? 0,
    paidVolume,
    ordersCount: ordersCount ?? 0,
    auditEventsCount: auditCount ?? 0,
    lastPaidAt,
    archivedRevenue,
    archivedMonths: archivedStats?.length ?? 0,
  }
}

export type FinancialAuditQuery = {
  limit?: number
  entityType?: FinancialEntityType | 'all'
  from?: string
  to?: string
  confirmationCode?: string
}

export async function fetchFinancialAuditEventsForExport(
  admin: SupabaseClient,
  restaurantId: string,
  options: FinancialAuditQuery = {},
): Promise<FinancialAuditEventDto[]> {
  const limit = Math.min(options.limit ?? 5000, 5000)
  let query = admin
    .from('financial_audit_events')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (options.entityType && options.entityType !== 'all') {
    query = query.eq('entity_type', options.entityType)
  }
  if (options.from) {
    query = query.gte('created_at', options.from)
  }
  if (options.to) {
    query = query.lte('created_at', options.to)
  }
  if (options.confirmationCode?.trim()) {
    const code = options.confirmationCode.trim()
    query = query.or(
      `payload->new->>confirmation_code.eq.${code},payload->old->>confirmation_code.eq.${code}`,
    )
  }

  const { data: rows, error } = await query
  if (error || !rows?.length) return []

  return rows.map(row => mapAuditRow(row))
}

function mapAuditRow(row: Record<string, unknown>): FinancialAuditEventDto {
  const eventType = row.event_type as FinancialEventType
  const payload = row.payload as Record<string, unknown> | null
  return {
    id: row.id as string,
    entityType: row.entity_type as FinancialEntityType,
    entityId: row.entity_id as string,
    eventType,
    eventLabel: EVENT_LABELS[eventType] ?? eventType,
    restaurantId: row.restaurant_id as string | null,
    sessionId: row.session_id as string | null,
    customerId: row.customer_id as string | null,
    previousStatus: row.previous_status as string | null,
    newStatus: row.new_status as string | null,
    integrityHash: row.integrity_hash as string,
    createdAt: row.created_at as string,
    amount: payloadAmount(payload),
    method: payloadField(payload, 'method'),
    confirmationCode: payloadField(payload, 'confirmation_code'),
  }
}

export async function fetchFinancialAuditEvents(
  admin: SupabaseClient,
  restaurantId: string,
  options: FinancialAuditQuery = {},
): Promise<FinancialAuditEventDto[]> {
  const limit = options.limit ?? 50
  let query = admin
    .from('financial_audit_events')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (options.entityType && options.entityType !== 'all') {
    query = query.eq('entity_type', options.entityType)
  }
  if (options.from) {
    query = query.gte('created_at', options.from)
  }
  if (options.to) {
    query = query.lte('created_at', options.to)
  }
  if (options.confirmationCode?.trim()) {
    const code = options.confirmationCode.trim()
    query = query.or(
      `payload->new->>confirmation_code.eq.${code},payload->old->>confirmation_code.eq.${code}`,
    )
  }

  const { data: rows, error } = await query
  if (error || !rows?.length) return []

  return rows.map(row => mapAuditRow(row))
}
