import type { Order } from '@/types'

export const SERVICE_FEE_RATE = 0.1
export const SETTLE_TOLERANCE = 0.02

export type PaymentRow = {
  customer_id: string | null
  amount: number
  service_fee_included?: boolean | null
  paid_at?: string | null
  created_at?: string
}

export type PaymentCoverage = {
  payerId: string
  amount: number
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
  /** Valor pago pelo próprio cliente */
  paidBySelf: number
  /** Pagamentos de outras pessoas que cobriram esta conta */
  coveredBy: PaymentCoverage[]
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
    paidBySelf: roundMoney(paid),
    coveredBy: [],
  }
}

function paymentTime(p: PaymentRow) {
  return new Date(p.paid_at ?? p.created_at ?? 0).getTime()
}

/** Distribui pagamentos da mesa entre participantes (excedente de um cobre outros). */
export function allocateSessionPayments(
  orders: Order[],
  payments: PaymentRow[],
  participantIds: string[],
): {
  paidBySelf: Map<string, number>
  coveredBy: Map<string, PaymentCoverage[]>
  debtsRemaining: Map<string, number>
} {
  const ids = participantIds.length > 0
    ? participantIds
    : [...new Set(orders.map(o => o.customer_id).filter(Boolean) as string[])]

  const debtsRemaining = new Map<string, number>()
  for (const id of ids) {
    const subtotal = customerOrdersSubtotal(orders, id)
    const selfFlags = payments.filter(p => p.customer_id === id).map(p => p.service_fee_included)
    const obligation = buildCustomerBilling(id, subtotal, 0, selfFlags)
    debtsRemaining.set(id, obligation.amountDue)
  }

  const paidBySelf = new Map<string, number>()
  const coveredBy = new Map<string, PaymentCoverage[]>()
  for (const id of ids) {
    paidBySelf.set(id, 0)
    coveredBy.set(id, [])
  }

  const sorted = [...payments].sort((a, b) => paymentTime(a) - paymentTime(b))

  for (const payment of sorted) {
    const payerId = payment.customer_id
    if (!payerId) continue

    let left = Number(payment.amount)
    const applyOrder = [payerId, ...ids.filter(id => id !== payerId)]

    for (const beneficiaryId of applyOrder) {
      if (left <= 0.01) break
      const debt = debtsRemaining.get(beneficiaryId) ?? 0
      if (debt <= 0.01) continue

      const applied = roundMoney(Math.min(left, debt))
      debtsRemaining.set(beneficiaryId, roundMoney(debt - applied))
      left = roundMoney(left - applied)

      if (beneficiaryId === payerId) {
        paidBySelf.set(payerId, roundMoney((paidBySelf.get(payerId) ?? 0) + applied))
      } else {
        const list = coveredBy.get(beneficiaryId) ?? []
        const existing = list.find(c => c.payerId === payerId)
        if (existing) existing.amount = roundMoney(existing.amount + applied)
        else list.push({ payerId, amount: applied })
        coveredBy.set(beneficiaryId, list)
      }
    }
  }

  return { paidBySelf, coveredBy, debtsRemaining }
}

/** Quanto de um pagamento cobriu contas de outros participantes. */
export function coverageFromPayment(
  orders: Order[],
  paymentsBefore: PaymentRow[],
  participantIds: string[],
  newPayment: PaymentRow,
): { beneficiaryId: string; amount: number }[] {
  const payerId = newPayment.customer_id
  if (!payerId) return []

  const ids = participantIds.length > 0
    ? participantIds
    : [...new Set(orders.map(o => o.customer_id).filter(Boolean) as string[])]

  const before = allocateSessionPayments(orders, paymentsBefore, ids)
  const debts = new Map(before.debtsRemaining)
  const coverage: { beneficiaryId: string; amount: number }[] = []

  let left = Number(newPayment.amount)
  const applyOrder = [payerId, ...ids.filter(id => id !== payerId)]

  for (const beneficiaryId of applyOrder) {
    if (left <= 0.01) break
    const debt = debts.get(beneficiaryId) ?? 0
    if (debt <= 0.01) continue

    const applied = roundMoney(Math.min(left, debt))
    debts.set(beneficiaryId, roundMoney(debt - applied))
    left = roundMoney(left - applied)

    if (beneficiaryId !== payerId && applied > 0.01) {
      coverage.push({ beneficiaryId, amount: applied })
    }
  }

  return coverage
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
  const ids = participantIds.length > 0
    ? participantIds
    : [...new Set(orders.map(o => o.customer_id).filter(Boolean) as string[])]

  const { paidBySelf, coveredBy } = allocateSessionPayments(orders, payments, ids)

  const billings = ids.map(customerId => {
    const subtotal = customerOrdersSubtotal(orders, customerId)
    const selfFlags = payments.filter(p => p.customer_id === customerId).map(p => p.service_fee_included)
    const selfPaid = paidBySelf.get(customerId) ?? 0
    const othersPaid = (coveredBy.get(customerId) ?? []).reduce((s, c) => s + c.amount, 0)
    const totalAllocated = roundMoney(selfPaid + othersPaid)
    const billing = buildCustomerBilling(customerId, subtotal, totalAllocated, selfFlags)
    return {
      ...billing,
      paidBySelf: selfPaid,
      coveredBy: coveredBy.get(customerId) ?? [],
    }
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
