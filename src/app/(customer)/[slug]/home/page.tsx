'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { CustomerBottomNav } from '@/components/customer/bottom-nav'
import { formatCurrency } from '@/lib/utils'
import { buildSessionBilling } from '@/lib/session-billing'
import { leaveRestaurantSession } from '@/lib/customer-auth'
import { SessionSettledPanel, type SessionPaymentReceipt } from '@/components/customer/session-settled-panel'
import type { Order } from '@/types'
import { formatServiceLocationLabel } from '@/lib/counter-orders'
import { Loader2 } from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; progress: number }> = {
  pending:   { label: 'Aguardando confirmação', color: '#f59e0b', icon: 'pending',       progress: 15  },
  confirmed: { label: 'Pedido confirmado',      color: '#7bd0ff', icon: 'check_circle',  progress: 35  },
  preparing: { label: 'Preparando com carinho', color: '#f97316', icon: 'skillet',       progress: 65  },
  ready:     { label: 'Pronto! A caminho',       color: '#34d399', icon: 'done_all',      progress: 90  },
  delivered: { label: 'Entregue',               color: '#a78b7d', icon: 'check',         progress: 100 },
}

export default function CustomerHomePage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session')

  const [restaurantName, setRestaurantName] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [tableNumber, setTableNumber] = useState('')
  const [serviceMode, setServiceMode] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [latestOrder, setLatestOrder] = useState<{ status: string; total: number; itemCount: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [closeInvite, setCloseInvite] = useState<{ requestId: string; initiatorName: string; amountOwed: number } | null>(null)
  const [sessionSettled, setSessionSettled] = useState(false)
  const [myPayments, setMyPayments] = useState<SessionPaymentReceipt[]>([])

  function handleLeaveRestaurant() {
    leaveRestaurantSession(router, params.slug)
  }

  useEffect(() => {
    if (!sessionId) { router.replace(`/${params.slug}`); return }
    const name = localStorage.getItem('qomanda_customer_name') ?? 'Cliente'
    setCustomerName(name)
  }, [sessionId, params.slug, router])

  useEffect(() => {
    if (!sessionId) return

    async function load() {
      const supabase = createClient()
      const { data: session } = await supabase
        .from('sessions')
        .select('status, *, restaurant:restaurants(*), table:tables(*)')
        .eq('id', sessionId)
        .single()

      if (!session) { router.replace(`/${params.slug}`); return }

      const sessionClosed = session.status === 'closed'

      setRestaurantName((session.restaurant as any)?.name ?? '')
      setLogoUrl((session.restaurant as any)?.logo_url ?? null)
      setTableNumber((session.table as any)?.number ?? '')
      setServiceMode((session as { service_mode?: string }).service_mode ?? null)

      const customerId = localStorage.getItem('qomanda_customer_id')

      const [ordersRes, paymentsRes, participantsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('customer_id, status, items:order_items(unit_price, quantity)')
          .eq('session_id', sessionId),
        supabase
          .from('payments')
          .select('customer_id, amount, service_fee_included')
          .eq('session_id', sessionId)
          .eq('status', 'paid'),
        supabase
          .from('session_participants')
          .select('customer_id')
          .eq('session_id', sessionId),
      ])

      const billing = buildSessionBilling(
        (ordersRes.data ?? []) as Order[],
        paymentsRes.data ?? [],
        (participantsRes.data ?? []).map(p => p.customer_id),
      )
      const settled = sessionClosed || (billing.grandTotal > 0.01 && billing.remaining <= 0.02)
      setSessionSettled(settled)
      if (settled) setCloseInvite(null)

      if (customerId) {
        const { data: myPays } = await supabase
          .from('payments')
          .select('confirmation_code, amount, split_type')
          .eq('session_id', sessionId)
          .eq('customer_id', customerId)
          .eq('status', 'paid')
          .order('created_at', { ascending: false })
        setMyPayments((myPays ?? []) as SessionPaymentReceipt[])
      } else {
        setMyPayments([])
      }

      let ordersQuery = supabase
        .from('orders')
        .select('status, items:order_items(unit_price, quantity)')
        .eq('session_id', sessionId)
        .not('status', 'in', '("cancelled","delivered")')
        .order('created_at', { ascending: false })
        .limit(1)

      if (customerId) {
        ordersQuery = ordersQuery.eq('customer_id', customerId)
      }

      const { data: orders } = await ordersQuery

      if (orders && orders.length > 0) {
        const o = orders[0] as any
        const total = (o.items ?? []).reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0)
        setLatestOrder({ status: o.status, total, itemCount: o.items?.length ?? 0 })
      } else {
        setLatestOrder(null)
      }

      setLoading(false)
    }
    load()

    const supabase = createClient()

    const sessionCh = supabase.channel('home-session-watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, (p) => {
        const status = (p.new as { status?: string })?.status
        if (status === 'closed') load()
      })
      .subscribe()

    const paymentsCh = supabase.channel('home-payments-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `session_id=eq.${sessionId}` }, load)
      .subscribe()

    // Subscribe to close request invites
    const myCustomerId = localStorage.getItem('qomanda_customer_id')
    if (myCustomerId) {
      const ch = supabase.channel('close-invite')
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'close_request_participants',
          filter: `customer_id=eq.${myCustomerId}`,
        }, async (payload) => {
          const p = payload.new as any
          if (p.status !== 'pending') return
          const { data: req } = await supabase
            .from('close_requests')
            .select('*, initiator:customers!initiator_id(first_name,last_name)')
            .eq('id', p.request_id).single()
          if (!req) return
          const ini = (req as any).initiator
          setCloseInvite({
            requestId: req.id,
            initiatorName: ini ? `${ini.first_name} ${ini.last_name}` : 'Alguém',
            amountOwed: p.amount_owed,
          })
        })
        .subscribe()
      return () => {
        supabase.removeChannel(ch)
        supabase.removeChannel(sessionCh)
        supabase.removeChannel(paymentsCh)
      }
    }

    return () => {
      supabase.removeChannel(sessionCh)
      supabase.removeChannel(paymentsCh)
    }
  }, [sessionId, params.slug, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  const statusCfg = latestOrder ? (STATUS_CONFIG[latestOrder.status] ?? STATUS_CONFIG.pending) : null
  const firstName = customerName.split(' ')[0]
  const locationLabel = formatServiceLocationLabel(tableNumber, serviceMode)
  const isCounter = serviceMode === 'counter'

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0b1326', color: '#dae2fd' }}>
      {/* Ambient glow */}
      <div className="pointer-events-none fixed top-[-10%] right-[-5%] w-[50%] h-[40%] rounded-full" style={{ background: 'rgba(249,115,22,0.06)', filter: 'blur(100px)' }} />
      <div className="pointer-events-none fixed bottom-0 left-[-10%] w-[40%] h-[30%] rounded-full" style={{ background: 'rgba(123,208,255,0.06)', filter: 'blur(80px)' }} />

      {/* Header */}
      <header
        className="sticky top-0 z-40 flex justify-between items-center px-6 h-16"
        style={{ background: 'rgba(11,19,38,0.85)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={restaurantName} className="h-8 w-auto object-contain" />
          ) : (
            <span className="font-bold text-base" style={{ color: '#ffb690', fontFamily: 'Geist, sans-serif' }}>
              {restaurantName}
            </span>
          )}
        </div>
        {(tableNumber || isCounter) && (
        <span
          className="text-xs font-mono px-3 py-1.5 rounded-lg"
          style={{
            background: sessionSettled ? 'rgba(52,211,153,0.12)' : 'rgba(249,115,22,0.12)',
            color: sessionSettled ? '#34d399' : '#ffb690',
            border: sessionSettled ? '1px solid rgba(52,211,153,0.25)' : '1px solid rgba(249,115,22,0.2)',
          }}
        >
          {sessionSettled ? (isCounter ? 'Conta quitada' : 'Mesa quitada') : locationLabel}
        </span>
        )}
      </header>

      {/* Close request invite banner */}
      {closeInvite && !sessionSettled && (
        <div className="fixed top-16 left-0 right-0 z-50 px-4 pt-3">
          <div className="rounded-xl p-4 shadow-2xl"
            style={{ background: '#1e3a5f', border: '2px solid rgba(123,208,255,0.4)', backdropFilter: 'blur(12px)' }}>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[22px] shrink-0 mt-0.5" style={{ color: '#7bd0ff' }}>receipt_long</span>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: '#dae2fd' }}>
                  {closeInvite.initiatorName} quer fechar a mesa!
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#a78b7d' }}>
                  Sua parte calculada: <strong style={{ color: '#ffb690' }}>{formatCurrency(closeInvite.amountOwed)}</strong>
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setCloseInvite(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-mono transition-all"
                style={{ background: 'transparent', border: '1px solid rgba(88,66,55,0.4)', color: '#a78b7d' }}>
                Recusar
              </button>
              <button
                onClick={() => {
                  setCloseInvite(null)
                  router.push(`/${params.slug}/checkout?session=${sessionId}&request=${closeInvite.requestId}`)
                }}
                className="flex-[2] py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95"
                style={{ background: '#7bd0ff', color: '#001e2c' }}>
                Confirmar e Pagar
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="px-6 pt-6 space-y-5 relative z-10">
        {/* Welcome */}
        <div>
          <p className="text-sm font-mono" style={{ color: '#a78b7d' }}>Bem-vindo de volta,</p>
          <h1 className="text-3xl font-bold tracking-tight mt-0.5" style={{ fontFamily: 'Geist, sans-serif', color: '#dae2fd' }}>
            Olá, <span style={{ color: '#ffb690' }}>{firstName}!</span>
          </h1>
        </div>

        {/* Mesa quitada — código de saída */}
        {sessionSettled && (
          <SessionSettledPanel
            tableNumber={tableNumber}
            payments={myPayments}
            onLeaveRestaurant={handleLeaveRestaurant}
          />
        )}

        {/* Active order status card */}
        {!sessionSettled && latestOrder && statusCfg ? (
          <div
            className="rounded-xl p-5 relative overflow-hidden"
            style={{ background: 'linear-gradient(145deg, #1e293b 0%, #131b2e 100%)', border: '1px solid #334155' }}
          >
            <div className="absolute top-0 right-0 p-4 opacity-8 pointer-events-none">
              <span className="material-symbols-outlined text-[72px]" style={{ color: statusCfg.color }}>timer</span>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: statusCfg.color, boxShadow: `0 0 8px ${statusCfg.color}90`, animation: 'pulse 2s infinite' }}
              />
              <span className="text-xs font-mono uppercase tracking-widest" style={{ color: statusCfg.color }}>
                {statusCfg.label}
              </span>
            </div>
            <p className="text-sm mb-4" style={{ color: '#e0c0b1' }}>
              {latestOrder.itemCount} {latestOrder.itemCount === 1 ? 'item' : 'itens'} · {formatCurrency(latestOrder.total)}
            </p>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: '#2d3449' }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${statusCfg.progress}%`, background: statusCfg.color, boxShadow: `0 0 12px ${statusCfg.color}60` }}
              />
            </div>
            <Link
              href={`/${params.slug}/orders?session=${sessionId}`}
              className="flex items-center gap-1 text-xs font-mono mt-3 w-fit transition-colors"
              style={{ color: '#a78b7d' }}
            >
              Ver detalhes
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>
        ) : !sessionSettled ? (
          <div
            className="rounded-xl p-5 flex items-center gap-4"
            style={{ background: '#131b2e', border: '1px dashed rgba(88,66,55,0.5)' }}
          >
            <span className="material-symbols-outlined text-[32px]" style={{ color: '#584237' }}>receipt_long</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#dae2fd' }}>Nenhum pedido ainda</p>
              <p className="text-xs" style={{ color: '#a78b7d' }}>Acesse o cardápio e faça seu pedido</p>
            </div>
          </div>
        ) : null}

        {/* Quick actions */}
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: '#a78b7d' }}>Acesso rápido</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              ...(!sessionSettled ? [{
                href: `/${params.slug}/menu?session=${sessionId}`,
                icon: 'restaurant_menu',
                label: 'Cardápio',
                desc: 'Ver todos os pratos',
                accent: '#f97316',
              }] : []),
              {
                href: `/${params.slug}/orders?session=${sessionId}`,
                icon: 'list_alt',
                label: 'Meus Pedidos',
                desc: sessionSettled ? 'Ver histórico' : 'Acompanhar status',
                accent: '#7bd0ff',
              },
              ...(sessionSettled ? [{
                href: `/${params.slug}/receipts?session=${sessionId}`,
                icon: 'receipt_long',
                label: 'Meus Recibos',
                desc: 'Comprovantes de pagamento',
                accent: '#34d399',
              }] : [{
                href: `/${params.slug}/checkout?session=${sessionId}`,
                icon: 'account_balance_wallet',
                label: 'Fechar Conta',
                desc: 'Pagar e encerrar',
                accent: '#34d399',
              }]),
              {
                href: '#',
                icon: 'support_agent',
                label: 'Chamar Garçom',
                desc: 'Em breve',
                accent: '#a78b7d',
                disabled: true,
              },
            ].map(item => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex flex-col gap-3 p-4 rounded-xl transition-all active:scale-95 ${item.disabled ? 'opacity-40 pointer-events-none' : ''}`}
                style={{ background: '#1e293b', border: '1px solid #334155' }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: `${item.accent}18` }}
                >
                  <span className="material-symbols-outlined text-[22px]" style={{ color: item.accent }}>
                    {item.icon}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#dae2fd' }}>{item.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#a78b7d' }}>{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Session info — só enquanto a mesa está ativa */}
        {!sessionSettled && (
        <div
          className="rounded-xl px-5 py-4 flex items-center justify-between"
          style={{ background: '#131b2e', border: '1px solid rgba(88,66,55,0.3)' }}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[18px]" style={{ color: '#a78b7d' }}>info</span>
            <span className="text-xs font-mono" style={{ color: '#a78b7d' }}>
              {restaurantName} · {locationLabel}
            </span>
          </div>
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded"
            style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}
          >
            ATIVO
          </span>
        </div>
        )}
      </main>

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
