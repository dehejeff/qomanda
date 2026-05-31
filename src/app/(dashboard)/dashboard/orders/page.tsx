'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { PayBadge } from '@/components/dashboard/pay-badge'

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
  session?: { table?: { number?: string } | null } | null
  customer?: { first_name?: string; last_name?: string } | null
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

function startOfTodayIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function orderTotal(order: DashboardOrder) {
  return (order.items ?? []).reduce((a, i) => a + i.unit_price * i.quantity, 0)
}

function customerName(order: DashboardOrder) {
  const c = order.customer
  if (!c?.first_name) return '—'
  return [c.first_name, c.last_name].filter(Boolean).join(' ')
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<DashboardOrder[]>([])
  const [payments, setPayments] = useState<DashboardPaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  async function loadOrders(restaurantId: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*, menu_item:menu_items(name)),
        session:sessions(table:tables(number)),
        customer:customers(first_name, last_name)
      `)
      .eq('restaurant_id', restaurantId)
      .gte('created_at', startOfTodayIso())
      .order('created_at', { ascending: false })

    const loaded = (data ?? []) as DashboardOrder[]
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
      .eq('restaurant_id', restaurantId)
      .eq('status', 'paid')
      .in('session_id', sessionIds)

    setPayments((payData ?? []) as DashboardPaymentRow[])
    setLoading(false)
  }

  useEffect(() => {
    if (DEV_BYPASS) {
      setOrders(mockOrders as DashboardOrder[])
      setLoading(false)
      return
    }

    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const { data: r } = await supabase.from('restaurants').select('id').eq('owner_id', user.id).single()
      if (!r || cancelled) return

      const restaurantId = r.id
      await loadOrders(restaurantId)
      if (cancelled) return

      channel = supabase
        .channel(`dashboard-orders-${restaurantId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
          () => { if (!cancelled) loadOrders(restaurantId) },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'payments', filter: `restaurant_id=eq.${restaurantId}` },
          () => { if (!cancelled) loadOrders(restaurantId) },
        )
        .subscribe()
    }

    init()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  const filteredOrders = useMemo(
    () => (statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter)),
    [orders, statusFilter],
  )

  const { sessionById, customerByKey } = useMemo(
    () => buildPaymentLookups(orders, payments),
    [orders, payments],
  )

  const paySummary = useMemo(() => {
    let paid = 0
    let pending = 0
    let partial = 0
    const seen = new Set<string>()
    for (const order of orders) {
      if (!isBillable(order)) continue
      const key = `${order.session_id}:${order.customer_id ?? 'anon'}`
      if (seen.has(key)) continue
      seen.add(key)
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

  if (loading) {
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
            {orders.length} pedido{orders.length !== 1 ? 's' : ''} hoje
            {openCount > 0 && ` · ${openCount} em aberto`}
            {(paySummary.paid + paySummary.partial + paySummary.pending) > 0 && (
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
            {' — atualização em tempo real.'}
          </p>
        </div>
        <p className="text-[11px] font-mono text-on-surface-variant">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
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
                {['Pedido', 'Cliente', 'Mesa', 'Itens', 'Total', 'Pagamento', 'Status', ''].map(h => (
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
                      {orders.length === 0 ? 'Nenhum pedido registrado hoje' : 'Nenhum pedido com este status'}
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
                  const mesa = order.session?.table?.number ?? '—'
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
                        <span>{mesa}</span>
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
