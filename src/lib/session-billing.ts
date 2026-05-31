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
