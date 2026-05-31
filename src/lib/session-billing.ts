import type { Order } from '@/types'

export const SERVICE_FEE_RATE = 0.1
export const SETTLE_TOLERANCE = 0.02

export type PaymentRow = {
  customer_id: string | null
  amount: number
  service_fee_included?: boolean | null
}

export type CustomerBilling = {
  customerId: string
  subtotal: number
  amountDueWithFee: number
  amountDueWithoutFee: number
  /** Escolha de taxa: true/false se já pagou ou declarou; null = ainda não escolheu */
  serviceFeeIncluded: boolean | null
  /** Obrigação atual (com taxa se ainda não escolheu — projeção para o restaurante) */
  amountDue: number
  paid: number
  remaining: number
  status: 'paid' | 'partial' | 'pending'
}

export function roundMoney(n: number) {
  return Math.round(n * 100) / 100
}

export function isBillableOrder(order: Pick<Order, 'status'>) {
  return order.status !== 'cancelled'
}

export function orderSubtotal(order: Order) {
  return (order.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0)
}

export function ordersSubtotal(orders: Order[]) {
  return orders.filter(isBillableOrder).reduce((s, o) => s + orderSubtotal(o), 0)
}

export function customerOrdersSubtotal(orders: Order[], customerId: string) {
  return ordersSubtotal(orders.filter(o => o.customer_id === customerId))
}

export function amountWithServiceFee(subtotal: number, includeFee: boolean) {
  return roundMoney(subtotal * (includeFee ? 1 + SERVICE_FEE_RATE : 1))
}

/** Converte pagamentos em crédito sobre o subtotal (desconta taxa se incluída). */
export function paymentSubtotalCredit(payments: PaymentRow[]): number {
  return roundMoney(
    payments.reduce((sum, p) => {
      const incl = p.service_fee_included !== false
      const amt = Number(p.amount)
      return sum + (incl ? amt / (1 + SERVICE_FEE_RATE) : amt)
    }, 0),
  )
}

export function computeOpenBalance(
  consumptionSubtotal: number,
  payments: PaymentRow[],
  includeServiceFee: boolean,
) {
  const credited = paymentSubtotalCredit(payments)
  const openSubtotal = Math.max(0, roundMoney(consumptionSubtotal - credited))
  const openTotal = amountWithServiceFee(openSubtotal, includeServiceFee)
  return { openSubtotal, openTotal, credited }
}

type OrderLineItem = {
  unit_price: number
  quantity: number
  menu_item?: {
    name?: string
    contains_alcohol?: boolean
    category?: { name?: string } | null
  } | null
}

/** Itens ainda não cobertos pelos pagamentos (FIFO). */
export function unpaidOrderLineItems(
  orders: Order[],
  payments: PaymentRow[],
): OrderLineItem[] {
  const sorted = [...orders]
    .filter(isBillableOrder)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  let creditLeft = paymentSubtotalCredit(payments)
  const unpaid: OrderLineItem[] = []

  for (const order of sorted) {
    for (const item of order.items ?? []) {
      const lineTotal = item.unit_price * item.quantity

      if (creditLeft >= lineTotal - SETTLE_TOLERANCE) {
        creditLeft = roundMoney(creditLeft - lineTotal)
        continue
      }

      if (creditLeft > 0.01) {
        const remaining = roundMoney(lineTotal - creditLeft)
        creditLeft = 0
        unpaid.push({
          unit_price: roundMoney(remaining / item.quantity),
          quantity: item.quantity,
          menu_item: item.menu_item as OrderLineItem['menu_item'],
        })
        continue
      }

      unpaid.push({
        unit_price: item.unit_price,
        quantity: item.quantity,
        menu_item: item.menu_item as OrderLineItem['menu_item'],
      })
    }
  }

  return unpaid
}

/** Infere opt-in de taxa a partir de pagamentos explícitos ou do valor pago. */
export function resolveServiceFeeIncluded(
  subtotal: number,
  paid: number,
  explicitFlags: (boolean | null | undefined)[],
): boolean | null {
  const explicit = explicitFlags.find(f => f === true || f === false)
  if (explicit === true || explicit === false) return explicit

  if (paid <= 0.01 || subtotal <= 0.01) return null

  const withFee = amountWithServiceFee(subtotal, true)
  const withoutFee = amountWithServiceFee(subtotal, false)

  if (paid >= withFee - SETTLE_TOLERANCE) return true
  if (paid <= withoutFee + SETTLE_TOLERANCE) return false
  return null
}

export function buildCustomerBilling(
  customerId: string,
  subtotal: number,
  paid: number,
  feeFlags: (boolean | null | undefined)[] = [],
): CustomerBilling {
  const amountDueWithFee = amountWithServiceFee(subtotal, true)
  const amountDueWithoutFee = amountWithServiceFee(subtotal, false)
  const serviceFeeIncluded = resolveServiceFeeIncluded(subtotal, paid, feeFlags)

  const amountDue =
    serviceFeeIncluded === false ? amountDueWithoutFee : amountDueWithFee

  const remaining = Math.max(0, roundMoney(amountDue - paid))

  let status: CustomerBilling['status'] = 'pending'
  if (subtotal <= 0.01) status = 'pending'
  else if (remaining <= SETTLE_TOLERANCE) status = 'paid'
  else if (paid > 0.01) status = 'partial'

  return {
    customerId,
    subtotal,
    amountDueWithFee,
    amountDueWithoutFee,
    serviceFeeIncluded,
    amountDue,
    paid: roundMoney(paid),
    remaining,
    status,
  }
}

