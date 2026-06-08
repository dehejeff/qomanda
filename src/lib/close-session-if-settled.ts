import type { SupabaseClient } from '@supabase/supabase-js'
import { buildSessionBilling, SETTLE_TOLERANCE } from '@/lib/session-billing'
import type { Order } from '@/types'

export type SessionSettlement = {
  closed: boolean
  grandTotal: number
  totalPaid: number
  remaining: number
  tableId?: string
}

/** Fecha a sessão quando o total pago cobre as obrigações individuais (taxa opcional por pessoa). */
export async function closeSessionIfSettled(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<SessionSettlement> {
  const { data: session } = await supabase
    .from('sessions')
    .select('id, table_id, status')
    .eq('id', sessionId)
    .maybeSingle()

  const balance = await sessionBalance(supabase, sessionId)

  if (!session || session.status === 'closed') {
    return { closed: false, ...balance, tableId: session?.table_id }
  }

  if (balance.totalPaid < balance.grandTotal - SETTLE_TOLERANCE) {
    return { closed: false, ...balance, tableId: session.table_id }
  }

  const now = new Date().toISOString()

  const { error: sessionError } = await supabase
    .from('sessions')
    .update({ status: 'closed', closed_at: now })
    .eq('id', sessionId)
    .in('status', ['open', 'closing'])

  if (sessionError) {
    console.error('[closeSessionIfSettled] session update', sessionError)
    return { closed: false, ...balance, tableId: session.table_id }
  }

  await supabase
    .from('close_requests')
    .update({ status: 'completed' })
    .eq('session_id', sessionId)
    .eq('status', 'pending')

  await supabase
    .from('orders')
    .update({ status: 'delivered' })
    .eq('session_id', sessionId)
    .not('status', 'in', '("cancelled","delivered")')

  console.log(`[closeSessionIfSettled] Sessão ${sessionId} fechada — mesa liberada`)

  // Mesa liberou → chama o próximo da fila de espera (best-effort).
  try {
    const { notifyWaitlistOnTableFree } = await import('@/lib/waitlist')
    await notifyWaitlistOnTableFree(supabase, session.table_id)
  } catch { /* não bloqueia o fechamento */ }

  return { closed: true, ...balance, remaining: 0, tableId: session.table_id }
}

export async function sessionBalance(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<{ grandTotal: number; totalPaid: number; remaining: number }> {
  const [ordersRes, paymentsRes, participantsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('customer_id, status, items:order_items(unit_price, quantity)')
      .eq('session_id', sessionId),
    supabase
      .from('payments')
      .select('customer_id, amount, service_fee_included')
      .eq('session_id', sessionId)
      .eq('status', 'paid'),
    supabase
      .from('session_participants')
      .select('customer_id')
      .eq('session_id', sessionId),
  ])

  const orders = (ordersRes.data ?? []) as Order[]
  const participantIds = (participantsRes.data ?? []).map(p => p.customer_id)

  const billing = buildSessionBilling(
    orders,
    paymentsRes.data ?? [],
    participantIds,
  )

  return {
    grandTotal: billing.grandTotal,
    totalPaid: billing.totalPaid,
    remaining: billing.remaining,
  }
}
