import type { SupabaseClient } from '@supabase/supabase-js'
import { SETTLE_TOLERANCE, ordersSubtotal } from '@/lib/session-billing'
import type { Order } from '@/types'

export type WaiterLoyaltyAlert = {
  offerId: string
  customerId: string
  customerName: string
  tableNumber: string
  sessionId: string
  label: string
  benefitType: string
  benefitValue: string
  status: 'active' | 'redeemed'
}

export async function fetchWaiterLoyaltyAlerts(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<WaiterLoyaltyAlert[]> {
  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id,
      table:tables ( number )
    `)
    .eq('restaurant_id', restaurantId)
    .in('status', ['open', 'closing'])

  if (!sessions?.length) return []

  const sessionIds = sessions.map(s => s.id)
  const sessionTable = new Map<string, string>()
  for (const s of sessions) {
    const tableRaw = (s as { table?: { number?: string } | { number?: string }[] }).table
    const table = Array.isArray(tableRaw) ? tableRaw[0] : tableRaw
    sessionTable.set(s.id, table?.number ?? '?')
  }

  const { data: participants } = await supabase
    .from('session_participants')
    .select(`
      session_id,
      customer_id,
      customer:customers ( first_name, last_name )
    `)
    .in('session_id', sessionIds)

  if (!participants?.length) return []

  const customerIds = [...new Set(participants.map(p => p.customer_id))]
  const customerSession = new Map<string, { sessionId: string; name: string; tableNumber: string }>()
  for (const p of participants) {
    const cRaw = (p as { customer?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] }).customer
    const c = Array.isArray(cRaw) ? cRaw[0] : cRaw
    const name = c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : 'Cliente'
    customerSession.set(p.customer_id, {
      sessionId: p.session_id,
      name: name || 'Cliente',
      tableNumber: sessionTable.get(p.session_id) ?? '?',
    })
  }

  const now = new Date().toISOString()

  const [activeRes, redeemedRes] = await Promise.all([
    supabase
      .from('customer_offers')
      .select('id, customer_id, label, benefit_type, benefit_value, status, redeemed_session_id, expires_at')
      .eq('restaurant_id', restaurantId)
      .in('customer_id', customerIds)
      .eq('status', 'active'),
    supabase
      .from('customer_offers')
      .select('id, customer_id, label, benefit_type, benefit_value, status, redeemed_session_id, expires_at')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'redeemed')
      .in('redeemed_session_id', sessionIds),
  ])

  const offers = [...(activeRes.data ?? []), ...(redeemedRes.data ?? [])]

  const alerts: WaiterLoyaltyAlert[] = []

  for (const offer of offers ?? []) {
    if (offer.status === 'active' && offer.expires_at && offer.expires_at < now) continue

    const ctx = customerSession.get(offer.customer_id)
    if (!ctx) continue

    if (offer.status === 'redeemed') {
      if (!sessionIds.includes(offer.redeemed_session_id as string)) continue
    }

    alerts.push({
      offerId: offer.id,
      customerId: offer.customer_id,
      customerName: ctx.name,
      tableNumber: ctx.tableNumber,
      sessionId: offer.status === 'redeemed'
        ? (offer.redeemed_session_id as string)
        : ctx.sessionId,
      label: offer.label,
      benefitType: offer.benefit_type,
      benefitValue: offer.benefit_value,
      status: offer.status as 'active' | 'redeemed',
    })
  }

  return alerts.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1
    return a.tableNumber.localeCompare(b.tableNumber, 'pt-BR', { numeric: true })
  })
}

export async function sessionOrdersSubtotal(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<number> {
  const { data: orders } = await supabase
    .from('orders')
    .select('status, items:order_items(unit_price, quantity)')
    .eq('session_id', sessionId)

  return ordersSubtotal((orders ?? []) as Order[])
}

export type CloseSessionResult =
  | { action: 'closed'; message: string }
  | { action: 'closing'; message: string }
  | { action: 'already_closing'; message: string }

/** Solicita fechamento ou encerra mesa sem consumo (mesma lógica do dashboard). */
export async function requestWaiterSessionClose(
  supabase: SupabaseClient,
  sessionId: string,
  restaurantId: string,
): Promise<CloseSessionResult> {
  const { data: session } = await supabase
    .from('sessions')
    .select('id, status, restaurant_id')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session || session.restaurant_id !== restaurantId) {
    throw new Error('Sessão não encontrada.')
  }

  if (session.status === 'closed') {
    return { action: 'closed', message: 'Mesa já encerrada.' }
  }

  if (session.status === 'closing') {
    return { action: 'already_closing', message: 'Cliente já foi avisado para pagar.' }
  }

  const total = await sessionOrdersSubtotal(supabase, sessionId)
  const hasNothingToPay = total <= SETTLE_TOLERANCE

  if (hasNothingToPay) {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'closed', closed_at: now })
      .eq('id', sessionId)
      .in('status', ['open', 'closing'])

    if (error) throw new Error('Erro ao encerrar mesa.')

    try {
      const { notifyWaitlistOnTableFree } = await import('@/lib/waitlist')
      const { data: s } = await supabase.from('sessions').select('table_id').eq('id', sessionId).maybeSingle()
      await notifyWaitlistOnTableFree(supabase, s?.table_id)
    } catch { /* best-effort */ }

    return { action: 'closed', message: 'Mesa encerrada (sem consumo).' }
  }

  const { error } = await supabase
    .from('sessions')
    .update({ status: 'closing' })
    .eq('id', sessionId)
    .eq('status', 'open')

  if (error) throw new Error('Erro ao solicitar fechamento.')

  return { action: 'closing', message: 'Cliente avisado para pagar a conta.' }
}
