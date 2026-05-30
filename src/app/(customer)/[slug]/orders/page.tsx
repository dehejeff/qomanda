'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order, SessionParticipant } from '@/types'
import { mockOrders } from '@/lib/dev-mock'
import { CustomerBottomNav } from '@/components/customer/bottom-nav'
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

function totalOf(orders: Order[]) {
  return orders.flatMap(o => o.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0)
}

export default function OrdersPage() {
  const params      = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router      = useRouter()
  const sessionId   = searchParams.get('session')

  const [tab, setTab]                 = useState<Tab>('mine')
  const [myOrders, setMyOrders]       = useState<Order[]>([])
  const [allOrders, setAllOrders]     = useState<Order[]>([])
  const [participants, setParticipants] = useState<SessionParticipant[]>([])
  const [loading, setLoading]         = useState(true)
  const [sessionClosing, setSessionClosing] = useState(false)

  const customerId = typeof window !== 'undefined'
    ? localStorage.getItem('qomanda_customer_id') : null

  useEffect(() => {
    if (!sessionId) { router.replace(`/${params.slug}`); return }

    if (params.slug === 'demo') {
      setMyOrders(mockOrders.slice(0, 1))
      setAllOrders(mockOrders)
      setParticipants([
        { id: '1', session_id: 'demo', customer_id: 'c1', joined_at: '', customer: { id: 'c1', first_name: 'João', last_name: 'Silva', whatsapp: '', document_type: null, cpf: null, passport: null, created_at: '' } },
        { id: '2', session_id: 'demo', customer_id: 'c2', joined_at: '', customer: { id: 'c2', first_name: 'Maria', last_name: 'Santos', whatsapp: '', document_type: null, cpf: null, passport: null, created_at: '' } },
        { id: '3', session_id: 'demo', customer_id: 'c3', joined_at: '', customer: { id: 'c3', first_name: 'Pedro', last_name: 'Costa', whatsapp: '', document_type: null, cpf: null, passport: null, created_at: '' } },
      ])
      setLoading(false)
      return
    }

    const supabase = createClient()

    async function load() {
      const [ordersRes, participantsRes, sessionRes] = await Promise.all([
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
      ])

      const orders = (ordersRes.data ?? []) as Order[]
      setAllOrders(orders)
      setMyOrders(customerId ? orders.filter(o => o.customer_id === customerId) : orders)
      setParticipants((participantsRes.data ?? []) as SessionParticipant[])
      if (sessionRes.data?.status === 'closing') setSessionClosing(true)
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

    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2) }
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
                  const ot  = totalOf([order])
                  return (
                    <div key={order.id} className="rounded-xl overflow-hidden"
                      style={{ background: 'linear-gradient(145deg,#1e293b,#131b2e)', border: '1px solid #334155' }}>
                      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(88,66,55,0.2)' }}>
                        <span className="text-xs font-mono" style={{ color: '#a78b7d' }}>#{order.id.slice(-6).toUpperCase()}</span>
                        <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                          style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="px-4 py-3 space-y-2">
                        {(order.items ?? []).map(item => (
                          <div key={item.id} className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg shrink-0 flex items-center justify-center"
                              style={{ background: '#2d3449' }}>
                              {item.menu_item?.image_url
                                ? <img src={item.menu_item.image_url} alt="" className="w-full h-full object-cover rounded-lg" />
                                : <span className="material-symbols-outlined text-[18px]" style={{ color: '#584237' }}>fastfood</span>}
                            </div>
                            <div className="flex-1 flex justify-between items-start">
                              <p className="text-sm font-semibold">{item.quantity}x {item.menu_item?.name}</p>
                              <p className="text-sm font-mono" style={{ color: '#ffb690' }}>{formatCurrency(item.unit_price * item.quantity)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between px-4 py-3" style={{ borderTop: '1px solid rgba(88,66,55,0.2)' }}>
                        <span className="text-xs font-mono" style={{ color: '#a78b7d' }}>Subtotal</span>
                        <span className="text-sm font-semibold" style={{ color: '#ffb690' }}>{formatCurrency(ot)}</span>
                      </div>
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
                      {orders.flatMap(o => o.items ?? []).map((item, i) => (
                        <div key={i} className="flex justify-between text-xs" style={{ color: '#e0c0b1' }}>
                          <span>{item.quantity}x {item.menu_item?.name}</span>
                          <span className="font-mono">{formatCurrency(item.unit_price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {orders.length === 0 && (
                    <p className="px-4 py-3 text-xs" style={{ color: '#584237' }}>Nenhum pedido ainda</p>
                  )}
                </div>
              )
            })}

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

      <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>
    </div>
  )
}
