'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderItem } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Loader2, ArrowLeft, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Aguardando',  color: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmado',  color: 'bg-blue-100 text-blue-700' },
  preparing: { label: 'Preparando',  color: 'bg-purple-100 text-purple-700' },
  ready:     { label: 'Pronto',      color: 'bg-green-100 text-green-700' },
  delivered: { label: 'Entregue',    color: 'bg-slate-100 text-slate-600' },
  cancelled: { label: 'Cancelado',   color: 'bg-red-100 text-red-600' },
}

export default function OrdersPage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session')

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!sessionId) { router.replace(`/${params.slug}`); return }

    async function loadOrders() {
      const supabase = createClient()
      const { data } = await supabase
        .from('orders')
        .select('*, items:order_items(*, menu_item:menu_items(*))')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })

      const ordersData = (data ?? []) as Order[]
      setOrders(ordersData)
      const sum = ordersData.flatMap((o) => o.items ?? []).reduce(
        (acc, i) => acc + (i.unit_price * i.quantity), 0
      )
      setTotal(sum)
      setLoading(false)
    }

    loadOrders()

    const supabase = createClient()
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `session_id=eq.${sessionId}` }, () => {
        loadOrders()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId, params.slug, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <h1 className="text-lg font-bold text-slate-900">Meus Pedidos</h1>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-8">
          <Receipt className="h-16 w-16 text-slate-200 mb-4" />
          <p className="text-slate-500">Nenhum pedido ainda.</p>
          <button onClick={() => router.back()} className="text-orange-500 font-medium mt-2">Ver cardápio</button>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-4">
          {orders.map((order) => {
            const status = STATUS_LABEL[order.status] ?? STATUS_LABEL.pending
            const orderTotal = (order.items ?? []).reduce((acc, i) => acc + i.unit_price * i.quantity, 0)
            return (
              <div key={order.id} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-slate-500">#{order.id.slice(-6).toUpperCase()}</span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${status.color}`}>{status.label}</span>
                </div>
                <div className="space-y-2">
                  {(order.items ?? []).map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-slate-700">{item.quantity}x {item.menu_item?.name}</span>
                      <span className="text-slate-600">{formatCurrency(item.unit_price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-100 mt-3 pt-3 flex justify-between">
                  <span className="text-sm font-semibold text-slate-700">Subtotal</span>
                  <span className="text-sm font-bold text-orange-500">{formatCurrency(orderTotal)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {orders.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100">
          <div className="flex justify-between items-center mb-3 px-1">
            <span className="font-semibold text-slate-700">Total da Conta</span>
            <span className="text-xl font-black text-orange-500">{formatCurrency(total)}</span>
          </div>
          <Button
            onClick={() => router.push(`/${params.slug}/checkout?session=${sessionId}`)}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white h-14 rounded-xl text-base font-semibold"
          >
            Fechar Conta
          </Button>
        </div>
      )}
    </div>
  )
}
