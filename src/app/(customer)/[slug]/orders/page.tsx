'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order, SessionParticipant } from '@/types'
import { CustomerBottomNav } from '@/components/customer/bottom-nav'
import { CancelOrderModal } from '@/components/customer/cancel-order-modal'
import { formatCurrency } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type Tab = 'mine' | 'table'

const STATUS_CONFIG: Record<string, { label: string; color: string; progress: number }> = {
  pending:   { label: 'Aguardando',  color: '#f59e0b', progress: 15  },
  confirmed: { label: 'Confirmado',  color: '#7bd0ff', progress: 35  },
  preparing: { label: 'Preparando', color: '#f97316', progress: 65  },
  ready:     { label: 'Pronto!',    color: '#34d399', progress: 90  },
  delivered: { label: 'Entregue',   color: '#a78b7d', progress: 100 },
  cancelled: { label: 'Cancelado',  color: '#f87171', progress: 0   },
}

function statusOf(orders: Order[]) {
  const active = orders.find(o => !['delivered', 'cancelled'].includes(o.status))
  return active ? STATUS_CONFIG[active.status] ?? STATUS_CONFIG.pending : null
}

function isBillable(order: Order) {
  return order.status !== 'cancelled'
}

function totalOf(orders: Order[]) {
  return orders
    .filter(isBillable)
    .flatMap(o => o.items ?? [])
    .reduce((s, i) => s + i.unit_price * i.quantity, 0)
}

function orderItemsTotal(order: Order) {
  return (order.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0)
}

