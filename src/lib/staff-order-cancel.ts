import type { SupabaseClient } from '@supabase/supabase-js'
import type { Order } from '@/types'
import {
  SETTLE_TOLERANCE,
  allocateSessionPayments,
  billableItemQuantity,
  buildCustomerBilling,
  customerCouvertSubtotal,
  customerOrdersSubtotal,
  isBillableItem,
  orderSubtotal,
  roundMoney,
  type PaymentRow,
} from '@/lib/session-billing'

type OrderRow = Order & {
  session_id: string
  restaurant_id: string
  customer_id: string | null
}

function ordersWithItemPartialCancel(
  orders: Order[],
  orderItemId: string,
  cancelQty: number,
): Order[] {
  return orders.map(o => ({
    ...o,
    items: (o.items ?? []).map(item => {
      if (item.id !== orderItemId) return item
      const currentCancelled = item.cancelled_at
        ? item.quantity
        : Math.max(0, Number(item.cancelled_qty ?? 0))
      const newCancelledQty = Math.min(item.quantity, currentCancelled + cancelQty)
      const fullyCancelled = newCancelledQty >= item.quantity
      return {
        ...item,
        cancelled_qty: newCancelledQty,
        cancelled_at: fullyCancelled
          ? (item.cancelled_at ?? new Date().toISOString())
          : item.cancelled_at,
      }
    }),
  }))
}

function ordersWithOrderCancelled(orders: Order[], orderId: string): Order[] {
  const now = new Date().toISOString()
  return orders.map(o => {
    if (o.id !== orderId) return o
    return {
      ...o,
      status: 'cancelled' as const,
      items: (o.items ?? []).map(item => ({
        ...item,
        cancelled_qty: item.quantity,
        cancelled_at: item.cancelled_at ?? now,
      })),
    }
  })
}

/** Impede remover valor já coberto por pagamentos na sessão. */
export function canRemoveBillableSubtotal(
  ordersAfter: Order[],
  payments: PaymentRow[],
  customerId: string,
): { ok: true } | { ok: false; error: string } {
  const participantIds = [
    ...new Set(ordersAfter.map(o => o.customer_id).filter(Boolean) as string[]),
  ]
  const { paidBySelf, coveredBy } = allocateSessionPayments(ordersAfter, payments, participantIds)

  const selfPaid = paidBySelf.get(customerId) ?? 0
  const othersPaid = (coveredBy.get(customerId) ?? []).reduce((s, c) => s + c.amount, 0)
  const totalPaid = roundMoney(selfPaid + othersPaid)

  const subtotalAfter = customerOrdersSubtotal(ordersAfter, customerId)
  const couvertAfter = customerCouvertSubtotal(ordersAfter, customerId)
  const feeFlags = payments.filter(p => p.customer_id === customerId).map(p => p.service_fee_included)
  const billingAfter = buildCustomerBilling(customerId, subtotalAfter, totalPaid, feeFlags, couvertAfter)

  if (totalPaid > billingAfter.amountDue + SETTLE_TOLERANCE) {
    return {
      ok: false,
      error: 'Este valor já foi coberto por um pagamento. Faça estorno manual se necessário.',
    }
  }

  return { ok: true }
}

async function loadSessionBillingContext(
  admin: SupabaseClient,
  sessionId: string,
) {
  const [ordersRes, paymentsRes] = await Promise.all([
    admin
      .from('orders')
      .select('id, customer_id, status, created_at, session_id, restaurant_id, items:order_items(id, quantity, unit_price, cancelled_qty, cancelled_at, menu_item:menu_items(name, couvert_kind))')
      .eq('session_id', sessionId),
    admin
      .from('payments')
      .select('customer_id, amount, service_fee_included, paid_at, created_at')
      .eq('session_id', sessionId)
      .eq('status', 'paid'),
  ])

  return {
    orders: (ordersRes.data ?? []) as unknown as Order[],
    payments: (paymentsRes.data ?? []) as PaymentRow[],
  }
}

async function syncOrderStatusAfterItems(admin: SupabaseClient, orderId: string) {
  const { data: items } = await admin
    .from('order_items')
    .select('quantity, cancelled_qty, cancelled_at')
    .eq('order_id', orderId)

  const allCancelled = (items ?? []).length > 0 && (items ?? []).every(
    i => billableItemQuantity(i) === 0,
  )
  if (!allCancelled) return

  await admin
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .neq('status', 'cancelled')
}

