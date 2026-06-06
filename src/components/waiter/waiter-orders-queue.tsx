'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resolveWaiterRestaurantId } from '@/lib/waiter-restaurant-id'
import { countWaiterPendingPayments } from '@/components/dashboard/waiter-pending-payments-panel'
import { formatCounterOrderLabel } from '@/lib/counter-orders'
import { orderStatus } from '@/lib/design-tokens'
import { WaiterLoyaltyAlertsBanner } from '@/components/waiter/waiter-loyalty-panel'
import type { WaiterLoyaltyAlert } from '@/lib/waiter-garcom'

type OrderRow = {
  id: string
  status: string
  display_number: number | null
  order_channel: string
  created_at: string
  customer: { first_name: string; last_name: string } | null
  tableNumber: string | null
}

const STATUS_FLOW: Record<string, string> = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
}

const STATUS_ACTION_LABEL: Record<string, string> = {
  pending: 'Confirmar',
  confirmed: 'Preparar',
  preparing: 'Pronto',
  ready: 'Entregar ✓',
}

function orderLocation(o: OrderRow): string {
  if (o.order_channel === 'counter') return formatCounterOrderLabel(o.display_number)
  if (o.tableNumber) return `Mesa ${o.tableNumber}`
  return 'Mesa'
}

function statusBadgeStyle(status: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    pending:   { background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' },
    confirmed: { background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' },
    preparing: { background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' },
    ready:     { background: 'rgba(249,115,22,0.15)', color: '#ffb690', border: '1px solid rgba(249,115,22,0.3)' },
  }
  return map[status] ?? { background: '#1e293b', color: '#a78b7d', border: '1px solid #334155' }
}

export function WaiterOrdersQueue({ showPaymentsLink = true }: { showPaymentsLink?: boolean }) {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingPayments, setPendingPayments] = useState(0)
  const [loyaltyAlerts, setLoyaltyAlerts] = useState<WaiterLoyaltyAlert[]>([])
  const [advancingId, setAdvancingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const restaurantId = await resolveWaiterRestaurantId(supabase)
    if (!restaurantId) {
      setLoading(false)
      return
    }

    const pendingCount = await countWaiterPendingPayments(supabase, restaurantId)
    setPendingPayments(pendingCount)

    void fetch('/api/dashboard/waiter/alerts')
      .then(r => r.json())
      .then(json => { if (json.alerts) setLoyaltyAlerts(json.alerts) })
      .catch(() => {})

    const { data } = await supabase
      .from('orders')
      .select(`
        id, status, display_number, order_channel, created_at,
        customer:customers ( first_name, last_name ),
        session:sessions ( table:tables ( number ) )
      `)
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: true })
      .limit(50)

    setOrders((data ?? []).map(row => {
      const c = row.customer as { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null
      const customer = Array.isArray(c) ? c[0] ?? null : c
      const sessionRaw = row.session as { table?: { number?: string } | { number?: string }[] } | { table?: { number?: string } | { number?: string }[] }[] | null
      const session = Array.isArray(sessionRaw) ? sessionRaw[0] : sessionRaw
      const tableRaw = session?.table
      const table = Array.isArray(tableRaw) ? tableRaw[0] : tableRaw
      return {
        id: row.id,
        status: row.status,
        display_number: row.display_number,
        order_channel: row.order_channel,
        created_at: row.created_at,
        customer: customer as OrderRow['customer'],
        tableNumber: table?.number ?? null,
      }
    }))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase
      .channel('garcom-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => load())
      .subscribe()
    const poll = setInterval(() => { void load() }, 15_000)
    return () => { supabase.removeChannel(channel); clearInterval(poll) }
  }, [load])

  async function advance(order: OrderRow) {
    const next = STATUS_FLOW[order.status]
    if (!next) return
    setAdvancingId(order.id)
    // Usa server route — RLS de orders só permite owner no UPDATE direto
    await fetch('/api/dashboard/kitchen/order-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, status: next }),
    }).catch(() => {})
    await load()
    setAdvancingId(null)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  const meta = orderStatus as Record<string, { label: string; next: string }>

  return (
    <div className="space-y-5">
      <WaiterLoyaltyAlertsBanner alerts={loyaltyAlerts} />

      {showPaymentsLink && pendingPayments > 0 && (
        <Link
          href="/garcom/pagamentos"
          className="block rounded-2xl px-4 py-3.5 active:scale-[0.98] transition-transform"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)' }}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[22px]" style={{ color: '#fbbf24' }}>
              notifications_active
            </span>
            <div>
              <p className="text-sm font-bold" style={{ color: '#fde68a' }}>
                {pendingPayments} pagamento{pendingPayments > 1 ? 's' : ''} aguardando
              </p>
              <p className="text-xs font-mono mt-0.5" style={{ color: '#a78b7d' }}>
                Toque para confirmar dinheiro ou PIX manual
              </p>
            </div>
          </div>
        </Link>
      )}

      <div>
        <h1 className="text-2xl font-black" style={{ letterSpacing: '-0.02em' }}>Fila de pedidos</h1>
        <p className="text-sm mt-1 font-mono" style={{ color: '#a78b7d' }}>
          Toque para avançar · balcão mostra # ao cliente
        </p>
      </div>

      {orders.length === 0 ? (
        <div
          className="rounded-2xl py-14 text-center"
          style={{ background: '#171f33', border: '1px solid rgba(88,66,55,0.4)' }}
        >
          <span className="material-symbols-outlined text-[40px] mb-2" style={{ color: '#584237' }}>
            check_circle
          </span>
          <p className="text-sm font-mono" style={{ color: '#a78b7d' }}>Nenhum pedido aberto</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map(o => {
            const customer = o.customer
            const name = customer
              ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim()
              : 'Cliente'
            const next = STATUS_FLOW[o.status]
            const statusMeta = meta[o.status]
            const time = new Date(o.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

            return (
              <li
                key={o.id}
                className="rounded-2xl p-4"
                style={{
                  background: o.status === 'ready' ? 'rgba(52,211,153,0.06)' : '#171f33',
                  border: o.status === 'ready' ? '1px solid rgba(52,211,153,0.35)' : '1px solid rgba(88,66,55,0.4)',
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-xl font-black font-mono" style={{ color: '#f97316' }}>
                      {orderLocation(o)}
                    </p>
                    <p className="text-sm font-medium truncate mt-0.5">{name}</p>
                    <p className="text-[10px] font-mono mt-1" style={{ color: '#584237' }}>{time}</p>
                  </div>
                  <span
                    className="shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold font-mono uppercase"
                    style={statusBadgeStyle(o.status)}
                  >
                    {statusMeta?.label ?? o.status}
                  </span>
                </div>

                {next && (
                  <button
                    type="button"
                    disabled={advancingId === o.id}
                    onClick={() => void advance(o)}
                    className="w-full h-12 rounded-xl font-bold text-sm font-mono flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
                    style={{
                      background: '#f97316',
                      color: '#582200',
                      boxShadow: '0 4px 16px rgba(249,115,22,0.25)',
                    }}
                  >
                    {advancingId === o.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">
                          {o.status === 'ready' ? 'done_all' : 'arrow_forward'}
                        </span>
                        {STATUS_ACTION_LABEL[o.status] ?? statusMeta?.next ?? 'Avançar'}
                      </>
                    )}
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