export default function OrdersPage() {
  const params      = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router      = useRouter()
  const sessionId   = searchParams.get('session')

  type PaymentProgress = {
    participantId: string
    name: string
    isMe: boolean
    amountOwed: number
    amountPaid: number | null
    status: string
  }

  const [tab, setTab]                 = useState<Tab>('mine')
  const [myOrders, setMyOrders]       = useState<Order[]>([])
  const [allOrders, setAllOrders]     = useState<Order[]>([])
  const [participants, setParticipants] = useState<SessionParticipant[]>([])
  const [loading, setLoading]         = useState(true)
  const [sessionClosing, setSessionClosing] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null)
  const [paymentProgress, setPaymentProgress] = useState<PaymentProgress[]>([])
  const [grandTotal, setGrandTotal]   = useState(0)
  const [sessionPaid, setSessionPaid] = useState(0)
  const [closeRequestActive, setCloseRequestActive] = useState(false)

  const customerId = typeof window !== 'undefined'
    ? localStorage.getItem('qomanda_customer_id') : null

  async function confirmCancelOrder() {
    if (!cancelTarget) return
    const orderId = cancelTarget.id

    if (!customerId) {
      toast.error('Não foi possível identificar sua conta.')
      return
    }

    setCancellingId(orderId)
    try {
      const res = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, customerId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao cancelar pedido.')
        return
      }
      toast.success('Pedido cancelado.')
      setMyOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o))
      setAllOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o))
      setCancelTarget(null)
    } catch {
      toast.error('Erro ao cancelar pedido.')
    } finally {
      setCancellingId(null)
    }
  }

  useEffect(() => {
    if (!sessionId) { router.replace(`/${params.slug}`); return }

    const supabase = createClient()

    async function load() {
      const [ordersRes, participantsRes, sessionRes, paymentsRes, closeReqRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*, items:order_items(*, menu_item:menu_items(*))')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false }),
        supabase
          .from('session_participants')
          .select('*, customer:customers(id, first_name, last_name)')
          .eq('session_id', sessionId),
        supabase
          .from('sessions')
          .select('status')
          .eq('id', sessionId)
          .single(),
        supabase
          .from('payments')
          .select('customer_id, amount')
          .eq('session_id', sessionId)
          .eq('status', 'paid'),
        supabase
          .from('close_requests')
          .select('id')
          .eq('session_id', sessionId)
          .eq('status', 'pending')
          .maybeSingle(),
      ])

      const orders = (ordersRes.data ?? []) as Order[]
      const parts = (participantsRes.data ?? []) as SessionParticipant[]
      setAllOrders(orders)
      setMyOrders(customerId ? orders.filter(o => o.customer_id === customerId) : orders)
      setParticipants(parts)
      if (sessionRes.data?.status === 'closing') setSessionClosing(true)

      const gt = totalOf(orders) * 1.1
      setGrandTotal(gt)

      const payments = paymentsRes.data ?? []
      const paidByCustomer = new Map<string, number>()
      for (const p of payments) {
        if (!p.customer_id) continue
        paidByCustomer.set(p.customer_id, (paidByCustomer.get(p.customer_id) ?? 0) + Number(p.amount))
      }
      const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0)
      setSessionPaid(totalPaid)

      let crParticipants: any[] = []
      if (closeReqRes.data) {
        const { data } = await supabase
          .from('close_request_participants')
          .select('*, customer:customers(first_name,last_name)')
          .eq('request_id', closeReqRes.data.id)
        crParticipants = data ?? []
      }
      setCloseRequestActive(crParticipants.length > 0)

      const progressSource = crParticipants.length > 0
        ? crParticipants.map((p: any) => ({
            participantId: p.customer_id as string,
            name: p.customer ? `${p.customer.first_name} ${p.customer.last_name}` : 'Cliente',
            amountOwed: Number(p.amount_owed),
            crStatus: p.status as string,
          }))
        : parts.map(p => ({
            participantId: p.customer_id,
            name: p.customer ? `${p.customer.first_name} ${p.customer.last_name}` : 'Cliente',
            amountOwed: totalOf(orders.filter(o => o.customer_id === p.customer_id)) * 1.1,
            crStatus: 'pending' as string,
          }))

      setPaymentProgress(progressSource.map(p => {
        const paid = paidByCustomer.get(p.participantId) ?? 0
        const fullyPaid = paid >= p.amountOwed - 0.02
        return {
          participantId: p.participantId,
          name: p.name,
          isMe: p.participantId === customerId,
          amountOwed: p.amountOwed,
          amountPaid: paid > 0 ? paid : null,
          status: fullyPaid ? 'paid' : paid > 0 ? 'confirmed' : p.crStatus,
        }
      }))

      setLoading(false)
    }

    load()

    // Realtime
    const ch1 = supabase.channel('orders-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `session_id=eq.${sessionId}` }, load)
      .subscribe()

    const ch2 = supabase.channel('session-watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, (p) => {
        if ((p.new as any)?.status === 'closing') setSessionClosing(true)
      })
      .subscribe()

    const ch3 = supabase.channel('payments-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `session_id=eq.${sessionId}` }, load)
      .subscribe()

    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3) }
  }, [sessionId, params.slug, router, customerId])

  const displayOrders = tab === 'mine' ? myOrders : allOrders
  const activeSt      = statusOf(tab === 'mine' ? myOrders : allOrders)
  const myTotal       = totalOf(myOrders)
  const tableTotal    = totalOf(allOrders)
  const serviceFee    = (tab === 'mine' ? myTotal : tableTotal) * 0.1

  // Group all orders by customer for Mesa Toda view
  const byCustomer = participants.map(p => ({
    participant: p,
    orders: allOrders.filter(o => o.customer_id === p.customer_id),
    total: totalOf(allOrders.filter(o => o.customer_id === p.customer_id)),
  }))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-36" style={{ background: '#0b1326', color: '#dae2fd' }}>
      <div className="pointer-events-none fixed top-0 right-0 w-[40%] h-[30%] rounded-full"
        style={{ background: 'rgba(249,115,22,0.05)', filter: 'blur(80px)' }} />

      {/* Header */}
      <header className="sticky top-0 z-40 flex justify-between items-center px-6 h-16"
        style={{ background: 'rgba(11,19,38,0.9)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full" style={{ color: '#ffb690' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Pedidos</h1>
        <div className="w-10" />
      </header>

      <main className="px-6 pt-5 space-y-5 relative z-10">
        {/* Session closing banner */}
        {sessionClosing && (
          <div className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)' }}>
            <span className="material-symbols-outlined text-[22px] shrink-0 mt-0.5" style={{ color: '#f97316' }}>notifications_active</span>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: '#ffb690' }}>O garçom está encerrando sua mesa</p>
              <button onClick={() => router.push(`/${params.slug}/checkout?session=${sessionId}`)}
                className="mt-2 text-xs font-mono font-bold px-4 py-2 rounded-lg active:scale-95 transition-all"
                style={{ background: '#f97316', color: '#582200' }}>
                Pagar agora →
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 p-1 rounded-xl" style={{ background: '#131b2e', border: '1px solid rgba(88,66,55,0.35)' }}>
          <button onClick={() => setTab('mine')}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: tab === 'mine' ? '#f97316' : 'transparent',
              color: tab === 'mine' ? '#582200' : '#a78b7d',
              fontFamily: 'Geist, sans-serif',
            }}>
            Minha Conta
          </button>
          <button onClick={() => setTab('table')}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
            style={{
              background: tab === 'table' ? '#f97316' : 'transparent',
              color: tab === 'table' ? '#582200' : '#a78b7d',
              fontFamily: 'Geist, sans-serif',
            }}>
            Mesa Toda
            {participants.length > 1 && (
              <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded-full"
                style={{
                  background: tab === 'table' ? 'rgba(88,34,0,0.2)' : 'rgba(249,115,22,0.15)',
                  color: tab === 'table' ? '#582200' : '#f97316',
                }}>
                {participants.length}
              </span>
            )}
          </button>
        </div>

        {/* Active status card */}
        {activeSt && (
          <div className="rounded-xl p-5 relative overflow-hidden"
            style={{ background: 'linear-gradient(145deg, #1e293b 0%, #131b2e 100%)', border: '1px solid #334155' }}>
            <div className="absolute top-0 right-0 p-3 pointer-events-none" style={{ opacity: 0.06 }}>
              <span className="material-symbols-outlined text-[80px]" style={{ color: activeSt.color }}>timer</span>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <span className="w-3 h-3 rounded-full shrink-0"
                style={{ background: activeSt.color, boxShadow: `0 0 8px ${activeSt.color}80`, animation: 'pulse 2s infinite' }} />
              <span className="text-xs font-mono uppercase tracking-widest" style={{ color: activeSt.color }}>
                {activeSt.label}
              </span>
            </div>
            <p className="text-xs mb-4" style={{ color: '#e0c0b1' }}>
              {tab === 'mine' ? 'Seu pedido está sendo preparado.' : `${allOrders.filter(o => !['delivered','cancelled'].includes(o.status)).length} pedido(s) ativos na mesa.`}
            </p>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: '#2d3449' }}>
              <div className="h-full rounded-full" style={{ width: `${activeSt.progress}%`, background: activeSt.color }} />
            </div>
          </div>
        )}

        {/* ── MINHA CONTA ──────────────────────────────────────── */}
        {tab === 'mine' && (
          <>
            {myOrders.length === 0 ? (
              <div className="py-12 text-center">
                <span className="material-symbols-outlined text-[48px] block mb-2" style={{ color: '#584237' }}>receipt_long</span>
                <p className="text-sm" style={{ color: '#a78b7d' }}>Você ainda não fez nenhum pedido.</p>
                <button onClick={() => router.push(`/${params.slug}/menu?session=${sessionId}`)}
                  className="text-sm mt-2 font-mono" style={{ color: '#f97316' }}>
                  Ver cardápio →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myOrders.map(order => {
                  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
                  const ot  = isBillable(order) ? orderItemsTotal(order) : 0
                  const cancelled = order.status === 'cancelled'
                  return (
                    <div key={order.id} className="rounded-xl overflow-hidden"
                      style={{
                        background: 'linear-gradient(145deg,#1e293b,#131b2e)',
                        border: `1px solid ${cancelled ? 'rgba(248,113,113,0.25)' : '#334155'}`,
                        opacity: cancelled ? 0.75 : 1,
                      }}>
                      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(88,66,55,0.2)' }}>
                        <span className="text-xs font-mono" style={{ color: '#a78b7d' }}>#{order.id.slice(-6).toUpperCase()}</span>
                        <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                          style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="px-4 py-3 space-y-2">
                        {(order.items ?? []).map(item => (
                          <div key={item.id}>
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-lg shrink-0 flex items-center justify-center"
                                style={{ background: '#2d3449' }}>
                                {item.menu_item?.image_url
                                  ? <img src={item.menu_item.image_url} alt="" className="w-full h-full object-cover rounded-lg" />
                                  : <span className="material-symbols-outlined text-[18px]" style={{ color: '#584237' }}>fastfood</span>}
                              </div>
                              <div className="flex-1 flex justify-between items-start">
                                <p className={`text-sm font-semibold ${cancelled ? 'line-through' : ''}`} style={cancelled ? { color: '#584237' } : undefined}>
                                  {item.quantity}x {item.menu_item?.name}
                                </p>
                                <p className={`text-sm font-mono ${cancelled ? 'line-through' : ''}`} style={{ color: cancelled ? '#584237' : '#ffb690' }}>
                                  {formatCurrency(item.unit_price * item.quantity)}
                                </p>
                              </div>
                            </div>
                            {item.notes && (
                              <p className="text-[11px] font-mono mt-1 ml-[60px] flex items-start gap-1" style={{ color: '#f59e0b' }}>
                                <span className="material-symbols-outlined text-[13px] shrink-0">chat</span>
                                {item.notes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center px-4 py-3" style={{ borderTop: '1px solid rgba(88,66,55,0.2)' }}>
                        <span className="text-xs font-mono" style={{ color: '#a78b7d' }}>Subtotal</span>
                        <span className={`text-sm font-semibold ${cancelled ? 'line-through' : ''}`} style={{ color: cancelled ? '#584237' : '#ffb690' }}>
                          {cancelled ? formatCurrency(orderItemsTotal(order)) : formatCurrency(ot)}
                        </span>
                      </div>
                      {order.status === 'pending' && (
                        <div className="px-4 pb-3">
                          <button
                            type="button"
                            onClick={() => setCancelTarget(order)}
                            disabled={cancellingId === order.id}
                            className="w-full py-2.5 rounded-lg text-xs font-mono font-bold transition-all active:scale-95 disabled:opacity-50"
                            style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
                          >
                            {cancellingId === order.id ? 'Cancelando...' : 'Cancelar pedido'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── MESA TODA ────────────────────────────────────────── */}
        {tab === 'table' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
                {participants.length} {participants.length === 1 ? 'pessoa' : 'pessoas'} nesta mesa
              </p>
            </div>

            {byCustomer.map(({ participant, orders, total }) => {
              const isMe = participant.customer_id === customerId
              const name = participant.customer
                ? `${participant.customer.first_name} ${participant.customer.last_name}`
                : 'Cliente'
              const activeOrder = orders.find(o => !['delivered','cancelled'].includes(o.status))
              const cfg = activeOrder ? STATUS_CONFIG[activeOrder.status] : null

              return (
                <div key={participant.id} className="rounded-xl overflow-hidden"
                  style={{
                    background: isMe ? 'linear-gradient(145deg,#1e3a1e,#131b2e)' : 'linear-gradient(145deg,#1e293b,#131b2e)',
                    border: `1px solid ${isMe ? 'rgba(52,211,153,0.3)' : '#334155'}`,
                  }}>
                  {/* Customer header */}
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(88,66,55,0.2)' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
                        style={{
                          background: isMe ? 'rgba(52,211,153,0.2)' : 'rgba(249,115,22,0.15)',
                          color: isMe ? '#34d399' : '#ffb690',
                        }}>
                        {participant.customer?.first_name?.charAt(0) ?? '?'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight">
                          {name} {isMe && <span className="text-[10px] font-mono" style={{ color: '#34d399' }}>(você)</span>}
                        </p>
                        {cfg && (
                          <p className="text-[10px] font-mono" style={{ color: cfg.color }}>{cfg.label}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-sm font-semibold font-mono" style={{ color: total > 0 ? '#ffb690' : '#584237' }}>
                      {total > 0 ? formatCurrency(total) : '—'}
                    </p>
                  </div>

                  {/* Orders summary */}
                  {orders.length > 0 && (
                    <div className="px-4 py-3 space-y-1.5">
                      {orders.flatMap(order => {
                        const cancelled = order.status === 'cancelled'
                        return (order.items ?? []).map((item, i) => (
                          <div
                            key={`${order.id}-${item.id ?? i}`}
                            className={`flex justify-between text-xs ${cancelled ? 'line-through' : ''}`}
                            style={{ color: cancelled ? '#584237' : '#e0c0b1' }}
                          >
                            <span>{item.quantity}x {item.menu_item?.name}</span>
                            <span className="font-mono">{formatCurrency(item.unit_price * item.quantity)}</span>
                          </div>
                        ))
                      })}
                    </div>
                  )}
                  {orders.length === 0 && (
                    <p className="px-4 py-3 text-xs" style={{ color: '#584237' }}>Nenhum pedido ainda</p>
                  )}
                </div>
              )
            })}

            {/* Payment progress — fonte: tabela payments (pagamentos individuais e mesa toda) */}
            {(sessionPaid > 0 || closeRequestActive) && (
              <div className="rounded-xl overflow-hidden" style={{ background: '#1e293b', border: '1px solid #334155' }}>
                <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(88,66,55,0.2)' }}>
                  <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
                    Progresso do Fechamento
                  </p>
                </div>
                {/* Progress bar */}
                {(() => {
                  const totalPaid  = sessionPaid
                  const pct        = grandTotal > 0 ? Math.min(100, (totalPaid / grandTotal) * 100) : 0
                  const remaining  = Math.max(0, grandTotal - totalPaid)
                  return (
                    <div className="px-5 py-4 space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-xs" style={{ color: '#a78b7d' }}>
                            {formatCurrency(totalPaid)} pagos
                          </span>
                          <span className="text-xs font-bold" style={{ color: remaining > 0 ? '#f87171' : '#34d399' }}>
                            {remaining > 0 ? `Falta ${formatCurrency(remaining)}` : '✓ Mesa fechada!'}
                          </span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#2d3449' }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: pct === 100 ? '#34d399' : '#f97316' }} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        {paymentProgress.map(p => (
                          <div key={p.participantId} className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-[16px]"
                              style={{ color: p.status === 'paid' ? '#34d399' : p.status === 'declined' ? '#f87171' : '#f59e0b', fontVariationSettings: p.status === 'paid' ? "'FILL' 1" : "'FILL' 0" }}>
                              {p.status === 'paid' ? 'check_circle' : p.status === 'declined' ? 'cancel' : 'pending'}
                            </span>
                            <span className="flex-1 text-sm" style={{ color: '#dae2fd' }}>
                              {p.name}{p.isMe && <span className="text-[10px] font-mono ml-1" style={{ color: '#34d399' }}>(você)</span>}
                            </span>
                            <span className="text-sm font-mono" style={{ color: (p.amountPaid ?? 0) > 0 ? '#34d399' : '#a78b7d' }}>
                              {p.amountPaid
                                ? formatCurrency(p.amountPaid)
                                : formatCurrency(p.amountOwed)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Table total */}
            {allOrders.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: '#171f33', border: '1px solid #334155' }}>
                <div className="flex justify-between text-sm mb-2" style={{ color: '#a78b7d' }}>
                  <span>Subtotal da mesa</span>
                  <span className="font-mono">{formatCurrency(tableTotal)}</span>
                </div>
                <div className="flex justify-between text-sm mb-3" style={{ color: '#a78b7d' }}>
                  <span>Taxa de serviço (10%)</span>
                  <span className="font-mono">{formatCurrency(tableTotal * 0.1)}</span>
                </div>
                {sessionPaid > 0 && (
                  <>
                    <div className="flex justify-between text-sm mb-2" style={{ color: '#34d399' }}>
                      <span>Já pago</span>
                      <span className="font-mono">− {formatCurrency(sessionPaid)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-3" style={{ color: sessionPaid >= tableTotal * 1.1 - 0.02 ? '#34d399' : '#f87171' }}>
                      <span>Restante</span>
                      <span className="font-mono font-bold">{formatCurrency(Math.max(0, tableTotal * 1.1 - sessionPaid))}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center pt-3" style={{ borderTop: '1px solid rgba(88,66,55,0.3)' }}>
                  <span className="font-semibold">Total da Mesa</span>
                  <span className="text-xl font-black" style={{ color: '#ffb690', fontFamily: 'Geist, sans-serif' }}>
                    {formatCurrency(tableTotal * 1.1)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary + CTA */}
        {displayOrders.length > 0 && (
          <>
            {tab === 'mine' && myOrders.length > 0 && (
              <div className="rounded-xl p-4 space-y-2" style={{ background: '#171f33', border: '1px solid #334155' }}>
                <div className="flex justify-between text-sm" style={{ color: '#a78b7d' }}>
                  <span>Subtotal</span>
                  <span className="font-mono">{formatCurrency(myTotal)}</span>
                </div>
                <div className="flex justify-between text-sm" style={{ color: '#a78b7d' }}>
                  <span>Taxa de serviço (10%)</span>
                  <span className="font-mono">{formatCurrency(myTotal * 0.1)}</span>
                </div>
                <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px solid rgba(88,66,55,0.3)' }}>
                  <span className="font-semibold">Meu Total</span>
                  <span className="text-xl font-black" style={{ color: '#ffb690', fontFamily: 'Geist, sans-serif' }}>
                    {formatCurrency(myTotal * 1.1)}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom action bar */}
      {allOrders.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-6 py-3 z-40"
          style={{ background: 'rgba(11,19,38,0.88)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(88,66,55,0.2)' }}>
          <button onClick={() => router.push(`/${params.slug}/checkout?session=${sessionId}`)}
            className="w-full h-14 rounded-xl font-semibold text-base flex items-center justify-center gap-3 active:scale-95 transition-all"
            style={{
              background: sessionClosing ? '#ef4444' : '#f97316',
              color: '#582200',
              boxShadow: '0 8px 30px rgba(249,115,22,0.3)',
              fontFamily: 'Geist, sans-serif',
            }}>
            <span className="material-symbols-outlined">payments</span>
            {sessionClosing ? 'Pagar Agora!' : 'Fechar Conta'}
          </button>
        </div>
      )}

      <CancelOrderModal
        order={cancelTarget}
        loading={!!cancelTarget && cancellingId === cancelTarget.id}
        onClose={() => { if (!cancellingId) setCancelTarget(null) }}
        onConfirm={confirmCancelOrder}
      />

      <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>
    </div>
  )
}
