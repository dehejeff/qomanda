'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { DEV_BYPASS, mockOrders } from '@/lib/dev-mock'
import { useOrderRealtime } from '@/lib/use-restaurant-realtime'

const STATUS_FLOW: Record<string, string> = {
  pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'delivered',
}

const STATUS_CONFIG: Record<string, { label: string; next: string; badge: string }> = {
  pending:   { label: 'Aguardando', next: 'Confirmar', badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  confirmed: { label: 'Confirmado', next: 'Preparar',  badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  preparing: { label: 'Preparando', next: 'Pronto',    badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  ready:     { label: 'Pronto',     next: 'Entregar',  badge: 'bg-primary-container/20 text-primary border border-primary/20' },
  delivered: { label: 'Servido',    next: '',          badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  cancelled: { label: 'Cancelado',  next: '',          badge: 'bg-red-500/10 text-red-400 border border-red-500/20' },
}

type OrderDetail = Order & {
  session?: { table?: { number?: string } | null } | null
  customer?: { first_name?: string; last_name?: string } | null
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [advancing, setAdvancing] = useState(false)

  useEffect(() => {
    async function load() {
      if (DEV_BYPASS) {
        const found = (mockOrders as OrderDetail[]).find((o) => o.id === params.id) ?? null
        setOrder(found)
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

      const { data } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(*, menu_item:menu_items(name, image_url)),
          session:sessions(table:tables(number)),
          customer:customers(first_name, last_name)
        `)
        .eq('id', params.id)
        .eq('restaurant_id', restaurant.id)
        .single()

      setOrder((data as OrderDetail) ?? null)
      setLoading(false)
    }

    load()
  }, [params.id, router])

  useOrderRealtime(
    DEV_BYPASS ? null : params.id,
    () => {
      if (DEV_BYPASS) return
      const supabase = createClient()
      supabase
        .from('orders')
        .select(`
          *,
          items:order_items(*, menu_item:menu_items(name, image_url)),
          session:sessions(table:tables(number)),
          customer:customers(first_name, last_name)
        `)
        .eq('id', params.id)
        .single()
        .then(({ data }) => { if (data) setOrder(data as OrderDetail) })
    },
    !DEV_BYPASS,
  )

  async function advanceStatus() {
    if (!order) return
    const next = STATUS_FLOW[order.status]
    if (!next) return

    setAdvancing(true)
    if (DEV_BYPASS) {
      setOrder({ ...order, status: next as Order['status'] })
      setAdvancing(false)
      toast.success('Status atualizado.')
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', order.id)

    setAdvancing(false)
    if (error) { toast.error('Erro ao atualizar pedido.'); return }

    setOrder({ ...order, status: next as Order['status'] })
    toast.success('Status atualizado.')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-container" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30">receipt_long</span>
        <p className="text-sm font-mono text-on-surface-variant">Pedido não encontrado</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-xs font-mono text-primary hover:underline"
        >
          ← Voltar
        </button>
      </div>
    )
  }

  const s = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
  const total = (order.items ?? []).reduce((a, i) => a + i.unit_price * i.quantity, 0)
  const tableNumber = order.session?.table?.number
  const customerName = order.customer
    ? [order.customer.first_name, order.customer.last_name].filter(Boolean).join(' ')
    : '—'
  const createdAt = new Date(order.created_at)
  const updatedAt = new Date(order.updated_at)

  return (
    <div className="space-y-stack-lg max-w-2xl">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container-highest transition-colors"
        >
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">arrow_back</span>
        </button>
        <div className="flex-1">
          <h2
            className="text-2xl font-semibold text-on-surface"
            style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}
          >
            Pedido #{order.id.slice(-6).toUpperCase()}
          </h2>
          <p className="text-xs font-mono text-on-surface-variant mt-0.5">
            {createdAt.toLocaleDateString('pt-BR')} · {createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <span className={`text-[10px] font-bold font-mono uppercase px-2.5 py-1 rounded ${s.badge}`}>
          {s.label}
        </span>
      </div>

      <div className="tonal-layer-1 ghost-border rounded-xl p-stack-lg grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Cliente</p>
          <p className="text-sm font-semibold text-on-surface mt-1">{customerName}</p>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Mesa</p>
          <p className="text-sm font-bold font-mono text-primary mt-1">{tableNumber ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Criado em</p>
          <p className="text-sm font-mono text-on-surface mt-1">
            {createdAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Atualizado em</p>
          <p className="text-sm font-mono text-on-surface mt-1">
            {updatedAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        </div>
      </div>

      <div className="tonal-layer-1 ghost-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-outline-variant">
          <p className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Itens do pedido</p>
        </div>
        <div className="divide-y divide-outline-variant">
          {(order.items ?? []).length === 0 ? (
            <p className="px-5 py-8 text-sm font-mono text-on-surface-variant text-center">Nenhum item</p>
          ) : (
            (order.items ?? []).map((item) => (
              <div key={item.id} className="px-5 py-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface font-mono">
                    <span className="text-on-surface-variant/60 mr-1">{item.quantity}×</span>
                    {item.menu_item?.name ?? 'Item'}
                  </span>
                  <span className="text-on-surface font-mono tabular-nums">{formatCurrency(item.unit_price * item.quantity)}</span>
                </div>
                {item.notes && (
                  <p className="text-[11px] font-mono text-amber-400/90 pl-5 flex items-start gap-1">
                    <span className="material-symbols-outlined text-[13px] shrink-0 mt-px">chat</span>
                    {item.notes}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
        {order.notes && (
          <div className="px-5 py-3 border-t border-outline-variant">
            <p className="text-[11px] font-mono text-amber-400/90 flex items-start gap-1">
              <span className="material-symbols-outlined text-[13px] shrink-0 mt-px">sticky_note_2</span>
              {order.notes}
            </p>
          </div>
        )}
        <div className="px-5 py-4 border-t border-outline-variant flex items-center justify-between">
          <span className="text-sm font-mono text-on-surface-variant">Total</span>
          <span className="text-lg font-bold font-mono text-primary">{formatCurrency(total)}</span>
        </div>
      </div>

      {s.next && (
        <button
          type="button"
          onClick={advanceStatus}
          disabled={advancing}
          className="w-full sm:w-auto text-sm font-bold font-mono text-on-primary-container bg-primary-container hover:opacity-90 px-6 py-3 rounded-xl transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {advancing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {s.next} →
        </button>
      )}

      <Link href="/dashboard/orders" className="inline-block text-xs font-mono text-primary hover:underline">
        Ver fila de pedidos em aberto
      </Link>
    </div>
  )
}
