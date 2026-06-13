'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { DEV_BYPASS, mockOrders, mockTables } from '@/lib/dev-mock'
import { useSessionRealtime } from '@/lib/use-restaurant-realtime'
import { PendingCashPaymentsPanel } from '@/components/dashboard/pending-cash-payments-panel'
import { isBillableItem, billableItemQuantity, orderItemLineTotal, orderSubtotal, ordersSubtotal } from '@/lib/session-billing'

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
  preparing: 'Preparo',
  ready:     'Pronto',
  delivered: 'Servido',
  cancelled: 'Cancelado',
}

type OrderRow = Order & {
  customer?: { first_name?: string; last_name?: string } | null
}

function customerName(order: OrderRow) {
  const c = order.customer
  if (!c?.first_name) return 'Cliente'
  return [c.first_name, c.last_name].filter(Boolean).join(' ')
}

function customerKey(order: OrderRow) {
  return order.customer_id ?? 'unknown'
}

async function cancelItem(orderItemId: string, quantity?: number) {
  const res = await fetch('/api/dashboard/orders/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderItemId, ...(quantity != null ? { quantity } : {}) }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erro ao remover item.')
}

async function cancelOrder(orderId: string) {
  const res = await fetch('/api/dashboard/orders/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erro ao cancelar pedido.')
}

