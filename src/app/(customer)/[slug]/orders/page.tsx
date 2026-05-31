'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order, SessionParticipant } from '@/types'
import { CustomerBottomNav } from '@/components/customer/bottom-nav'
import { CancelOrderModal } from '@/components/customer/cancel-order-modal'
import { formatCurrency } from '@/lib/utils'
import {
  buildSessionBilling,
  buildCustomerBilling,
  allocatePaymentToItemLines,
  amountWithServiceFee,
  type CustomerBilling,
} from '@/lib/session-billing'
import { ParticipantPaymentRow } from '@/components/customer/participant-payment-row'
import { ItemStatusIcon } from '@/components/customer/item-status-icon'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { redirectAfterSessionEnd } from '@/lib/customer-auth'

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

function consumptionWithFee(subtotal: number) {
  return amountWithServiceFee(subtotal, true)
}

type PayStatus = 'paid' | 'partial' | 'pending' | 'none'

function paymentStatus(owed: number, paid: number): PayStatus {
  if (owed <= 0.01) return 'none'
  if (paid >= owed - 0.02) return 'paid'
  if (paid > 0.01) return 'partial'
  return 'pending'
}

function CustomerPayBadge({ status, paid, owed }: { status: PayStatus; paid: number; owed: number }) {
  if (status === 'none') return null
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
        <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
        Quitado
      </span>
    )
  }
  if (status === 'partial') {
    return (
      <span className="text-[10px] font-mono" style={{ color: '#f59e0b' }}>
        Pago {formatCurrency(paid)} · Falta {formatCurrency(Math.max(0, owed - paid))}
      </span>
    )
  }
  return (
    <span className="text-[10px] font-mono uppercase tracking-wide" style={{ color: '#a78b7d' }}>
      A pagar · taxa opcional
    </span>
  )
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
    billing: CustomerBilling
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
  const [sessionBilling, setSessionBilling] = useState<ReturnType<typeof buildSessionBilling> | null>(null)
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
          .select('customer_id, amount, service_fee_included')
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

      const gt = buildSessionBilling(
        orders,
        paymentsRes.data ?? [],
        parts.map(p => p.customer_id),
      )
      setSessionBilling(gt)

      let crParticipants: any[] = []
      if (closeReqRes.data) {
        const { data } = await supabase
          .from('close_request_participants')
          .select('*, customer:customers(first_name,last_name)')
          .eq('request_id', closeReqRes.data.id)
        crParticipants = data ?? []
      }
      setCloseRequestActive(crParticipants.length > 0)

      setPaymentProgress(parts.map(p => {
        const billing = gt.billings.find(b => b.customerId === p.customer_id)
          ?? buildSessionBilling(orders, paymentsRes.data ?? [], [p.customer_id]).billings[0]
        return {
          participantId: p.customer_id,
          name: p.customer ? `${p.customer.first_name} ${p.customer.last_name}` : 'Cliente',
          isMe: p.customer_id === customerId,
          billing,
          status: billing.status === 'paid' ? 'paid' : billing.status === 'partial' ? 'partial' : 'pending',
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
        const status = (p.new as any)?.status
        if (status === 'closing') setSessionClosing(true)
        if (status === 'closed') {
          redirectAfterSessionEnd(router, params.slug)
        }
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
  const myBilling     = paymentProgress.find(p => p.isMe)?.billing
  const myOwed        = myBilling?.amountDue ?? consumptionWithFee(myTotal)
  const myPaid        = myBilling?.paid ?? 0
  const myPayStatus   = paymentStatus(myOwed, myPaid)
  const grandTotal    = sessionBilling?.grandTotal ?? consumptionWithFee(tableTotal)
  const sessionPaid   = sessionBilling?.totalPaid ?? 0
  const sessionRemaining = sessionBilling?.remaining ?? Math.max(0, grandTotal - sessionPaid)
  const sessionFullyPaid = grandTotal > 0 && sessionPaid >= grandTotal - 0.02

  function paidForCustomer(customerId: string) {
    return paymentProgress.find(p => p.participantId === customerId)?.billing.paid ?? 0
  }

  function billingForCustomer(customerId: string): CustomerBilling | undefined {
    return paymentProgress.find(p => p.participantId === customerId)?.billing
  }

  // Group all orders by customer for Mesa Toda view
  const byCustomer = participants.map(p => ({
    participant: p,
    orders: allOrders.filter(o => o.customer_id === p.customer_id),
    total: totalOf(allOrders.filter(o => o.customer_id === p.customer_id)),
  }))

  const myItemLines = useMemo(() => {
    const b = paymentProgress.find(p => p.isMe)?.billing
      ?? buildCustomerBilling(customerId ?? '', myTotal, myPaid, [])
    return allocatePaymentToItemLines(myOrders, b)
  }, [myOrders, paymentProgress, customerId, myTotal, myPaid])

  const payerNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of paymentProgress) map[p.participantId] = p.name
    for (const p of participants) {
      if (p.customer_id && p.customer) {
        map[p.customer_id] = `${p.customer.first_name} ${p.customer.last_name}`.trim()
      }
    }
    return map
  }, [paymentProgress, participants])

  function coveredByLabel(billing: CustomerBilling) {
    const covers = (billing.coveredBy ?? []).filter(c => c.amount > 0.01)
    if (covers.length === 0) return null
    return covers.map(c => payerNames[c.payerId] ?? 'outro cliente').join(', ')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-56" style={{ background: '#0b1326', color: '#dae2fd' }}>
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
            {myPayStatus === 'paid' && myOwed > 0 && (
              <div className="rounded-xl px-4 py-3 flex items-start gap-3"
                style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)' }}>
                <span className="material-symbols-outlined text-[20px] shrink-0" style={{ color: '#34d399', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <p className="text-sm leading-relaxed" style={{ color: '#34d399' }}>
                  <strong>Sua parte está quitada</strong> ({formatCurrency(myPaid)}).
                  {myBilling && coveredByLabel(myBilling) && (myBilling.paidBySelf ?? 0) <= 0.01 && (
                    <> Pago por <strong>{coveredByLabel(myBilling)}</strong>.</>
                  )}
                  {sessionRemaining > 0.01
                    ? ` Falta ${formatCurrency(sessionRemaining)} para fechar a mesa.`
                    : ' A mesa está totalmente paga!'}
                </p>
              </div>
            )}
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
                        border: `1px solid ${cancelled ? 'rgba(248,113,113,0.2)' : '#334155'}`,
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
                        {(order.items ?? []).map((item, idx) => {
                          const line = myItemLines.find(l => l.itemKey === `${order.id}-${item.id ?? idx}`)
                          const payStatus = line?.paymentStatus ?? (cancelled ? 'cancelled' : 'pending')
                          return (
                          <div key={item.id ?? idx}>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-12 h-12 rounded-lg shrink-0 flex items-center justify-center"
                                style={{ background: '#2d3449' }}>
                                {item.menu_item?.image_url
                                  ? <img src={item.menu_item.image_url} alt="" className="w-full h-full object-cover rounded-lg" />
                                  : <span className="material-symbols-outlined text-[18px]" style={{ color: '#584237' }}>fastfood</span>}
                              </div>
                              <div className="flex-1 flex items-center gap-2 min-w-0">
                                <ItemStatusIcon status={payStatus} />
                                <p className={`flex-1 min-w-0 truncate text-sm font-semibold ${cancelled ? 'line-through' : ''}`}
                                  style={cancelled ? { color: '#584237' } : undefined}>
                                  {item.quantity}x {item.menu_item?.name}
                                </p>
                                <p className={`text-sm font-mono shrink-0 ${cancelled ? 'line-through' : ''}`}
                                  style={{ color: cancelled ? '#584237' : '#ffb690' }}>
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
                          )
                        })}
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
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
                {participants.length} {participants.length === 1 ? 'pessoa' : 'pessoas'} nesta mesa
              </p>
              <div className="flex flex-wrap gap-2 ml-auto">
                <span className="inline-flex items-center gap-1 text-[9px] font-mono" style={{ color: '#34d399' }}>
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  Pago
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-mono" style={{ color: '#584237' }}>
                  <span className="material-symbols-outlined text-[12px]">radio_button_unchecked</span>
                  Pendente
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-mono" style={{ color: '#f87171' }}>
                  <span className="material-symbols-outlined text-[12px]">close</span>
                  Cancelado
                </span>
              </div>
            </div>

            {byCustomer.map(({ participant, orders, total }) => {
              const isMe = participant.customer_id === customerId
              const name = participant.customer
                ? `${participant.customer.first_name} ${participant.customer.last_name}`
                : 'Cliente'
              const activeOrder = orders.find(o => !['delivered','cancelled'].includes(o.status))
              const cfg = activeOrder ? STATUS_CONFIG[activeOrder.status] : null
              const billing = billingForCustomer(participant.customer_id)
                ?? buildCustomerBilling(participant.customer_id, total, 0, [])
              const owed = billing.amountDue
              const paid = billing.paid
              const paySt = billing.status
              const customerFullyPaid = paySt === 'paid'
              const paidByOther = coveredByLabel(billing)
              const itemLines = allocatePaymentToItemLines(orders, billing)

              return (
                <div key={participant.id} className="rounded-xl overflow-hidden"
                  style={{
                    background: customerFullyPaid
                      ? 'linear-gradient(145deg,#1a2e1a,#131b2e)'
                      : isMe ? 'linear-gradient(145deg,#1e3a1e,#131b2e)' : 'linear-gradient(145deg,#1e293b,#131b2e)',
                    border: `1px solid ${customerFullyPaid ? 'rgba(52,211,153,0.35)' : isMe ? 'rgba(52,211,153,0.3)' : '#334155'}`,
                  }}>
                  {/* Customer header */}
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(88,66,55,0.2)' }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                        style={{
                          background: customerFullyPaid ? 'rgba(52,211,153,0.2)' : isMe ? 'rgba(52,211,153,0.2)' : 'rgba(249,115,22,0.15)',
                          color: customerFullyPaid || isMe ? '#34d399' : '#ffb690',
                        }}>
                        {customerFullyPaid
                          ? <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                          : (participant.customer?.first_name?.charAt(0) ?? '?')}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate">
                          {name} {isMe && <span className="text-[10px] font-mono" style={{ color: '#34d399' }}>(você)</span>}
                        </p>
                        <div className="mt-0.5">
                          <CustomerPayBadge status={paySt} paid={paid} owed={owed} />
                        </div>
                        {customerFullyPaid && paidByOther && (
                          <p className="text-[10px] font-mono mt-1" style={{ color: '#34d399' }}>
                            Pago por {paidByOther}
                          </p>
                        )}
                        {cfg && paySt !== 'paid' && (
                          <p className="text-[10px] font-mono mt-0.5" style={{ color: cfg.color }}>{cfg.label}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      {customerFullyPaid ? (
                        <>
                          <p className="text-sm font-bold font-mono" style={{ color: '#34d399' }}>{formatCurrency(paid)}</p>
                          <p className="text-[10px] font-mono line-through" style={{ color: '#584237' }}>{formatCurrency(owed)}</p>
                        </>
                      ) : paySt === 'partial' ? (
                        <>
                          <p className="text-sm font-semibold font-mono" style={{ color: '#ffb690' }}>{formatCurrency(owed)}</p>
                          <p className="text-[10px] font-mono" style={{ color: '#34d399' }}>−{formatCurrency(paid)} pago</p>
                        </>
                      ) : (
                        <p className="text-sm font-semibold font-mono" style={{ color: total > 0 ? '#ffb690' : '#584237' }}>
                          {total > 0 ? formatCurrency(owed) : '—'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Items — uma linha por produto */}
                  {itemLines.length > 0 && (
                    <div className="px-4 py-3 space-y-1.5">
                      {itemLines.map(line => {
                        const cancelled = line.paymentStatus === 'cancelled'
                        return (
                          <div
                            key={line.itemKey}
                            className={`flex items-center gap-2 text-xs min-w-0 ${cancelled ? 'opacity-55' : ''}`}
                          >
                            <ItemStatusIcon status={line.paymentStatus} />
                            <span
                              className={`flex-1 min-w-0 truncate ${cancelled ? 'line-through' : ''}`}
                              style={{ color: cancelled ? '#584237' : line.paymentStatus === 'paid' ? '#a78b7d' : '#e0c0b1' }}
                            >
                              {line.quantity}x {line.name}
                            </span>
                            <span
                              className={`font-mono shrink-0 ${cancelled ? 'line-through' : ''}`}
                              style={{ color: cancelled ? '#584237' : '#ffb690' }}
                            >
                              {formatCurrency(line.lineTotal)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {itemLines.length === 0 && (
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
                          <ParticipantPaymentRow
                            key={p.participantId}
                            name={p.name}
                            isMe={p.isMe}
                            billing={p.billing}
                            payerNames={payerNames}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Table total — saldo em aberto em destaque; total máximo só como referência */}
            {allOrders.length > 0 && sessionBilling && (
              <div className="rounded-xl p-4" style={{ background: '#171f33', border: '1px solid #334155' }}>
                {sessionPaid > 0.01 ? (
                  <>
                    <div className="text-center pb-4 mb-4" style={{ borderBottom: '1px solid rgba(88,66,55,0.3)' }}>
                      <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
                        Saldo em aberto na mesa
                      </p>
                      <p
                        className="text-3xl font-black mt-1"
                        style={{
                          color: sessionRemaining <= 0.02 ? '#34d399' : '#f87171',
                          fontFamily: 'Geist, sans-serif',
                        }}
                      >
                        {sessionRemaining <= 0.02 ? '✓ Quitada' : formatCurrency(sessionRemaining)}
                      </p>
                      {sessionRemaining > 0.02 && (
                        <p className="text-[10px] font-mono mt-2 leading-relaxed max-w-[280px] mx-auto" style={{ color: '#584237' }}>
                          Taxa de serviço é opcional — cada pessoa escolhe no checkout.
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5 text-sm" style={{ color: '#584237' }}>
                      <div className="flex justify-between">
                        <span>Consumo da mesa</span>
                        <span className="font-mono">{formatCurrency(tableTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Taxa de serviço (até 10%)</span>
                        <span className="font-mono">{formatCurrency(tableTotal * 0.1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total máximo da mesa</span>
                        <span className="font-mono">{formatCurrency(grandTotal)}</span>
                      </div>
                      <div className="flex justify-between pt-1" style={{ color: '#34d399' }}>
                        <span>Já pago</span>
                        <span className="font-mono">− {formatCurrency(sessionPaid)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center pb-4 mb-4" style={{ borderBottom: '1px solid rgba(88,66,55,0.3)' }}>
                      <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
                        Conta da mesa
                      </p>
                      <p className="text-3xl font-black mt-1" style={{ color: '#ffb690', fontFamily: 'Geist, sans-serif' }}>
                        {formatCurrency(tableTotal)}
                      </p>
                      <p className="text-[10px] font-mono mt-2" style={{ color: '#584237' }}>
                        consumo · sem taxa de serviço
                      </p>
                    </div>
                    <div className="space-y-1.5 text-sm" style={{ color: '#a78b7d' }}>
                      <div className="flex justify-between">
                        <span>Taxa de serviço (10% — opcional)</span>
                        <span className="font-mono">+ {formatCurrency(tableTotal * 0.1)}</span>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span className="font-medium" style={{ color: '#dae2fd' }}>Total máximo</span>
                        <span className="font-mono font-semibold" style={{ color: '#ffb690' }}>
                          {formatCurrency(grandTotal)}
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] font-mono mt-3 leading-relaxed" style={{ color: '#584237' }}>
                      Cada pessoa escolhe no checkout se inclui a taxa. Mínimo da mesa: {formatCurrency(sessionBilling.grandTotalMinimum)}.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Summary + CTA */}
        {displayOrders.length > 0 && (
          <>
            {tab === 'mine' && myOrders.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: '#171f33', border: '1px solid #334155' }}>
                {myPaid > 0.01 ? (
                  <>
                    <div className="text-center pb-4 mb-4" style={{ borderBottom: '1px solid rgba(88,66,55,0.3)' }}>
                      <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
                        {myPayStatus === 'paid' ? 'Sua conta' : 'Seu saldo em aberto'}
                      </p>
                      <p
                        className="text-3xl font-black mt-1"
                        style={{
                          color: myPayStatus === 'paid' ? '#34d399' : '#ffb690',
                          fontFamily: 'Geist, sans-serif',
                        }}
                      >
                        {myPayStatus === 'paid'
                          ? '✓ Quitada'
                          : formatCurrency(Math.max(0, myOwed - myPaid))}
                      </p>
                      {myPayStatus !== 'paid' && (
                        <p className="text-[10px] font-mono mt-2" style={{ color: '#584237' }}>
                          Taxa opcional — você escolhe no checkout
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5 text-sm" style={{ color: '#584237' }}>
                      <div className="flex justify-between">
                        <span>Seu consumo</span>
                        <span className="font-mono">{formatCurrency(myTotal)}</span>
                      </div>
                      {myPayStatus !== 'paid' && myBilling?.serviceFeeIncluded !== false && (
                        <div className="flex justify-between">
                          <span>Com taxa (até 10%)</span>
                          <span className="font-mono">{formatCurrency(myOwed)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1" style={{ color: '#34d399' }}>
                        <span>Já pago</span>
                        <span className="font-mono">− {formatCurrency(myPaid)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center pb-4 mb-4" style={{ borderBottom: '1px solid rgba(88,66,55,0.3)' }}>
                      <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
                        Sua conta
                      </p>
                      <p className="text-3xl font-black mt-1" style={{ color: '#ffb690', fontFamily: 'Geist, sans-serif' }}>
                        {formatCurrency(myTotal)}
                      </p>
                      <p className="text-[10px] font-mono mt-2" style={{ color: '#584237' }}>
                        consumo · sem taxa
                      </p>
                    </div>
                    <div className="flex justify-between text-sm" style={{ color: '#a78b7d' }}>
                      <span>Taxa de serviço (10% — opcional)</span>
                      <span className="font-mono">+ {formatCurrency(myTotal * 0.1)}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 mt-2" style={{ borderTop: '1px solid rgba(88,66,55,0.2)', color: '#dae2fd' }}>
                      <span className="font-medium">Total máximo</span>
                      <span className="font-mono font-semibold" style={{ color: '#ffb690' }}>
                        {formatCurrency(myTotal * 1.1)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Espaço para barra de ação + nav inferior */}
        {allOrders.length > 0 && <div className="h-4" aria-hidden="true" />}
      </main>

      {/* Bottom action bar */}
      {allOrders.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-6 py-3 z-40"
          style={{ background: 'rgba(11,19,38,0.88)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(88,66,55,0.2)' }}>
          {sessionFullyPaid ? (
            <div className="w-full h-14 rounded-xl flex items-center justify-center gap-2"
              style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)' }}>
              <span className="material-symbols-outlined text-[20px]" style={{ color: '#34d399', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <span className="text-sm font-semibold" style={{ color: '#34d399' }}>Mesa quitada — obrigado!</span>
            </div>
          ) : (
            <button onClick={() => router.push(`/${params.slug}/checkout?session=${sessionId}`)}
              className="w-full h-14 rounded-xl font-semibold text-base flex items-center justify-center gap-3 active:scale-95 transition-all"
              style={{
                background: sessionClosing ? '#ef4444' : myPayStatus === 'paid' ? '#334155' : '#f97316',
                color: myPayStatus === 'paid' ? '#dae2fd' : '#582200',
                boxShadow: myPayStatus === 'paid' ? 'none' : '0 8px 30px rgba(249,115,22,0.3)',
                fontFamily: 'Geist, sans-serif',
              }}>
              <span className="material-symbols-outlined">payments</span>
              {sessionClosing
                ? 'Pagar Agora!'
                : myPayStatus === 'paid'
                  ? 'Ver fechamento da mesa'
                  : 'Fechar Conta'}
            </button>
          )}
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
