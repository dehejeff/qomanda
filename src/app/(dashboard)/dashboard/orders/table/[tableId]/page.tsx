'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { DEV_BYPASS, mockOrders, mockTables } from '@/lib/dev-mock'
import { useSessionRealtime } from '@/lib/use-restaurant-realtime'

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

function orderTotal(order: OrderRow) {
  return (order.items ?? []).reduce((a, i) => a + i.unit_price * i.quantity, 0)
}

function customerName(order: OrderRow) {
  const c = order.customer
  if (!c?.first_name) return '—'
  return [c.first_name, c.last_name].filter(Boolean).join(' ')
}

export default function TableOrdersPage() {
  const params = useParams<{ tableId: string }>()
  const router = useRouter()
  const [tableNumber, setTableNumber] = useState('')
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (DEV_BYPASS) {
      const table = mockTables.find((t) => t.id === params.tableId)
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
      .eq('status', 'open')
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
      .order('created_at', { ascending: false })

    setOrders((data ?? []) as OrderRow[])
    setLoading(false)
  }, [params.tableId, router])

  useEffect(() => { void load() }, [load])

  useSessionRealtime(sessionId, load, Boolean(sessionId) && !DEV_BYPASS)

  const billableTotal = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((s, o) => s + orderTotal(o), 0)

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
        <Link
          href="/dashboard"
          className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container-highest transition-colors"
        >
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">arrow_back</span>
        </Link>
        <div>
          <h2
            className="text-2xl font-semibold text-on-surface"
            style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}
          >
            Pedidos · Mesa {tableNumber}
          </h2>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {orders.length} pedido{orders.length !== 1 ? 's' : ''} nesta sessão
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="tonal-layer-1 ghost-border rounded-xl py-16 text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30 mb-3 block">receipt_long</span>
          <p className="text-sm font-mono text-on-surface-variant">Nenhum pedido nesta mesa</p>
        </div>
      ) : (
        <>
          <div className="tonal-layer-1 ghost-border rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-high">
                <tr>
                  {['ID', 'Cliente', 'Total', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {orders.map((order) => {
                  const cancelled = order.status === 'cancelled'
                  const total = orderTotal(order)
                  const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.pending
                  const label = STATUS_LABEL[order.status] ?? order.status
                  const time = new Date(order.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  return (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                      className={`hover:bg-surface-container-highest transition-colors cursor-pointer ${cancelled ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-4">
                        <span className={`text-sm font-mono text-on-surface ${cancelled ? 'line-through' : ''}`}>
                          #{order.id.slice(-4).toUpperCase()}
                        </span>
                        <p className="text-[10px] font-mono text-on-surface-variant">{time}</p>
                      </td>
                      <td className={`px-4 py-4 text-sm text-on-surface ${cancelled ? 'line-through' : ''}`}>
                        {customerName(order)}
                      </td>
                      <td className={`px-4 py-4 text-sm font-mono text-on-surface ${cancelled ? 'line-through' : ''}`}>
                        {formatCurrency(total)}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${badge}`}>
                          {label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="tonal-layer-1 ghost-border rounded-xl px-5 py-4 flex justify-between items-center">
            <span className="text-sm font-mono text-on-surface-variant">Total em aberto (sem cancelados)</span>
            <span className="text-lg font-bold font-mono text-primary">{formatCurrency(billableTotal)}</span>
          </div>
        </>
      )}
    </div>
  )
}