export function buildSessionBilling(
  orders: Order[],
  payments: PaymentRow[],
  participantIds: string[],
): {
  billings: CustomerBilling[]
  grandTotal: number
  grandTotalMinimum: number
  totalPaid: number
  remaining: number
} {
  const paidByCustomer = new Map<string, number>()
  const feeFlagsByCustomer = new Map<string, (boolean | null | undefined)[]>()

  for (const p of payments) {
    if (!p.customer_id) continue
    paidByCustomer.set(
      p.customer_id,
      (paidByCustomer.get(p.customer_id) ?? 0) + Number(p.amount),
    )
    const flags = feeFlagsByCustomer.get(p.customer_id) ?? []
    flags.push(p.service_fee_included)
    feeFlagsByCustomer.set(p.customer_id, flags)
  }

  const ids = participantIds.length > 0
    ? participantIds
    : [...new Set(orders.map(o => o.customer_id).filter(Boolean) as string[])]

  const billings = ids.map(customerId => {
    const subtotal = customerOrdersSubtotal(orders, customerId)
    const paid = paidByCustomer.get(customerId) ?? 0
    const flags = feeFlagsByCustomer.get(customerId) ?? []
    return buildCustomerBilling(customerId, subtotal, paid, flags)
  })

  const grandTotal = roundMoney(billings.reduce((s, b) => s + b.amountDue, 0))
  const grandTotalMinimum = roundMoney(
    billings.reduce((s, b) => s + b.amountDueWithoutFee, 0),
  )
  const totalPaid = roundMoney(payments.reduce((s, p) => s + Number(p.amount), 0))
  const remaining = Math.max(0, roundMoney(grandTotal - totalPaid))

  return { billings, grandTotal, grandTotalMinimum, totalPaid, remaining }
}

export function payStatusLabel(status: CustomerBilling['status']) {
  if (status === 'paid') return 'paid'
  if (status === 'partial') return 'partial'
  return 'pending'
}

export type OrderPaymentAllocation = {
  order: Order
  paymentStatus: 'cancelled' | 'paid' | 'partial' | 'pending'
  amountDue: number
  paidAmount: number
}

/** Distribui o pagamento do cliente entre pedidos (FIFO por data). */
export function allocatePaymentToOrders(
  orders: Order[],
  billing: CustomerBilling,
): OrderPaymentAllocation[] {
  const sorted = [...orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
  let paidLeft = billing.paid

  return sorted.map(order => {
    if (!isBillableOrder(order)) {
      return { order, paymentStatus: 'cancelled' as const, amountDue: 0, paidAmount: 0 }
    }

    const sub = orderSubtotal(order)
    const amountDue = billing.subtotal > 0
      ? roundMoney(billing.amountDue * (sub / billing.subtotal))
      : 0

    if (paidLeft >= amountDue - SETTLE_TOLERANCE) {
      paidLeft = roundMoney(paidLeft - amountDue)
      return { order, paymentStatus: 'paid' as const, amountDue, paidAmount: amountDue }
    }

    if (paidLeft > 0.01) {
      const applied = paidLeft
      paidLeft = 0
      return { order, paymentStatus: 'partial' as const, amountDue, paidAmount: applied }
    }

    return { order, paymentStatus: 'pending' as const, amountDue, paidAmount: 0 }
  })
}

export type ItemPaymentLine = {
  orderId: string
  itemKey: string
  name: string
  quantity: number
  lineTotal: number
  paymentStatus: 'cancelled' | 'paid' | 'partial' | 'pending'
}

/** Distribui pagamento do cliente linha a linha (FIFO por pedido/item). */
export function allocatePaymentToItemLines(
  orders: Order[],
  billing: CustomerBilling,
): ItemPaymentLine[] {
  const sortedOrders = [...orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  const lines: ItemPaymentLine[] = []
  for (const order of sortedOrders) {
    for (const [i, item] of (order.items ?? []).entries()) {
      const lineTotal = item.unit_price * item.quantity
      lines.push({
        orderId: order.id,
        itemKey: `${order.id}-${(item as { id?: string }).id ?? i}`,
        name: item.menu_item?.name ?? 'Item',
        quantity: item.quantity,
        lineTotal,
        paymentStatus: isBillableOrder(order) ? 'pending' : 'cancelled',
      })
    }
  }

  if (billing.subtotal <= 0.01) return lines

  let paidLeft = billing.paid
  return lines.map(line => {
    if (line.paymentStatus === 'cancelled') return line

    const amountDue = roundMoney(billing.amountDue * (line.lineTotal / billing.subtotal))

    if (paidLeft >= amountDue - SETTLE_TOLERANCE) {
      paidLeft = roundMoney(paidLeft - amountDue)
      return { ...line, paymentStatus: 'paid' }
    }
    if (paidLeft > 0.01) {
      paidLeft = 0
      return { ...line, paymentStatus: 'partial' }
    }
    return { ...line, paymentStatus: 'pending' }
  })
}
