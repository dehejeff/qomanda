import type { SupabaseClient } from '@supabase/supabase-js'

export type ReportPeriod = 'today' | 'week' | 'fortnight' | 'month' | 'last_month'

export const PERIOD_OPTIONS: { id: ReportPeriod; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Semana' },
  { id: 'fortnight', label: 'Quinzena' },
  { id: 'month', label: 'Mês' },
  { id: 'last_month', label: 'Mês anterior' },
]

export type ReportRange = {
  start: Date
  end: Date
  label: string
}

/** Calcula o intervalo [start, end) para o período escolhido, com base na data atual. */
export function resolvePeriodRange(period: ReportPeriod, now = new Date()): ReportRange {
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  const endOfToday = new Date(startOfToday)
  endOfToday.setDate(endOfToday.getDate() + 1)

  switch (period) {
    case 'today':
      return { start: startOfToday, end: endOfToday, label: 'Hoje' }

    case 'week': {
      const start = new Date(startOfToday)
      start.setDate(start.getDate() - 6) // últimos 7 dias (inclui hoje)
      return { start, end: endOfToday, label: 'Últimos 7 dias' }
    }

    case 'fortnight': {
      const start = new Date(startOfToday)
      start.setDate(start.getDate() - 14) // últimos 15 dias
      return { start, end: endOfToday, label: 'Últimos 15 dias' }
    }

    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      return { start, end: endOfToday, label: 'Mês atual' }
    }

    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      return { start, end, label: 'Mês anterior' }
    }
  }
}

export type DailyPoint = {
  date: string // YYYY-MM-DD
  revenue: number
  orders: number
}

export type ReportData = {
  revenue: number
  orderCount: number
  paymentCount: number
  avgTicket: number
  daily: DailyPoint[]
}

type PaymentRow = { amount: number; paid_at: string | null; created_at: string }
type OrderRow = { id: string; status: string; created_at: string }

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA') // YYYY-MM-DD no fuso local
}

function buildDailySeries(range: ReportRange, payments: PaymentRow[], orders: OrderRow[]): DailyPoint[] {
  const byDay = new Map<string, DailyPoint>()

  // Inicializa todos os dias do intervalo com zero (eixo contínuo).
  const cursor = new Date(range.start)
  while (cursor < range.end) {
    const key = cursor.toLocaleDateString('en-CA')
    byDay.set(key, { date: key, revenue: 0, orders: 0 })
    cursor.setDate(cursor.getDate() + 1)
  }

  for (const p of payments) {
    const key = dayKey(p.paid_at ?? p.created_at)
    const point = byDay.get(key)
    if (point) point.revenue += Number(p.amount)
  }

  for (const o of orders) {
    if (o.status === 'cancelled') continue
    const key = dayKey(o.created_at)
    const point = byDay.get(key)
    if (point) point.orders += 1
  }

  return Array.from(byDay.values())
}

export async function fetchReportData(
  supabase: SupabaseClient,
  restaurantId: string,
  period: ReportPeriod,
): Promise<ReportData> {
  const range = resolvePeriodRange(period)
  const startIso = range.start.toISOString()
  const endIso = range.end.toISOString()

  const [paymentsRes, ordersRes] = await Promise.all([
    supabase
      .from('payments')
      .select('amount, paid_at, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'paid')
      .gte('paid_at', startIso)
      .lt('paid_at', endIso),
    supabase
      .from('orders')
      .select('id, status, created_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', startIso)
      .lt('created_at', endIso),
  ])

  const payments = (paymentsRes.data ?? []) as PaymentRow[]
  const orders = (ordersRes.data ?? []) as OrderRow[]

  const revenue = payments.reduce((a, p) => a + Number(p.amount), 0)
  const validOrders = orders.filter(o => o.status !== 'cancelled')
  const orderCount = validOrders.length
  const paymentCount = payments.length
  const avgTicket = paymentCount > 0 ? revenue / paymentCount : 0

  return {
    revenue,
    orderCount,
    paymentCount,
    avgTicket,
    daily: buildDailySeries(range, payments, orders),
  }
}
