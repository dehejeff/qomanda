'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { DEV_BYPASS, mockOrders } from '@/lib/dev-mock'
import {
  buildSessionBilling,
  isBillableOrder,
  type PaymentRow as BillingPaymentRow,
} from '@/lib/session-billing'
import { formatCounterOrderLabel } from '@/lib/counter-orders'
import { PayBadge } from '@/components/dashboard/pay-badge'
import { useRestaurantRealtime } from '@/lib/use-restaurant-realtime'
import { useDashboardSearchOptional } from '@/components/dashboard/dashboard-search-context'
import { brToday, brMidnight } from '@/lib/date-tz'

const STATUS_FLOW: Record<string, string> = {
  pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'delivered',
}

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  confirmed: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  preparing: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  ready:     'bg-primary-container/20 text-primary border border-primary/20',
  delivered: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border border-red-500/20',
}

const STATUS_LABEL: Record<string, string> = {
  pending:   'Aguardando',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  ready:     'Pronto',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

const STATUS_NEXT: Record<string, string> = {
  pending: 'Confirmar', confirmed: 'Preparar', preparing: 'Pronto', ready: 'Entregar',
}

const STATUS_FILTERS = [
  { value: 'all',       label: 'Todos' },
  { value: 'pending',   label: 'Aguardando' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'preparing', label: 'Preparo' },
  { value: 'ready',     label: 'Pronto' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'cancelled', label: 'Cancelado' },
] as const

type StatusFilter = (typeof STATUS_FILTERS)[number]['value']

type PayDisplay = 'cancelled' | 'paid' | 'partial' | 'pending'

type SessionPayment = {
  grandTotal: number
  totalPaid: number
  remaining: number
}

type CustomerPayment = {
  owed: number
  paid: number
  status: PayDisplay
}

type DashboardPaymentRow = BillingPaymentRow & { session_id: string }

type DashboardOrder = Order & {
  display_number?: number | null
  order_channel?: string | null
  session?: { table?: { number?: string } | null } | null
  customer?: { first_name?: string; last_name?: string } | null
}

function orderLocationLabel(order: DashboardOrder): string {
  if (order.order_channel === 'counter') {
    return formatCounterOrderLabel(order.display_number)
  }
  const num = order.session?.table?.number
  if (!num || num.toUpperCase() === 'BALCAO') return 'Balcão'
  return `Mesa ${num}`
}

function buildPaymentLookups(orders: DashboardOrder[], payments: DashboardPaymentRow[]) {
  const sessionOrders = new Map<string, DashboardOrder[]>()
  for (const order of orders) {
    const list = sessionOrders.get(order.session_id) ?? []
    list.push(order)
    sessionOrders.set(order.session_id, list)
  }

  const sessionById = new Map<string, SessionPayment>()
  const customerByKey = new Map<string, CustomerPayment>()

  for (const [sessionId, sessionOrderList] of sessionOrders) {
    const sessionPayments = payments.filter(p => p.session_id === sessionId)
    const participantIds = [...new Set(
      sessionOrderList.map(o => o.customer_id).filter(Boolean) as string[],
    )]
    const billing = buildSessionBilling(sessionOrderList, sessionPayments, participantIds)
    sessionById.set(sessionId, {
      grandTotal: billing.grandTotal,
      totalPaid: billing.totalPaid,
      remaining: billing.remaining,
    })
    for (const b of billing.billings) {
      customerByKey.set(`${sessionId}:${b.customerId}`, {
        owed: b.amountDue,
        paid: b.paid,
        status: b.status,
      })
    }
  }

  return { sessionById, customerByKey }
}

function isBillable(order: DashboardOrder) {
  return isBillableOrder(order)
}

function orderPayInfo(
  order: DashboardOrder,
  sessionById: Map<string, SessionPayment>,
  customerByKey: Map<string, CustomerPayment>,
): CustomerPayment & { display: PayDisplay } {
  if (order.status === 'cancelled') {
    return { owed: 0, paid: 0, status: 'cancelled', display: 'cancelled' }
  }

  const session = sessionById.get(order.session_id)
  if (session && session.grandTotal > 0 && session.remaining <= 0.02) {
    return { owed: session.grandTotal, paid: session.totalPaid, status: 'paid', display: 'paid' }
  }

  if (!order.customer_id) {
    return { owed: 0, paid: 0, status: 'pending', display: 'pending' }
  }

  const key = `${order.session_id}:${order.customer_id}`
  const info = customerByKey.get(key) ?? { owed: 0, paid: 0, status: 'pending' as PayDisplay }
  return { ...info, display: info.status }
}

// Usa fuso Brasil (UTC-3) — Vercel roda em UTC, sem isso meia-noite UTC
// corresponde a 21h do dia anterior no Brasil, vazando pedidos entre dias.
function todayDateStr() {
  return brToday()
}

function dateRangeForDay(dateStr: string) {
  const start = brMidnight(dateStr)
  const end   = brMidnight(shiftDateStr(dateStr, 1)) // meia-noite do dia seguinte
  return { start: start.toISOString(), end: end.toISOString() }
}

function shiftDateStr(dateStr: string, days: number) {
  // Usa meio-dia UTC para evitar DST/offset issues ao somar dias
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateLabel(dateStr: string) {
  const today = todayDateStr()
  const yesterday = shiftDateStr(today, -1)
  if (dateStr === today) return 'Hoje'
  if (dateStr === yesterday) return 'Ontem'
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** Frase de data gramaticalmente correta: "hoje", "ontem" ou "em 30 de mai". */
function datePhrase(dateStr: string) {
  const today = todayDateStr()
  const yesterday = shiftDateStr(today, -1)
  if (dateStr === today) return 'hoje'
  if (dateStr === yesterday) return 'ontem'
  return `em ${formatDateLabel(dateStr).toLowerCase()}`
}

function orderTotal(order: DashboardOrder) {
  return (order.items ?? []).reduce((a, i) => a + i.unit_price * i.quantity, 0)
}

function customerName(order: DashboardOrder) {
  const c = order.customer
  if (!c?.first_name) return '—'
  return [c.first_name, c.last_name].filter(Boolean).join(' ')
}

function orderMatchesSearch(order: DashboardOrder, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    customerName(order),
    orderLocationLabel(order),
    order.id,
    String(order.display_number ?? ''),
    STATUS_LABEL[order.status] ?? order.status,
  ].join(' ').toLowerCase()
  return haystack.includes(q)
}

export default function OrdersPage() {
  const router = useRouter()
  const dashboardSearch = useDashboardSearchOptional()
  const searchQuery = dashboardSearch?.query ?? ''
  const [orders, setOrders] = useState<DashboardOrder[]>([])
  const [payments, setPayments] = useState<DashboardPaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedDate, setSelectedDate] = useState(todayDateStr)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  async function loadOrders(rid: string, dateStr: string, silent = false) {
    if (!silent) setLoading(true)
    const { start, end } = dateRangeForDay(dateStr)
    const isToday = dateStr === todayDateStr()
    const supabase = createClient()

    const SELECT = `
      *,
      items:order_items(*, menu_item:menu_items(name)),
      session:sessions(table:tables(number)),
      customer:customers(first_name, last_name)
    `

    // Query principal: pedidos do intervalo do dia selecionado
    const dayQuery = supabase
      .from('orders')
      .select(SELECT)
      .eq('restaurant_id', rid)
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: false })

    // Se for hoje: também traz pedidos em aberto de dias anteriores
    // (ex: pedido feito às 23:58 de ontem ainda não entregue)
    const openQuery = isToday
      ? supabase
          .from('orders')
          .select(SELECT)
          .eq('restaurant_id', rid)
          .lt('created_at', start)
          .not('status', 'in', '("delivered","cancelled")')
          .order('created_at', { ascending: false })
      : null

    const [{ data: dayData }, openResult] = await Promise.all([
      dayQuery,
      openQuery ?? Promise.resolve({ data: [] }),
    ])

    // Mescla sem duplicatas (pedido do dia já pode estar em aberto)
    const seen = new Set<string>()
    const merged: DashboardOrder[] = []
    for (const o of [...(dayData ?? []), ...(openResult.data ?? [])]) {
      if (!seen.has(o.id)) { seen.add(o.id); merged.push(o as DashboardOrder) }
    }
    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const loaded = merged
    setOrders(loaded)

    const sessionIds = [...new Set(loaded.map(o => o.session_id))]
    if (sessionIds.length === 0) {
      setPayments([])
      setLoading(false)
      return
    }

    const { data: payData } = await supabase
      .from('payments')
      .select('session_id, customer_id, amount, service_fee_included')
      .eq('restaurant_id', rid)
      .eq('status', 'paid')
      .in('session_id', sessionIds)

    setPayments((payData ?? []) as DashboardPaymentRow[])
    setLoading(false)
  }

  const isToday = selectedDate === todayDateStr()

  useRestaurantRealtime(
    restaurantId,
    () => { if (restaurantId) void loadOrders(restaurantId, selectedDate, true) },
    { enabled: isToday && Boolean(restaurantId) },
  )

  useEffect(() => {
    if (DEV_BYPASS) {
      setOrders(mockOrders as DashboardOrder[])
      setLoading(false)
      return
    }

    const supabase = createClient()
    let cancelled = false

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const { data: r } = await supabase.from('restaurants').select('id').eq('owner_id', user.id).single()
      if (!r || cancelled) return

      setRestaurantId(r.id)
      await loadOrders(r.id, selectedDate)
    }

    init()

    return () => { cancelled = true }
  }, [selectedDate])

  const filteredOrders = useMemo(
    () => {
      const byStatus = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter)
      return byStatus.filter(o => orderMatchesSearch(o, searchQuery))
    },
    [orders, statusFilter, searchQuery],
  )

  const { sessionById, customerByKey } = useMemo(
    () => buildPaymentLookups(orders, payments),
    [orders, payments],
  )

  // Contagem por pedido individual — consistente com o badge de pagamento de cada linha.
  const paySummary = useMemo(() => {
    let paid = 0
    let pending = 0
    let partial = 0
    for (const order of orders) {
      if (!isBillable(order)) continue
      const info = orderPayInfo(order, sessionById, customerByKey)
      if (info.display === 'paid') paid++
      else if (info.display === 'partial') partial++
      else pending++
    }
    return { paid, pending, partial }
  }, [orders, sessionById, customerByKey])

  const openCount = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length

  async function advanceStatus(e: React.MouseEvent, orderId: string, currentStatus: string) {
    e.stopPropagation()
    const next = STATUS_FLOW[currentStatus]
    if (!next) return

    if (DEV_BYPASS) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: next as Order['status'] } : o))
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', orderId)

    if (error) {
      toast.error('Erro ao atualizar pedido')
      return
    }

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: next as Order['status'] } : o))
    toast.success(`Pedido → ${STATUS_LABEL[next] ?? next}`)
  }

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-container" />
      </div>
    )
  }

  return (
    <div className="space-y-stack-lg">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}>
            Pedidos
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            {orders.length} pedido{orders.length !== 1 ? 's' : ''} {datePhrase(selectedDate)}
            {openCount > 0 && isToday && ` · ${openCount} em aberto`}
            {isToday && (paySummary.paid + paySummary.partial + paySummary.pending) > 0 && (
              <>
                {' · '}
                <span className="text-emerald-400">{paySummary.paid} quitado{paySummary.paid !== 1 ? 's' : ''}</span>
                {paySummary.partial > 0 && (
                  <span className="text-amber-400"> · {paySummary.partial} parcial{paySummary.partial !== 1 ? 'ais' : ''}</span>
                )}
                {paySummary.pending > 0 && (
                  <span className="text-red-400"> · {paySummary.pending} pendente{paySummary.pending !== 1 ? 's' : ''}</span>
                )}
              </>
            )}
            {isToday ? ' — atualização em tempo real.' : ' — histórico do dia selecionado.'}
          </p>
        </div>

        {/* Filtro de data */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/cozinha"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg text-[11px] font-mono border border-outline-variant text-on-surface-variant hover:text-on-surface flex items-center gap-1.5"
            title="Abrir o painel de cozinha (KDS) — ideal para a tela/tablet da cozinha"
          >
            <span className="material-symbols-outlined text-[15px]">skillet</span>
            Tela de cozinha
          </a>
          <button
            type="button"
            onClick={() => setSelectedDate(todayDateStr())}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors ${
              isToday
                ? 'bg-primary-container text-on-primary-container border border-primary/30'
                : 'bg-surface-container-high text-on-surface-variant border border-outline-variant hover:border-primary/40'
            }`}
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(shiftDateStr(todayDateStr(), -1))}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors ${
              selectedDate === shiftDateStr(todayDateStr(), -1)
                ? 'bg-primary-container text-on-primary-container border border-primary/30'
                : 'bg-surface-container-high text-on-surface-variant border border-outline-variant hover:border-primary/40'
            }`}
          >
            Ontem
          </button>
          <button
            type="button"
            onClick={() => dateInputRef.current?.showPicker?.()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant hover:border-primary/40 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">calendar_today</span>
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              max={todayDateStr()}
              onChange={e => e.target.value && setSelectedDate(e.target.value)}
              className="bg-transparent text-[11px] font-mono text-on-surface outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden"
            />
          </button>
          {!isToday && restaurantId && (
            <button
              type="button"
              onClick={() => loadOrders(restaurantId, selectedDate)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-mono bg-surface-container-high text-on-surface-variant border border-outline-variant hover:border-primary/40"
            >
              Atualizar
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(({ value, label }) => {
          const active = statusFilter === value
          const count = value === 'all'
            ? orders.length
            : orders.filter(o => o.status === value).length
          return (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors ${
                active
                  ? 'bg-primary-container text-on-primary-container border border-primary/30'
                  : 'bg-surface-container-high text-on-surface-variant border border-outline-variant hover:border-primary/40'
              }`}
            >
              {label}
              <span className={`ml-1.5 ${active ? 'text-on-primary-container/80' : 'text-on-surface-variant/70'}`}>
                ({count})
              </span>
            </button>
          )
        })}
      </div>

      <div className="tonal-layer-1 ghost-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-18rem)]">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead className="bg-surface-container-high sticky top-0 z-10">
              <tr>
                {['Pedido', 'Cliente', 'Local', 'Itens', 'Total', 'Pagamento', 'Status', ''].map(h => (
                  <th
                    key={h || 'action'}
                    className="px-4 py-3 text-[10px] font-mono text-on-surface-variant uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant opacity-30 mb-2 block">receipt_long</span>
                    <p className="text-sm font-mono text-on-surface-variant">
                      {orders.length === 0
                        ? `Nenhum pedido ${datePhrase(selectedDate)}`
                        : 'Nenhum pedido com este status'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const total = orderTotal(order)
                  const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.pending
                  const label = STATUS_LABEL[order.status] ?? order.status
                  const time = new Date(order.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  const location = orderLocationLabel(order)
                  const name = customerName(order)
                  const itemSummary = (order.items ?? [])
                    .map(i => `${i.quantity}× ${i.menu_item?.name ?? 'Item'}`)
                    .join(', ')
                  const nextAction = STATUS_NEXT[order.status]
                  const payInfo = orderPayInfo(order, sessionById, customerByKey)
                  const sessionPay = sessionById.get(order.session_id)

                  return (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                      className="hover:bg-surface-container-highest transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-4">
                        <span className="text-sm font-mono text-on-surface">
                          #{order.id.slice(-4).toUpperCase()}
                        </span>
                        <p className="text-[10px] font-mono text-on-surface-variant">{time}</p>
                      </td>
                      <td className="px-4 py-4 max-w-[140px]">
                        {order.customer_id ? (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              router.push(
                                `/dashboard/orders/customer/${order.customer_id}?session=${order.session_id}`,
                              )
                            }}
                            className="text-sm text-left text-primary hover:underline truncate block max-w-full font-medium"
                            title={name}
                          >
                            {name}
                          </button>
                        ) : (
                          <span className="text-sm text-on-surface truncate block" title={name}>{name}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm font-bold font-mono text-primary">
                        <span>{location}</span>
                        {sessionPay && sessionPay.grandTotal > 0 && payInfo.display !== 'cancelled' && (
                          <p className="text-[10px] font-normal mt-0.5 whitespace-nowrap"
                            style={{ color: sessionPay.remaining <= 0.02 ? '#34d399' : '#f87171' }}>
                            {sessionPay.remaining <= 0.02
                              ? 'Mesa quitada'
                              : `${formatCurrency(sessionPay.totalPaid)} / ${formatCurrency(sessionPay.grandTotal)}`}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-on-surface-variant max-w-[200px] truncate" title={itemSummary}>
                        {itemSummary || '—'}
                      </td>
                      <td className="px-4 py-4 text-sm font-mono text-on-surface whitespace-nowrap">
                        {formatCurrency(total)}
                      </td>
                      <td className="px-4 py-4">
                        <PayBadge display={payInfo.display} />
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase whitespace-nowrap ${badge}`}>
                          {label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {nextAction && (
                          <button
                            type="button"
                            onClick={e => advanceStatus(e, order.id, order.status)}
                            className="text-[10px] font-bold font-mono text-on-primary-container bg-primary-container hover:opacity-90 px-2.5 py-1 rounded-lg transition-opacity whitespace-nowrap"
                          >
                            {nextAction} →
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
