'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { resolveWaiterRestaurantId } from '@/lib/waiter-restaurant-id'
import { countWaiterPendingPayments } from '@/components/dashboard/waiter-pending-payments-panel'
import { formatCounterOrderLabel } from '@/lib/counter-orders'
import { orderStatus } from '@/lib/design-tokens'
import { WaiterLoyaltyAlertsBanner } from '@/components/waiter/waiter-loyalty-panel'
import { playReadyChime } from '@/lib/ready-chime'
import type { WaiterLoyaltyAlert } from '@/lib/waiter-garcom'

type OrderItem = { name: string; quantity: number; notes: string | null }

type OrderRow = {
  id: string
  status: string
  display_number: number | null
  order_channel: string
  created_at: string
  customer: { first_name: string; last_name: string } | null
  tableNumber: string | null
  items: OrderItem[]
}

// O garçom NÃO controla o preparo — só entrega.
// Os estágios pending/confirmed/preparing são informativos; a cozinha/admin os avança.
// Quando a cozinha marca "ready", o garçom é notificado e só então entrega.
const STATUS_FLOW: Record<string, string> = {
  ready: 'delivered',
}

const STATUS_ACTION_LABEL: Record<string, string> = {
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
  // IDs de pedidos já vistos no estado "ready" — evita re-alertar o backlog inicial.
  const readySeen = useRef<Set<string> | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const restaurantId = await resolveWaiterRestaurantId(supabase)
    if (!restaurantId) { setLoading(false); return }

    const pendingCount = await countWaiterPendingPayments(supabase, restaurantId)
    setPendingPayments(pendingCount)

    void fetch('/api/dashboard/waiter/alerts')
      .then(r => r.json())
      .then(json => { if (json.alerts) setLoyaltyAlerts(json.alerts) })
      .catch(() => {})

    // Usa server route (admin client) para que o join sessions→tables
    // não seja bloqueado pelo RLS que só permite SELECT ao owner.
    const res = await fetch('/api/dashboard/waiter/orders-queue')
    const json = await res.json() as { orders?: unknown[] }
    const rows = (json.orders ?? []) as Array<Record<string, unknown>>

    const mapped: OrderRow[] = rows.map(row => {
      const c = row.customer as { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null
      const customer = Array.isArray(c) ? c[0] ?? null : c
      const sessionRaw = row.session as { table?: { number?: string } | { number?: string }[] } | { table?: { number?: string } | { number?: string }[] }[] | null
      const session = Array.isArray(sessionRaw) ? sessionRaw[0] : sessionRaw
      const tableRaw = session?.table
      const table = Array.isArray(tableRaw) ? tableRaw[0] : tableRaw
      const itemsRaw = (row.items ?? []) as Array<{ quantity: number; notes: string | null; menu_item: { name?: string } | { name?: string }[] | null }>
      const items: OrderItem[] = itemsRaw.map(it => {
        const miRaw = it.menu_item
        const mi = Array.isArray(miRaw) ? miRaw[0] : miRaw
        return { name: mi?.name ?? 'Item', quantity: Number(it.quantity), notes: it.notes ?? null }
      })
      return {
        id: String(row.id),
        status: String(row.status),
        display_number: row.display_number as number | null,
        order_channel: String(row.order_channel ?? ''),
        created_at: String(row.created_at),
        customer: customer as OrderRow['customer'],
        tableNumber: table?.number ?? null,
        items,
      }
    })

    // Notificação de "pronto para entregar": alerta apenas os pedidos que
    // entraram em "ready" desde a última carga (ignora o backlog inicial).
    const readyNow = mapped.filter(o => o.status === 'ready')
    if (readySeen.current === null) {
      readySeen.current = new Set(readyNow.map(o => o.id))
    } else {
      const fresh = readyNow.filter(o => !readySeen.current!.has(o.id))
      if (fresh.length > 0) {
        playReadyChime()
        for (const o of fresh) {
          const who = o.customer
            ? `${o.customer.first_name ?? ''} ${o.customer.last_name ?? ''}`.trim()
            : 'Cliente'
          toast.success(`Pedido pronto — ${orderLocation(o)}`, {
            description: `${who} · entregar agora (#${o.id.slice(-6).toUpperCase()})`,
            duration: 8000,
          })
        }
      }
      readySeen.current = new Set(readyNow.map(o => o.id))
    }

    setOrders(mapped)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | undefined
    let cancelled = false
    // Assina apenas os eventos DESTE restaurante (evita reload por mudança
    // de qualquer pedido/pagamento de outros restaurantes).
    void (async () => {
      const restaurantId = await resolveWaiterRestaurantId(supabase)
      if (cancelled || !restaurantId) return
      channel = supabase
        .channel('garcom-orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => load())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `restaurant_id=eq.${restaurantId}` }, () => load())
        .subscribe()
    })()
    const poll = setInterval(() => { void load() }, 15_000)
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); clearInterval(poll) }
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
  const readyToDeliver = orders.filter(o => o.status === 'ready').length

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

      {readyToDeliver > 0 && (
        <div
          className="rounded-2xl px-4 py-3.5"
          style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.4)' }}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[22px]" style={{ color: '#34d399' }}>room_service</span>
            <div>
              <p className="text-sm font-bold" style={{ color: '#34d399' }}>
                {readyToDeliver} pedido{readyToDeliver > 1 ? 's' : ''} pronto{readyToDeliver > 1 ? 's' : ''} para entregar
              </p>
              <p className="text-xs font-mono mt-0.5" style={{ color: '#a78b7d' }}>
                Leve à mesa e toque em “Entregar” ao concluir
              </p>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-black" style={{ letterSpacing: '-0.02em' }}>Fila de pedidos</h1>
        <p className="text-sm mt-1 font-mono" style={{ color: '#a78b7d' }}>
          Acompanhamento · a cozinha prepara; você entrega quando ficar pronto
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
                {/* Cabeçalho: local + ID + status */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-xl font-black font-mono" style={{ color: o.status === 'ready' ? '#34d399' : '#f97316' }}>
                      {orderLocation(o)}
                    </p>
                    <p className="text-sm font-medium truncate mt-0.5">{name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono" style={{ color: '#584237' }}>
                        #{o.id.slice(-6).toUpperCase()}
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: '#584237' }}>·</span>
                      <span className="text-[10px] font-mono" style={{ color: '#584237' }}>{time}</span>
                    </div>
                  </div>
                  <span
                    className="shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold font-mono uppercase"
                    style={statusBadgeStyle(o.status)}
                  >
                    {statusMeta?.label ?? o.status}
                  </span>
                </div>

                {/* Itens do pedido */}
                {o.items.length > 0 && (
                  <ul className="mb-3 space-y-1 rounded-lg p-2.5" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    {o.items.map((it, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="font-bold shrink-0" style={{ color: '#f97316' }}>{it.quantity}×</span>
                        <span style={{ color: '#dae2fd' }}>{it.name}</span>
                        {it.notes && (
                          <span className="text-[11px] italic ml-1" style={{ color: '#a78b7d' }}>↳ {it.notes}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

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
