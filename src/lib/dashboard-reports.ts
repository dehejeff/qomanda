import type { SupabaseClient } from '@supabase/supabase-js'
import { startOfBrDay, startOfBrMonth, brDayKey } from '@/lib/date-tz'

export type ReportPeriod = 'today' | 'week' | 'fortnight' | 'month' | 'last_month'

export const PERIOD_OPTIONS: { id: ReportPeriod; label: string }[] = [
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

/** Calcula o intervalo [start, end) para o período, no fuso do restaurante (Brasil). */
export function resolvePeriodRange(period: ReportPeriod, now = new Date()): ReportRange {
  const startOfToday = startOfBrDay(0, now)
  const endOfToday = startOfBrDay(-1, now) // amanhã à meia-noite (Brasil)

  switch (period) {
    case 'today':
      return { start: startOfToday, end: endOfToday, label: 'Hoje' }

    case 'week':
      return { start: startOfBrDay(6, now), end: endOfToday, label: 'Últimos 7 dias' }

    case 'fortnight':
      return { start: startOfBrDay(14, now), end: endOfToday, label: 'Últimos 15 dias' }

    case 'month':
      return { start: startOfBrMonth(0, now), end: endOfToday, label: 'Mês atual' }

    case 'last_month':
      return { start: startOfBrMonth(1, now), end: startOfBrMonth(0, now), label: 'Mês anterior' }
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

function buildDailySeries(range: ReportRange, payments: PaymentRow[], orders: OrderRow[]): DailyPoint[] {
  const byDay = new Map<string, DailyPoint>()

  // Inicializa todos os dias do intervalo com zero (eixo contínuo), no fuso do Brasil.
  let cursorMs = range.start.getTime()
  while (cursorMs < range.end.getTime()) {
    const key = brDayKey(new Date(cursorMs).toISOString())
    byDay.set(key, { date: key, revenue: 0, orders: 0 })
    cursorMs += 86_400_000
  }

  for (const p of payments) {
    const key = brDayKey(p.paid_at ?? p.created_at)
    const point = byDay.get(key)
    if (point) point.revenue += Number(p.amount)
  }

  for (const o of orders) {
    if (o.status === 'cancelled') continue
    const key = brDayKey(o.created_at)
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
      .neq('method', 'offer')
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
