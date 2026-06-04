import type { SupabaseClient } from '@supabase/supabase-js'
import { brToday, brMidnight, startOfBrMonth } from '@/lib/date-tz'

export type BillingDerivedStatus = 'paid' | 'overdue' | 'due_soon' | 'open' | 'none' | 'cancelled'

export type BillingClientRow = {
  restaurantId: string
  name: string
  planName: string | null
  subscriptionStatus: string | null
  invoiceId: string | null
  amount: number | null
  dueDate: string | null
  paidAt: string | null
  invoiceUrl: string | null
  chargeMethod: string | null
  hasCharge: boolean
  status: BillingDerivedStatus
  daysOverdue: number
  daysToDue: number | null
}

export type InternalBillingData = {
  rows: BillingClientRow[]
  kpis: {
    openTotal: number       // soma das faturas não pagas (em aberto)
    openCount: number
    overdueTotal: number
    overdueCount: number
    paidThisMonthTotal: number
    paidThisMonthCount: number
    dueSoonCount: number
  }
}

const DUE_SOON_DAYS = 5

const STATUS_CSV_LABEL: Record<BillingDerivedStatus, string> = {
  overdue: 'Em atraso', due_soon: 'A vencer', open: 'Em aberto',
  paid: 'Paga', none: 'Sem fatura', cancelled: 'Cancelada',
}

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return ''
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Gera o CSV (com BOM p/ Excel) da visão de cobrança. */
export function buildBillingCsv(rows: BillingClientRow[]): string {
  const header = ['Cliente', 'Plano', 'Assinatura', 'Status', 'Dias em atraso', 'Valor', 'Vencimento', 'Pago em', 'Método', 'Cobrança emitida']
  const lines = rows.map(r => [
    r.name,
    r.planName ?? '',
    r.subscriptionStatus ?? '',
    STATUS_CSV_LABEL[r.status],
    r.status === 'overdue' ? r.daysOverdue : '',
    r.amount != null ? r.amount.toFixed(2).replace('.', ',') : '',
    r.dueDate ?? '',
    r.paidAt ? r.paidAt.slice(0, 10) : '',
    r.chargeMethod ?? '',
    r.hasCharge ? 'sim' : 'não',
  ].map(csvEscape).join(','))
  return '﻿' + [header.join(','), ...lines].join('\n')
}

function dayDiff(fromDateStr: string, toDateStr: string): number {
  return Math.round((brMidnight(toDateStr).getTime() - brMidnight(fromDateStr).getTime()) / 86_400_000)
}

/** Deriva o status de cobrança de uma fatura a partir das datas (fuso BR). */
export function deriveBillingStatus(
  invoice: { status: string; due_date: string | null; paid_at: string | null } | null,
  today: string,
): { status: BillingDerivedStatus; daysOverdue: number; daysToDue: number | null } {
  if (!invoice) return { status: 'none', daysOverdue: 0, daysToDue: null }
  if (invoice.status === 'paid') return { status: 'paid', daysOverdue: 0, daysToDue: null }
  if (invoice.status === 'cancelled') return { status: 'cancelled', daysOverdue: 0, daysToDue: null }

  if (!invoice.due_date) return { status: 'open', daysOverdue: 0, daysToDue: null }

  const diff = dayDiff(today, invoice.due_date) // dias até o vencimento (negativo = atrasado)
  if (diff < 0) return { status: 'overdue', daysOverdue: -diff, daysToDue: diff }
  if (diff <= DUE_SOON_DAYS) return { status: 'due_soon', daysOverdue: 0, daysToDue: diff }
  return { status: 'open', daysOverdue: 0, daysToDue: diff }
}

type InvoiceRow = {
  id: string; restaurant_id: string; amount: number; status: string
  due_date: string | null; paid_at: string | null; invoice_url: string | null
  charge_method: string | null; asaas_payment_id: string | null; created_at: string
}

/** Visão consolidada de cobrança de todos os clientes com assinatura. */
export async function fetchInternalBilling(admin: SupabaseClient): Promise<InternalBillingData> {
  const today = brToday()
  const monthStartIso = startOfBrMonth(0).toISOString()

  const [subsRes, invoicesRes] = await Promise.all([
    admin
      .from('restaurant_subscriptions')
      .select('restaurant_id, status, restaurant:restaurants(name), plan:plans(name)')
      .order('created_at', { ascending: true }),
    admin
      .from('billing_invoices')
      .select('id, restaurant_id, amount, status, due_date, paid_at, invoice_url, charge_method, asaas_payment_id, created_at')
      .order('created_at', { ascending: false }),
  ])

  const invoices = (invoicesRes.data ?? []) as InvoiceRow[]

  // Última fatura por restaurante (lista já vem desc por created_at).
  const latestByRestaurant = new Map<string, InvoiceRow>()
  for (const inv of invoices) {
    if (!latestByRestaurant.has(inv.restaurant_id)) latestByRestaurant.set(inv.restaurant_id, inv)
  }

  const rows: BillingClientRow[] = (subsRes.data ?? []).map(sub => {
    const restRaw = (sub as { restaurant?: { name?: string } | { name?: string }[] }).restaurant
    const rest = Array.isArray(restRaw) ? restRaw[0] : restRaw
    const planRaw = (sub as { plan?: { name?: string } | { name?: string }[] }).plan
    const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw

    const inv = latestByRestaurant.get(sub.restaurant_id) ?? null
    const derived = deriveBillingStatus(inv, today)

    return {
      restaurantId: sub.restaurant_id,
      name: rest?.name ?? 'Restaurante',
      planName: plan?.name ?? null,
      subscriptionStatus: sub.status ?? null,
      invoiceId: inv?.id ?? null,
      amount: inv ? Number(inv.amount) : null,
      dueDate: inv?.due_date ?? null,
      paidAt: inv?.paid_at ?? null,
      invoiceUrl: inv?.invoice_url ?? null,
      chargeMethod: inv?.charge_method ?? null,
      hasCharge: Boolean(inv?.asaas_payment_id),
      status: derived.status,
      daysOverdue: derived.daysOverdue,
      daysToDue: derived.daysToDue,
    }
  })

  // Ordena: atrasados primeiro (mais dias no topo), depois a vencer, em aberto, pagos, sem fatura.
  const order: Record<BillingDerivedStatus, number> = { overdue: 0, due_soon: 1, open: 2, none: 3, paid: 4, cancelled: 5 }
  rows.sort((a, b) => (order[a.status] - order[b.status]) || (b.daysOverdue - a.daysOverdue))

  // KPIs
  const openRows = rows.filter(r => r.status === 'overdue' || r.status === 'due_soon' || r.status === 'open')
  const overdueRows = rows.filter(r => r.status === 'overdue')
  const paidThisMonth = invoices.filter(i => i.status === 'paid' && i.paid_at && i.paid_at >= monthStartIso)

  return {
    rows,
    kpis: {
      openTotal: openRows.reduce((a, r) => a + (r.amount ?? 0), 0),
      openCount: openRows.length,
      overdueTotal: overdueRows.reduce((a, r) => a + (r.amount ?? 0), 0),
      overdueCount: overdueRows.length,
      paidThisMonthTotal: paidThisMonth.reduce((a, i) => a + Number(i.amount), 0),
      paidThisMonthCount: paidThisMonth.length,
      dueSoonCount: rows.filter(r => r.status === 'due_soon').length,
    },
  }
}
