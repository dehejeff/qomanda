'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { DEV_BYPASS, mockOrders } from '@/lib/dev-mock'

const STATUS_FLOW: Record<string, string> = {
  pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'delivered',
}

const STATUS_CONFIG: Record<string, { label: string; next: string; badge: string }> = {
  pending:   { label: 'Aguardando', next: 'Confirmar', badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  confirmed: { label: 'Confirmado', next: 'Preparar',  badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  preparing: { label: 'Preparando', next: 'Pronto',    badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  ready:     { label: 'Pronto',     next: 'Entregar',  badge: 'bg-primary-container/20 text-primary border border-primary/20' },
  delivered: { label: 'Entregue',   next: '',          badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  async function loadOrders(restaurantId: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select('*, items:order_items(*, menu_item:menu_items(name)), session:sessions(table:tables(number))')
      .eq('restaurant_id', restaurantId)
      .not('status', 'in', '("delivered","cancelled")')
      .order('created_at')
    setOrders((data ?? []) as Order[])
    setLoading(false)
  }

  useEffect(() => {
    if (DEV_BYPASS) { setOrders(mockOrders as Order[]); setLoading(false); return }

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

      // Canal com nome único por restaurante para evitar conflito de re-subscribe
      channel = supabase
        .channel(`dashboard-orders-${restaurantId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
          () => { if (!cancelled) loadOrders(restaurantId) }
        )
        .subscribe()
    }

    init()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  async function advanceStatus(orderId: string, currentStatus: string) {
    const next = STATUS_FLOW[currentStatus]
    if (!next) return
    if (DEV_BYPASS) {
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: next as Order['status'] } : o).filter((o) => o.status !== 'delivered'))
      return
    }
    const supabase = createClient()
    const { error } = await supabase.from('orders').update({ status: next, updated_at: new Date().toISOString() }).eq('id', orderId)
    if (error) { toast.error('Erro ao atualizar pedido'); return }
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: next as Order['status'] } : o).filter((o) => o.status !== 'delivered'))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-primary-container" />
    </div>
  )

  if (orders.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30 mb-3">receipt_long</span>
      <p className="text-sm font-mono text-on-surface-variant">Nenhum pedido em aberto</p>
    </div>
  )

  return (
    <div className="space-y-stack-lg">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}>Pedidos</h2>
          <p className="text-sm text-on-surface-variant mt-1">{orders.length} pedido{orders.length !== 1 ? 's' : ''} em aberto — atualização em tempo real.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-card-gap">
        {orders.map((order) => {
          const s = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
          const total = (order.items ?? []).reduce((a, i) => a + i.unit_price * i.quantity, 0)
          const time = new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          const tableNumber = (order as any).session?.table?.number
          return (
            <div key={order.id} className="bg-surface-container border border-outline-variant rounded-xl p-4 flex flex-col gap-4 hover:border-primary/50 transition-colors">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold font-mono text-on-surface">#{order.id.slice(-6).toUpperCase()}</span>
                  {tableNumber && (
                    <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant">
                      <span className="material-symbols-outlined text-[12px]">table_restaurant</span>
                      {tableNumber}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-on-surface-variant">{time}</span>
                  <span className={`text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded ${s.badge}`}>{s.label}</span>
                </div>
              </div>

              {/* Items */}
              <div className="flex-1 space-y-2 border-t border-outline-variant pt-3">
                {(order.items ?? []).map((item) => (
                  <div key={item.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-on-surface-variant font-mono">
                        <span className="text-on-surface-variant/60 mr-1">{item.quantity}×</span>
                        {item.menu_item?.name}
                      </span>
                      <span className="text-on-surface-variant font-mono tabular-nums">{formatCurrency(item.unit_price * item.quantity)}</span>
                    </div>
                    {item.notes && (
                      <p className="text-[11px] font-mono text-amber-400/90 pl-5 flex items-start gap-1">
                        <span className="material-symbols-outlined text-[13px] shrink-0 mt-px">chat</span>
                        {item.notes}
                      </p>
                    )}
                  </div>
                ))}
                {order.notes && (
                  <p className="text-[11px] font-mono text-amber-400/90 flex items-start gap-1 pt-1">
                    <span className="material-symbols-outlined text-[13px] shrink-0 mt-px">sticky_note_2</span>
                    {order.notes}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-outline-variant pt-3">
                <span className="text-sm font-bold font-mono text-primary">{formatCurrency(total)}</span>
                {s.next && (
                  <button
                    onClick={() => advanceStatus(order.id, order.status)}
                    className="text-xs font-bold font-mono text-on-primary-container bg-primary-container hover:opacity-90 px-3 py-1.5 rounded-lg transition-opacity"
                  >
                    {s.next} →
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
