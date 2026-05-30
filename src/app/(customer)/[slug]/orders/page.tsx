'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/types'
import { mockOrders } from '@/lib/dev-mock'
import { CustomerBottomNav } from '@/components/customer/bottom-nav'
import { formatCurrency } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; progress: number }> = {
  pending:   { label: 'Aguardando confirmação', color: '#f59e0b', icon: 'pending',      progress: 15  },
  confirmed: { label: 'Pedido confirmado',      color: '#7bd0ff', icon: 'check_circle', progress: 35  },
  preparing: { label: 'Preparando com carinho', color: '#f97316', icon: 'skillet',      progress: 65  },
  ready:     { label: 'Pronto! A caminho',      color: '#34d399', icon: 'done_all',     progress: 90  },
  delivered: { label: 'Entregue',              color: '#a78b7d', icon: 'check',         progress: 100 },
  cancelled: { label: 'Cancelado',             color: '#f87171', icon: 'cancel',        progress: 0   },
}

export default function OrdersPage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session')

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [sessionClosing, setSessionClosing] = useState(false)

  useEffect(() => {
    if (!sessionId) { router.replace(`/${params.slug}`); return }

    if (params.slug === 'demo') {
      setOrders(mockOrders)
      const sum = mockOrders.flatMap(o => o.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0)
      setTotal(sum)
      setLoading(false)
      return
    }

    async function loadOrders() {
      const supabase = createClient()
      const { data } = await supabase
        .from('orders')
        .select('*, items:order_items(*, menu_item:menu_items(*))')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })

      const ordersData = (data ?? []) as Order[]
      setOrders(ordersData)
      setTotal(ordersData.flatMap(o => o.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0))
      setLoading(false)
    }

    async function checkSessionStatus() {
      const supabase = createClient()
      const { data } = await supabase.from('sessions').select('status').eq('id', sessionId).single()
      if (data?.status === 'closing') setSessionClosing(true)
    }

    loadOrders()
    checkSessionStatus()

    const supabase = createClient()

    const ordersChannel = supabase
      .channel('customer-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `session_id=eq.${sessionId}` }, () => loadOrders())
      .subscribe()

    const sessionChannel = supabase
      .channel('customer-session')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, (payload) => {
        if ((payload.new as any)?.status === 'closing') setSessionClosing(true)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(ordersChannel)
      supabase.removeChannel(sessionChannel)
    }
  }, [sessionId, params.slug, router])

  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status))
  const latestActive = activeOrders[0]
  const activeCfg = latestActive ? (STATUS_CONFIG[latestActive.status] ?? STATUS_CONFIG.pending) : null

  const serviceFee = total * 0.1

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-36" style={{ background: '#0b1326', color: '#dae2fd' }}>
      {/* Ambient */}
      <div className="pointer-events-none fixed top-0 right-0 w-[40%] h-[30%] rounded-full" style={{ background: 'rgba(249,115,22,0.05)', filter: 'blur(80px)' }} />

      {/* Header */}
      <header
        className="sticky top-0 z-40 flex justify-between items-center px-6 h-16"
        style={{ background: 'rgba(11,19,38,0.85)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}
      >
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full transition-colors" style={{ color: '#ffb690' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Meus Pedidos</h1>
        <div className="w-10" />
      </header>

      <main className="px-6 pt-5 space-y-5 relative z-10">
        {/* Session closing banner */}
        {sessionClosing && (
          <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)' }}>
            <span className="material-symbols-outlined text-[22px] shrink-0 mt-0.5" style={{ color: '#f97316' }}>notifications_active</span>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: '#ffb690' }}>O garçom está encerrando sua mesa</p>
              <p className="text-xs mt-0.5" style={{ color: '#e0c0b1' }}>Escolha como deseja pagar e feche sua conta.</p>
              <button
                onClick={() => router.push(`/${params.slug}/checkout?session=${sessionId}`)}
                className="mt-3 text-xs font-mono font-bold px-4 py-2 rounded-lg active:scale-95 transition-all"
                style={{ background: '#f97316', color: '#582200' }}
              >
                Pagar agora →
              </button>
            </div>
          </div>
        )}

        {/* Active order status */}
        {latestActive && activeCfg && (
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: '#a78b7d' }}>Status atual</p>
            <div
              className="rounded-xl p-5 relative overflow-hidden"
              style={{ background: 'linear-gradient(145deg, #1e293b 0%, #131b2e 100%)', border: '1px solid #334155' }}
            >
              <div className="absolute top-0 right-0 p-3 pointer-events-none" style={{ opacity: 0.06 }}>
                <span className="material-symbols-outlined text-[80px]" style={{ color: activeCfg.color }}>timer</span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: activeCfg.color, boxShadow: `0 0 8px ${activeCfg.color}80`, animation: 'pulse 2s infinite' }}
                />
                <span className="text-xs font-mono uppercase tracking-widest" style={{ color: activeCfg.color }}>
                  {activeCfg.label}
                </span>
              </div>
              <p className="text-xs mb-4" style={{ color: '#e0c0b1' }}>
                Seu pedido está sendo cuidado pela nossa cozinha.
              </p>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: '#2d3449' }}>
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${activeCfg.progress}%`, background: activeCfg.color, boxShadow: `0 0 12px ${activeCfg.color}60` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Orders list */}
        {orders.length === 0 ? (
          <div className="py-16 text-center">
            <span className="material-symbols-outlined text-[56px] mb-3 block" style={{ color: '#584237' }}>receipt_long</span>
            <p className="text-base font-semibold" style={{ color: '#dae2fd' }}>Nenhum pedido ainda</p>
            <button
              onClick={() => router.push(`/${params.slug}/menu?session=${sessionId}`)}
              className="text-sm mt-2 font-mono"
              style={{ color: '#f97316' }}
            >
              Ver cardápio →
            </button>
          </div>
        ) : (
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: '#a78b7d' }}>
              {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
            </p>
            <div className="space-y-3">
              {orders.map(order => {
                const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
                const orderTotal = (order.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0)
                return (
                  <div key={order.id} className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(145deg, #1e293b 0%, #131b2e 100%)', border: '1px solid #334155' }}>
                    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(88,66,55,0.2)' }}>
                      <span className="text-xs font-mono" style={{ color: '#a78b7d' }}>
                        #{order.id.slice(-6).toUpperCase()}
                      </span>
                      <span
                        className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                        style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      {(order.items ?? []).map(item => (
                        <div key={item.id} className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ background: '#2d3449' }}>
                            {item.menu_item?.image_url ? (
                              <img src={item.menu_item.image_url} alt={item.menu_item?.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="material-symbols-outlined text-[20px]" style={{ color: '#584237' }}>fastfood</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <p className="text-sm font-semibold" style={{ color: '#dae2fd' }}>
                                {item.quantity}x {item.menu_item?.name}
                              </p>
                              <p className="text-sm font-mono" style={{ color: '#ffb690' }}>
                                {formatCurrency(item.unit_price * item.quantity)}
                              </p>
                            </div>
                            {item.menu_item?.description && (
                              <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#a78b7d' }}>{item.menu_item.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center px-4 py-3" style={{ borderTop: '1px solid rgba(88,66,55,0.2)' }}>
                      <span className="text-xs font-mono" style={{ color: '#a78b7d' }}>Subtotal</span>
                      <span className="text-sm font-semibold" style={{ color: '#ffb690' }}>{formatCurrency(orderTotal)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Total summary */}
        {orders.length > 0 && (
          <div className="rounded-xl p-5 space-y-3" style={{ background: '#171f33', border: '1px solid #334155' }}>
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Subtotal</span>
              <span className="text-sm font-mono" style={{ color: '#dae2fd' }}>{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Taxa de Serviço (10%)</span>
              <span className="text-sm font-mono" style={{ color: '#dae2fd' }}>{formatCurrency(serviceFee)}</span>
            </div>
            <div className="flex justify-between items-center pt-3" style={{ borderTop: '1px solid rgba(88,66,55,0.3)' }}>
              <span className="text-base font-semibold" style={{ color: '#dae2fd', fontFamily: 'Geist, sans-serif' }}>Total</span>
              <span className="text-xl font-bold" style={{ color: '#ffb690', fontFamily: 'Geist, sans-serif' }}>
                {formatCurrency(total + serviceFee)}
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Bottom action bar */}
      {orders.length > 0 && (
        <div
          className="fixed bottom-20 left-0 right-0 px-6 py-3 z-40"
          style={{ background: 'rgba(11,19,38,0.8)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(88,66,55,0.2)' }}
        >
          <button
            onClick={() => router.push(`/${params.slug}/checkout?session=${sessionId}`)}
            className="w-full h-14 rounded-xl font-semibold text-base flex items-center justify-center gap-3 active:scale-95 transition-all"
            style={{
              background: sessionClosing ? '#ef4444' : '#f97316',
              color: '#582200',
              boxShadow: '0 8px 30px rgba(249,115,22,0.3)',
              fontFamily: 'Geist, sans-serif',
            }}
          >
            <span className="material-symbols-outlined">payments</span>
            {sessionClosing ? 'Pagar Agora!' : 'Fechar Conta'}
          </button>
        </div>
      )}

      <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