export default function TableOrdersPage() {
  const params = useParams<{ tableId: string }>()
  const router = useRouter()
  const [tableNumber, setTableNumber] = useState('')
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (DEV_BYPASS) {
      const table = mockTables.find(t => t.id === params.tableId)
      setTableNumber(table?.number ?? '?')
      setOrders(mockOrders as OrderRow[])
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!restaurant) { router.replace('/login'); return }

    const { data: table } = await supabase
      .from('tables')
      .select('id, number')
      .eq('id', params.tableId)
      .eq('restaurant_id', restaurant.id)
      .single()

    if (!table) { setLoading(false); return }
    setTableNumber(table.number)

    const { data: session } = await supabase
      .from('sessions')
      .select('id')
      .eq('table_id', table.id)
      .in('status', ['open', 'closing'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!session) {
      setSessionId(null)
      setOrders([])
      setLoading(false)
      return
    }

    setSessionId(session.id)

    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*, menu_item:menu_items(name)),
        customer:customers(first_name, last_name)
      `)
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })

    setOrders((data ?? []) as OrderRow[])
    setLoading(false)
  }, [params.tableId, router])

  useEffect(() => { void load() }, [load])
  useSessionRealtime(sessionId, load, Boolean(sessionId) && !DEV_BYPASS)

  const grouped = useMemo(() => {
    const map = new Map<string, OrderRow[]>()
    for (const o of orders) {
      const key = customerKey(o)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(o)
    }
    return [...map.entries()]
  }, [orders])

  const billableTotal = ordersSubtotal(orders)

  async function handleCancelItem(orderItemId: string, quantity?: number) {
    const msg = quantity === 1
      ? 'Remover 1 unidade deste item da conta? O valor sai do pagamento do cliente.'
      : quantity != null
        ? `Remover ${quantity} unidades deste item da conta? O valor sai do pagamento do cliente.`
        : 'Remover este item da conta? O valor sai do pagamento do cliente.'
    if (!confirm(msg)) return
    setActing(orderItemId)
    try {
      if (DEV_BYPASS) {
        toast.success('Item removido (mock).')
        await load()
        return
      }
      await cancelItem(orderItemId, quantity)
      toast.success('Item removido da conta.')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover item.')
    } finally {
      setActing(null)
    }
  }

  async function handleCancelOrder(orderId: string) {
    if (!confirm('Cancelar o pedido inteiro? Todos os itens saem da conta deste cliente.')) return
    setActing(orderId)
    try {
      if (DEV_BYPASS) {
        toast.success('Pedido cancelado (mock).')
        await load()
        return
      }
      await cancelOrder(orderId)
      toast.success('Pedido cancelado — valor removido da conta.')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao cancelar pedido.')
    } finally {
      setActing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-container" />
      </div>
    )
  }

  return (
    <div className="space-y-stack-lg max-w-3xl">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container-highest transition-colors"
        >
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">arrow_back</span>
        </button>
        <div>
          <h2
            className="text-2xl font-semibold text-on-surface"
            style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}
          >
            Pedidos · Mesa {tableNumber}
          </h2>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Remova itens ou pedidos da conta quando o cliente contestar (qualidade, acordo).
          </p>
        </div>
      </div>

      {sessionId && <PendingCashPaymentsPanel sessionId={sessionId} />}

      {orders.length === 0 ? (
        <div className="tonal-layer-1 ghost-border rounded-xl py-16 text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30 mb-3 block">receipt_long</span>
          <p className="text-sm font-mono text-on-surface-variant">Nenhum pedido nesta mesa</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {grouped.map(([key, customerOrders]) => (
              <div key={key} className="tonal-layer-1 ghost-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-outline-variant flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{customerName(customerOrders[0])}</p>
                    <p className="text-[10px] font-mono text-on-surface-variant mt-0.5">
                      {customerOrders.length} pedido{customerOrders.length !== 1 ? 's' : ''} ·{' '}
                      {formatCurrency(ordersSubtotal(customerOrders))} em aberto
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-outline-variant">
                  {customerOrders.map(order => {
                    const cancelled = order.status === 'cancelled'
                    const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.pending
                    const label = STATUS_LABEL[order.status] ?? order.status
                    const time = new Date(order.created_at).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    const billableItems = (order.items ?? []).filter(isBillableItem)
                    const hasMultipleBillable = billableItems.length > 1

                    return (
                      <div key={order.id} className={`px-5 py-4 ${cancelled ? 'opacity-60' : ''}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                              className="text-sm font-mono text-primary hover:underline"
                            >
                              #{order.id.slice(-4).toUpperCase()}
                            </button>
                            <span className="text-[10px] font-mono text-on-surface-variant">{time}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${badge}`}>
                              {label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-mono ${cancelled ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                              {formatCurrency(orderSubtotal(order))}
                            </span>
                            {!cancelled && billableItems.length > 0 && (
                              <button
                                type="button"
                                disabled={acting === order.id}
                                onClick={() => void handleCancelOrder(order.id)}
                                className="text-[10px] font-mono font-bold uppercase px-2 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                              >
                                {acting === order.id ? '…' : 'Cancelar pedido'}
                              </button>
                            )}
                          </div>
                        </div>

                        <ul className="space-y-2">
                          {(order.items ?? []).map(item => {
                            const billableQty = billableItemQuantity(item)
                            const itemFullyCancelled = billableQty === 0 || cancelled
                            const partialRemoved = (item.cancelled_qty ?? 0) > 0 && billableQty > 0
                            return (
                              <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                                <div className={`min-w-0 flex-1 ${itemFullyCancelled ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                                  <span className="font-mono">
                                    {partialRemoved ? `${billableQty}× (de ${item.quantity})` : `${item.quantity}×`}{' '}
                                  </span>
                                  {item.menu_item?.name ?? 'Item'}
                                  {partialRemoved && (
                                    <span className="block text-[10px] font-mono text-red-400/80 mt-0.5">
                                      {item.cancelled_qty} removida{(item.cancelled_qty ?? 0) !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                  {item.notes && (
                                    <span className="block text-[10px] font-mono text-amber-400/90 mt-0.5">{item.notes}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`font-mono text-xs ${itemFullyCancelled ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                                    {formatCurrency(orderItemLineTotal(item))}
                                  </span>
                                  {!itemFullyCancelled && !cancelled && (
                                    billableQty > 1 ? (
                                      <>
                                        <button
                                          type="button"
                                          disabled={acting === item.id}
                                          onClick={() => void handleCancelItem(item.id, 1)}
                                          className="text-[10px] font-mono font-bold uppercase px-2 py-1 rounded border border-outline-variant text-on-surface-variant hover:text-red-400 hover:border-red-500/30 disabled:opacity-50"
                                          title="Remover 1 unidade"
                                        >
                                          {acting === item.id ? '…' : '−1'}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={acting === item.id}
                                          onClick={() => void handleCancelItem(item.id, billableQty)}
                                          className="text-[10px] font-mono font-bold uppercase px-2 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                                          title="Remover todas as unidades cobráveis"
                                        >
                                          {acting === item.id ? '…' : 'Todos'}
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={acting === item.id}
                                        onClick={() => void handleCancelItem(item.id)}
                                        className="text-[10px] font-mono font-bold uppercase px-2 py-1 rounded border border-outline-variant text-on-surface-variant hover:text-red-400 hover:border-red-500/30 disabled:opacity-50"
                                        title={hasMultipleBillable ? 'Remover só este item' : 'Remover da conta'}
                                      >
                                        {acting === item.id ? '…' : 'Remover'}
                                      </button>
                                    )
                                  )}
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="tonal-layer-1 ghost-border rounded-xl px-5 py-4 flex justify-between items-center">
            <span className="text-sm font-mono text-on-surface-variant">Total da mesa (itens na conta)</span>
            <span className="text-lg font-bold font-mono text-primary">{formatCurrency(billableTotal)}</span>
          </div>
        </>
      )}
    </div>
  )
}
