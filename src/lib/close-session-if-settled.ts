import type { SupabaseClient } from '@supabase/supabase-js'

const SERVICE_FEE = 1.1
const SETTLE_TOLERANCE = 0.02

export type SessionSettlement = {
  closed: boolean
  grandTotal: number
  totalPaid: number
  remaining: number
  tableId?: string
}

/** Soma pedidos não cancelados + taxa de serviço (10%). */
export async function sessionBalance(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<{ grandTotal: number; totalPaid: number; remaining: number }> {
  const { data: orders } = await supabase
    .from('orders')
    .select('status, items:order_items(unit_price, quantity)')
    .eq('session_id', sessionId)

  const subtotal = (orders ?? [])
    .filter(o => o.status !== 'cancelled')
    .flatMap(o => o.items ?? [])
    .reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0)

  const grandTotal = Math.round(subtotal * SERVICE_FEE * 100) / 100

  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .eq('session_id', sessionId)
    .eq('status', 'paid')

  const totalPaid = Math.round(
    (payments ?? []).reduce((s, p) => s + Number(p.amount), 0) * 100,
  ) / 100

  return {
    grandTotal,
    totalPaid,
    remaining: Math.max(0, Math.round((grandTotal - totalPaid) * 100) / 100),
  }
}

/**
 * Fecha a sessão quando o total pago cobre a conta da mesa.
 * O trigger fn_session_table_status libera a mesa (status → free).
 */
export async function closeSessionIfSettled(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<SessionSettlement> {
  const { data: session } = await supabase
    .from('sessions')
    .select('id, table_id, status')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session || session.status === 'closed') {
    const balance = await sessionBalance(supabase, sessionId)
    return { closed: false, ...balance, tableId: session?.table_id }
  }

  const balance = await sessionBalance(supabase, sessionId)

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

  return { closed: true, ...balance, remaining: 0, tableId: session.table_id }
}
