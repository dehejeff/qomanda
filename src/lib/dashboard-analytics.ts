import type { SupabaseClient } from '@supabase/supabase-js'
import { RESTAURANT_TZ } from '@/lib/date-tz'
import {
  resolvePeriodRange,
  buildDailySeries,
  type ReportPeriod,
  type ReportData,
  type PaymentRow,
  type OrderRow,
} from '@/lib/dashboard-reports'

export type TopItem = { name: string; quantity: number; revenue: number }
export type HourPoint = { hour: number; revenue: number; orders: number }
export type WeekdayPoint = { weekday: number; revenue: number; orders: number }
export type MethodPoint = { method: string; count: number; amount: number }

export type AnalyticsData = ReportData & {
  topItems: TopItem[]
  byHour: HourPoint[]      // 24 posições (0..23), fuso do restaurante
  byWeekday: WeekdayPoint[] // 7 posições (0=Dom..6=Sáb)
  byMethod: MethodPoint[]
  peakHour: number | null
  peakWeekday: number | null
}

export const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const METHOD_LABELS: Record<string, string> = {
  pix: 'PIX', credit: 'Crédito', debit: 'Débito', cash: 'Dinheiro', offer: 'Oferta',
}

// Hora/dia-da-semana no fuso do restaurante (Vercel roda em UTC).
const hourFmt = new Intl.DateTimeFormat('en-US', { timeZone: RESTAURANT_TZ, hour: '2-digit', hourCycle: 'h23' })
const wdFmt = new Intl.DateTimeFormat('en-US', { timeZone: RESTAURANT_TZ, weekday: 'short' })
const WD_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function brHour(iso: string): number {
  const h = Number(hourFmt.format(new Date(iso)))
  return Number.isFinite(h) ? h % 24 : 0
}
function brWeekday(iso: string): number {
  return WD_INDEX[wdFmt.format(new Date(iso))] ?? 0
}

type ItemRow = {
  quantity: number
  unit_price: number
  menu_item: { name?: string } | { name?: string }[] | null
}

export async function fetchAnalyticsData(
  supabase: SupabaseClient,
  restaurantId: string,
  period: ReportPeriod,
): Promise<AnalyticsData> {
  const range = resolvePeriodRange(period)
  const startIso = range.start.toISOString()
  const endIso = range.end.toISOString()

  const [paymentsRes, ordersRes, itemsRes] = await Promise.all([
    supabase
      .from('payments')
      .select('amount, paid_at, created_at, method')
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
    // Itens mais vendidos — join interno com orders (filtro no recurso embutido).
    supabase
      .from('order_items')
      .select('quantity, unit_price, menu_item:menu_items(name), order:orders!inner(restaurant_id, status, created_at)')
      .eq('order.restaurant_id', restaurantId)
      .neq('order.status', 'cancelled')
      .gte('order.created_at', startIso)
      .lt('order.created_at', endIso),
  ])

  const payments = (paymentsRes.data ?? []) as PaymentRow[]
  const orders = (ordersRes.data ?? []) as OrderRow[]
  const items = (itemsRes.data ?? []) as unknown as ItemRow[]

  const validOrders = orders.filter(o => o.status !== 'cancelled')
  const revenue = payments.reduce((a, p) => a + Number(p.amount), 0)
  const paymentCount = payments.length
  const avgTicket = paymentCount > 0 ? revenue / paymentCount : 0

  // Por hora e por dia da semana
  const byHour: HourPoint[] = Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: 0, orders: 0 }))
  const byWeekday: WeekdayPoint[] = Array.from({ length: 7 }, (_, weekday) => ({ weekday, revenue: 0, orders: 0 }))

  for (const p of payments) {
    const iso = p.paid_at ?? p.created_at
    byHour[brHour(iso)].revenue += Number(p.amount)
    byWeekday[brWeekday(iso)].revenue += Number(p.amount)
  }
  for (const o of validOrders) {
    byHour[brHour(o.created_at)].orders += 1
    byWeekday[brWeekday(o.created_at)].orders += 1
  }

  // Métodos de pagamento
  const methodMap = new Map<string, MethodPoint>()
  for (const p of payments) {
    const m = p.method ?? 'desconhecido'
    const cur = methodMap.get(m) ?? { method: m, count: 0, amount: 0 }
    cur.count += 1
    cur.amount += Number(p.amount)
    methodMap.set(m, cur)
  }
  const byMethod = Array.from(methodMap.values()).sort((a, b) => b.amount - a.amount)

  // Itens mais vendidos (por quantidade)
  const itemMap = new Map<string, TopItem>()
  for (const it of items) {
    const miRaw = it.menu_item
    const mi = Array.isArray(miRaw) ? miRaw[0] : miRaw
    const name = mi?.name ?? 'Item removido'
    const cur = itemMap.get(name) ?? { name, quantity: 0, revenue: 0 }
    cur.quantity += Number(it.quantity)
    cur.revenue += Number(it.quantity) * Number(it.unit_price)
    itemMap.set(name, cur)
  }
  const topItems = Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 8)

  const peakHour = byHour.some(h => h.revenue > 0 || h.orders > 0)
    ? byHour.reduce((best, h) => (h.revenue > byHour[best].revenue ? h.hour : best), 0)
    : null
  const peakWeekday = byWeekday.some(w => w.revenue > 0 || w.orders > 0)
    ? byWeekday.reduce((best, w) => (w.revenue > byWeekday[best].revenue ? w.weekday : best), 0)
    : null

  return {
    revenue,
    orderCount: validOrders.length,
    paymentCount,
    avgTicket,
    daily: buildDailySeries(range, payments, orders),
    topItems,
    byHour,
    byWeekday,
    byMethod,
    peakHour,
    peakWeekday,
  }
}
