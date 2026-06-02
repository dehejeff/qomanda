'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { resolveWaiterRestaurantId } from '@/lib/waiter-restaurant-id'
import { countWaiterPendingPayments } from '@/components/dashboard/waiter-pending-payments-panel'
import { formatCounterOrderLabel } from '@/lib/counter-orders'

type OrderRow = {
  id: string
  status: string
  display_number: number | null
  order_channel: string
  created_at: string
  customer: { first_name: string; last_name: string } | null
}

const STATUS_FLOW: Record<string, string> = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  ready: 'Pronto',
  delivered: 'Entregue',
}

export default function WaiterOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingPayments, setPendingPayments] = useState(0)

  const load = useCallback(async () => {
    const supabase = createClient()
    const restaurantId = await resolveWaiterRestaurantId(supabase)
    if (!restaurantId) return

    const pendingCount = await countWaiterPendingPayments(supabase, restaurantId)
    setPendingPayments(pendingCount)

    const { data } = await supabase
      .from('orders')
      .select(`
        id, status, display_number, order_channel, created_at,
        customer:customers ( first_name, last_name )
      `)
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: true })
      .limit(40)

    setOrders((data ?? []).map(row => {
      const c = row.customer as { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null
      const customer = Array.isArray(c) ? c[0] ?? null : c
      return { ...row, customer } as OrderRow
    }))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase
      .channel('waiter-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  async function advance(order: OrderRow) {
    const next = STATUS_FLOW[order.status]
    if (!next) return
    const supabase = createClient()
    await supabase.from('orders').update({ status: next }).eq('id', order.id)
    load()
  }

  if (loading) {
    return <p className="text-on-surface-variant text-sm font-mono">Carregando pedidos…</p>
  }

  return (
    <div className="space-y-6">
      {pendingPayments > 0 && (
        <Link
          href="/dashboard/waiter/payments"
          className="block rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 hover:bg-amber-500/15 transition-colors"
        >
          <p className="text-sm font-bold text-amber-300">
            {pendingPayments} pagamento{pendingPayments > 1 ? 's' : ''} aguardando confirmação
          </p>
          <p className="text-xs text-on-surface-variant mt-0.5">Toque para confirmar dinheiro ou PIX manual</p>
        </Link>
      )}

      <div>
        <h1 className="text-2xl font-black text-on-surface">Fila de pedidos</h1>
        <p className="text-sm text-on-surface-variant mt-1">Toque para avançar status · balcão mostra número ao cliente</p>
      </div>

      {orders.length === 0 ? (
        <p className="text-on-surface-variant text-sm">Nenhum pedido aberto.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map(o => {
            const customer = o.customer as { first_name?: string; last_name?: string } | null
            const name = customer ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() : 'Cliente'
            const next = STATUS_FLOW[o.status]
            return (
              <li
                key={o.id}
                className="bg-surface-container border border-outline-variant rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="text-lg font-black text-primary font-mono">
                    {o.order_channel === 'counter' ? formatCounterOrderLabel(o.display_number) : 'Mesa'}
                  </p>
                  <p className="text-sm text-on-surface">{name}</p>
                  <p className="text-xs font-mono text-on-surface-variant mt-1">{STATUS_LABEL[o.status] ?? o.status}</p>
                </div>
                {next && (
                  <button
                    type="button"
                    onClick={() => advance(o)}
                    className="px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold text-sm"
                  >
                    → {STATUS_LABEL[next]}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