export async function cancelOrderItemByStaff(
  admin: SupabaseClient,
  restaurantId: string,
  orderItemId: string,
  quantity = 1,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const cancelQty = Math.floor(Number(quantity))
  if (!Number.isFinite(cancelQty) || cancelQty < 1) {
    return { ok: false, error: 'Quantidade inválida.', status: 400 }
  }

  const { data: item } = await admin
    .from('order_items')
    .select('id, order_id, quantity, unit_price, cancelled_qty, cancelled_at, order:orders(id, customer_id, status, session_id, restaurant_id)')
    .eq('id', orderItemId)
    .maybeSingle()

  const order = (Array.isArray(item?.order) ? item.order[0] : item?.order) as OrderRow | null
  if (!item || !order || order.restaurant_id !== restaurantId) {
    return { ok: false, error: 'Item não encontrado.', status: 404 }
  }

  const remaining = billableItemQuantity(item)
  if (remaining <= 0) {
    return { ok: false, error: 'Este item já foi removido da conta.', status: 409 }
  }

  if (cancelQty > remaining) {
    return {
      ok: false,
      error: `Só restam ${remaining} unidade${remaining !== 1 ? 's' : ''} cobráve${remaining !== 1 ? 'is' : 'l'}.`,
      status: 400,
    }
  }

  if (order.status === 'cancelled') {
    return { ok: false, error: 'Pedido já cancelado.', status: 409 }
  }

  const { data: session } = await admin
    .from('sessions')
    .select('status')
    .eq('id', order.session_id)
    .maybeSingle()

  if (!session || !['open', 'closing'].includes(session.status)) {
    return { ok: false, error: 'Sessão encerrada — não é possível alterar a conta.', status: 409 }
  }

  const customerId = order.customer_id
  if (!customerId) {
    return { ok: false, error: 'Pedido sem cliente identificado.', status: 400 }
  }

  const { orders, payments } = await loadSessionBillingContext(admin, order.session_id)
  const simulated = ordersWithItemPartialCancel(orders, orderItemId, cancelQty)
  const check = canRemoveBillableSubtotal(simulated, payments, customerId)
  if (!check.ok) return { ok: false, error: check.error, status: 409 }

  const currentCancelled = item.cancelled_at
    ? item.quantity
    : Math.max(0, Number(item.cancelled_qty ?? 0))
  const newCancelledQty = currentCancelled + cancelQty
  const fullyCancelled = newCancelledQty >= item.quantity
  const now = new Date().toISOString()

  const { error } = await admin
    .from('order_items')
    .update({
      cancelled_qty: newCancelledQty,
      ...(fullyCancelled ? { cancelled_at: item.cancelled_at ?? now } : {}),
    })
    .eq('id', orderItemId)

  if (error) return { ok: false, error: 'Erro ao remover item da conta.', status: 500 }

  await syncOrderStatusAfterItems(admin, order.id)
  return { ok: true }
}

export async function cancelOrderByStaff(
  admin: SupabaseClient,
  restaurantId: string,
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: order } = await admin
    .from('orders')
    .select('id, customer_id, status, session_id, restaurant_id, items:order_items(id, quantity, unit_price, cancelled_qty, cancelled_at)')
    .eq('id', orderId)
    .maybeSingle()

  if (!order || order.restaurant_id !== restaurantId) {
    return { ok: false, error: 'Pedido não encontrado.', status: 404 }
  }

  if (order.status === 'cancelled') {
    return { ok: false, error: 'Pedido já cancelado.', status: 409 }
  }

  const removeAmount = orderSubtotal(order as Order)
  if (removeAmount <= 0.01) {
    return { ok: false, error: 'Não há valor em aberto neste pedido.', status: 409 }
  }

  const { data: session } = await admin
    .from('sessions')
    .select('status')
    .eq('id', order.session_id)
    .maybeSingle()

  if (!session || !['open', 'closing'].includes(session.status)) {
    return { ok: false, error: 'Sessão encerrada — não é possível alterar a conta.', status: 409 }
  }

  const customerId = order.customer_id
  if (!customerId) {
    return { ok: false, error: 'Pedido sem cliente identificado.', status: 400 }
  }

  const { orders, payments } = await loadSessionBillingContext(admin, order.session_id)
  const simulated = ordersWithOrderCancelled(orders, orderId)
  const check = canRemoveBillableSubtotal(simulated, payments, customerId)
  if (!check.ok) return { ok: false, error: check.error, status: 409 }

  const now = new Date().toISOString()
  const billableItems = ((order.items ?? []) as Order['items'])?.filter(isBillableItem) ?? []

  for (const line of billableItems) {
    const { error: itemErr } = await admin
      .from('order_items')
      .update({ cancelled_qty: line.quantity, cancelled_at: line.cancelled_at ?? now })
      .eq('id', line.id)
    if (itemErr) return { ok: false, error: 'Erro ao remover itens da conta.', status: 500 }
  }

  const { error } = await admin
    .from('orders')
    .update({ status: 'cancelled', updated_at: now })
    .eq('id', orderId)

  if (error) return { ok: false, error: 'Erro ao cancelar pedido.', status: 500 }

  return { ok: true }
}
