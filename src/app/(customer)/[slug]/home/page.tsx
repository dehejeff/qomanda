'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { CustomerBottomNav } from '@/components/customer/bottom-nav'
import { formatCurrency } from '@/lib/utils'
import { buildSessionBilling } from '@/lib/session-billing'
import { leaveRestaurantSession, resolveCustomerSessionId } from '@/lib/customer-auth'
import { SessionSettledPanel, type SessionPaymentReceipt } from '@/components/customer/session-settled-panel'
import type { Order } from '@/types'
import { formatServiceLocationLabel } from '@/lib/counter-orders'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; progress: number }> = {
  pending:   { label: 'Aguardando confirmação', color: '#f59e0b', icon: 'pending',       progress: 15  },
  confirmed: { label: 'Pedido confirmado',      color: '#58A6FF', icon: 'check_circle',  progress: 35  },
  preparing: { label: 'Preparando com carinho', color: '#00E676', icon: 'skillet',       progress: 65  },
  ready:     { label: 'Pronto! A caminho',       color: '#34d399', icon: 'done_all',      progress: 90  },
  delivered: { label: 'Entregue',               color: '#8B949E', icon: 'check',         progress: 100 },
}

export default function CustomerHomePage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = resolveCustomerSessionId(searchParams)

  const [restaurantName, setRestaurantName] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [tableNumber, setTableNumber] = useState('')
  const [serviceMode, setServiceMode] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [orderSummary, setOrderSummary] = useState<{
    totalItems: number
    totalValue: number
    statuses: { status: string; count: number }[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [closeInvite, setCloseInvite] = useState<{ requestId: string; initiatorName: string; amountOwed: number } | null>(null)
  const [sessionSettled, setSessionSettled] = useState(false)
  const [myPayments, setMyPayments] = useState<SessionPaymentReceipt[]>([])
  const [callingWaiter, setCallingWaiter] = useState(false)
  const [waiterCalledAt, setWaiterCalledAt] = useState<number | null>(null)
  const [couvertCfg, setCouvertCfg] = useState<{ enabled: boolean; price: number; label: string }>({ enabled: false, price: 0, label: 'Couvert' })
  const [couvertAdded, setCouvertAdded] = useState(false)
  const [couvertBusy, setCouvertBusy] = useState(false)
  async function toggleCouvert() {
    if (!sessionId || couvertBusy) return
    const customerId = localStorage.getItem('kicomanda_customer_id')
    if (!customerId) return
    const removing = couvertAdded
    setCouvertBusy(true)
    try {
      const res = await fetch('/api/customer/couvert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, customerId, action: removing ? 'remove' : 'add' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCouvertAdded(!removing)
      toast.success(removing ? 'Couvert removido.' : 'Couvert adicionado à sua conta.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar couvert.')
    } finally {
      setCouvertBusy(false)
    }
  }

  async function callWaiter() {
    if (!sessionId || callingWaiter) return
    setCallingWaiter(true)
    try {
      const res = await fetch('/api/customer/call-waiter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setWaiterCalledAt(Date.now())
      toast.success(data.throttled ? (data.message ?? 'Garçom já avisado.') : 'Garçom a caminho! 🙋')
      // Reverte o feedback após alguns segundos para permitir chamar de novo.
      setTimeout(() => setWaiterCalledAt(null), 5000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível chamar o garçom.')
    } finally {
      setCallingWaiter(false)
    }
  }

  function handleLeaveRestaurant() {
    leaveRestaurantSession(router, params.slug)
  }

  useEffect(() => {
    if (!sessionId) { router.replace(`/${params.slug}`); return }

    // ?cn= vem do check-in (via navigateToCustomerHome) — prioridade máxima,
    // funciona mesmo quando o PWA está servindo JS cacheado.
    const nameFromUrl = searchParams.get('cn')
    if (nameFromUrl) {
      localStorage.setItem('kicomanda_customer_name', nameFromUrl)
      setCustomerName(nameFromUrl)
    } else {
      const name = localStorage.getItem('kicomanda_customer_name') ?? 'Cliente'
      setCustomerName(name)
    }

    // Limpa ?cn= da URL (não precisa poluir o histórico)
    window.history.replaceState(null, '', `/${params.slug}/home?session=${encodeURIComponent(sessionId!)}`)
  }, [sessionId, params.slug, router, searchParams])

  useEffect(() => {
    if (!sessionId) return

    async function load() {
      const supabase = createClient()
      try {
        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .select('id, status, restaurant_id, table_id, service_mode')
          .eq('id', sessionId)
          .single()

        if (sessionError || !session) {
          localStorage.removeItem('kicomanda_session_id')
          router.replace(`/${params.slug}`)
          return
        }

        const [{ data: restaurant }, { data: table }] = await Promise.all([
          supabase
            .from('restaurants')
            .select('name, logo_url, couvert_enabled, couvert_price, couvert_label')
            .eq('id', session.restaurant_id)
            .single(),
          session.table_id
            ? supabase.from('tables').select('number').eq('id', session.table_id).single()
            : Promise.resolve({ data: null }),
        ])

        const sessionClosed = session.status === 'closed'

        setRestaurantName(restaurant?.name ?? '')
        setLogoUrl(restaurant?.logo_url ?? null)
        setTableNumber(table?.number ?? '')
        setServiceMode((session as { service_mode?: string }).service_mode ?? null)
        setCouvertCfg({
          enabled: Boolean((restaurant as { couvert_enabled?: boolean } | null)?.couvert_enabled),
          price: Number((restaurant as { couvert_price?: number } | null)?.couvert_price ?? 0),
          label: (restaurant as { couvert_label?: string } | null)?.couvert_label ?? 'Couvert',
        })

      const customerId = localStorage.getItem('kicomanda_customer_id')

      // Sempre busca o nome do servidor — garante que o nome aparece
      // independente do estado do localStorage ou do cache do PWA.
      const qs = new URLSearchParams({ session: sessionId! })
      if (customerId) qs.set('customer', customerId)
      const profileRes = await fetch(`/api/customer/profile?${qs}`).catch(() => null)
      if (profileRes?.ok) {
        const profile = await profileRes.json() as { firstName?: string; lastName?: string; customerId?: string }
        const resolvedName = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()
        if (resolvedName) {
          localStorage.setItem('kicomanda_customer_name', resolvedName)
          setCustomerName(resolvedName)
        }
        if (profile.customerId && !customerId) {
          localStorage.setItem('kicomanda_customer_id', profile.customerId)
        }
      }

      // Couvert artístico: materializa (se na janela do show) antes de ler a conta.
      await fetch('/api/customer/couvert/artistico', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }),
      }).catch(() => {})

      // Couvert já adicionado por este cliente nesta sessão?
      if (customerId) {
        const { data: couvertOrders } = await supabase
          .from('orders')
          .select('status, items:order_items(menu_item:menu_items(couvert_kind))')
          .eq('session_id', sessionId)
          .eq('customer_id', customerId)
          .neq('status', 'cancelled')
        const added = (couvertOrders ?? []).some((o: any) =>
          (o.items ?? []).some((it: any) => (it.menu_item?.couvert_kind ?? 'none') === 'couvert'))
        setCouvertAdded(added)
      }

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

      // Busca TODOS os pedidos ativos (não cancelados/entregues) da sessão
      let ordersQuery = supabase
        .from('orders')
        .select('status, items:order_items(unit_price, quantity)')
        .eq('session_id', sessionId)
        .not('status', 'in', '("cancelled","delivered")')
        .order('created_at', { ascending: false })

      if (customerId) {
        ordersQuery = ordersQuery.eq('customer_id', customerId)
      }

      const { data: activeOrders } = await ordersQuery

      if (activeOrders && activeOrders.length > 0) {
        let totalItems = 0
        let totalValue = 0
        const statusMap: Record<string, number> = {}

        for (const o of activeOrders as any[]) {
          for (const item of (o.items ?? [])) {
            totalItems += item.quantity
            totalValue += item.unit_price * item.quantity
          }
          statusMap[o.status] = (statusMap[o.status] ?? 0) + 1
        }

        // Ordena status pelo progresso (mais avançado primeiro)
        const statusOrder = ['ready', 'preparing', 'confirmed', 'pending']
        const statuses = statusOrder
          .filter(s => statusMap[s])
          .map(s => ({ status: s, count: statusMap[s] }))

        setOrderSummary({ totalItems, totalValue, statuses })
      } else {
        setOrderSummary(null)
      }

      } finally {
        setLoading(false)
      }
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
    const myCustomerId = localStorage.getItem('kicomanda_customer_id')
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1117' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#00E676' }} />
      </div>
    )
  }

  // Status "principal" = o mais avançado (para a barra de progresso)
  const primaryStatus = orderSummary?.statuses[0]?.status ?? null
  const primaryCfg = primaryStatus ? (STATUS_CONFIG[primaryStatus] ?? STATUS_CONFIG.pending) : null
  const firstName = customerName.split(' ')[0]
  const locationLabel = formatServiceLocationLabel(tableNumber, serviceMode)
  const isCounter = serviceMode === 'counter'

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0D1117', color: '#FFFFFF' }}>
      {/* Ambient glow */}
      <div className="pointer-events-none fixed top-[-10%] right-[-5%] w-[50%] h-[40%] rounded-full" style={{ background: 'rgba(0,230,118,0.06)', filter: 'blur(100px)' }} />
      <div className="pointer-events-none fixed bottom-0 left-[-10%] w-[40%] h-[30%] rounded-full" style={{ background: 'rgba(123,208,255,0.06)', filter: 'blur(80px)' }} />

      {/* Header */}
      <header
        className="sticky top-0 z-40 flex justify-between items-center px-6 h-16"
        style={{ background: 'rgba(13,17,23,0.85)', borderBottom: '1px solid rgba(88,66,55,0.3)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={restaurantName} className="h-8 w-auto object-contain" />
          ) : (
            <span className="font-bold text-base" style={{ color: '#00E676', fontFamily: 'Geist, sans-serif' }}>
              {restaurantName}
            </span>
          )}
        </div>
        {(tableNumber || isCounter) && (
        <span
          className="text-xs font-mono px-3 py-1.5 rounded-lg"
          style={{
            background: sessionSettled ? 'rgba(52,211,153,0.12)' : 'rgba(0,230,118,0.12)',
            color: sessionSettled ? '#34d399' : '#00E676',
            border: sessionSettled ? '1px solid rgba(52,211,153,0.25)' : '1px solid rgba(0,230,118,0.2)',
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
              <span className="material-symbols-outlined text-[22px] shrink-0 mt-0.5" style={{ color: '#58A6FF' }}>receipt_long</span>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: '#FFFFFF' }}>
                  {closeInvite.initiatorName} quer fechar a mesa!
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#8B949E' }}>
                  Sua parte calculada: <strong style={{ color: '#00E676' }}>{formatCurrency(closeInvite.amountOwed)}</strong>
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setCloseInvite(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-mono transition-all"
                style={{ background: 'transparent', border: '1px solid rgba(88,66,55,0.4)', color: '#8B949E' }}>
                Recusar
              </button>
              <button
                onClick={() => {
                  setCloseInvite(null)
                  router.push(`/${params.slug}/checkout?session=${sessionId}&request=${closeInvite.requestId}`)
                }}
                className="flex-[2] py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95"
                style={{ background: '#58A6FF', color: '#001e2c' }}>
                Confirmar e Pagar
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="px-6 pt-6 space-y-5 relative z-10">
        {/* Welcome */}
        <div>
          <p className="text-sm font-mono" style={{ color: '#8B949E' }}>Bem-vindo de volta,</p>
          <h1 className="text-3xl font-bold tracking-tight mt-0.5" style={{ fontFamily: 'Geist, sans-serif', color: '#FFFFFF' }}>
            Olá, <span style={{ color: '#00E676' }}>{firstName || customerName || 'Cliente'}!</span>
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
        {!sessionSettled && orderSummary && primaryCfg ? (
          <div
            className="rounded-xl p-5 relative overflow-hidden"
            style={{ background: 'linear-gradient(145deg, #21262D 0%, #161B22 100%)', border: '1px solid #30363D' }}
          >
            {/* Totais */}
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest mb-0.5" style={{ color: '#8B949E' }}>Seus pedidos</p>
                <p className="text-lg font-bold" style={{ color: '#00E676', fontFamily: 'Geist, sans-serif' }}>
                  {orderSummary.totalItems} {orderSummary.totalItems === 1 ? 'item' : 'itens'} · {formatCurrency(orderSummary.totalValue)}
                </p>
              </div>
              <Link
                href={`/${params.slug}/orders?session=${sessionId}`}
                className="flex items-center gap-1 text-xs font-mono px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: '#30363D', color: '#8B949E', border: '1px solid #30363D' }}
              >
                Ver detalhes
                <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
              </Link>
            </div>

            {/* Status chips — um por status ativo */}
            <div className="flex flex-wrap gap-2 mb-4">
              {orderSummary.statuses.map(({ status, count }) => {
                const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
                return (
                  <div
                    key={status}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono"
                    style={{
                      background: `${cfg.color}15`,
                      border: `1px solid ${cfg.color}40`,
                      color: cfg.color,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }}
                    />
                    <span className="material-symbols-outlined text-[13px]">{cfg.icon}</span>
                    {cfg.label}
                    {count > 1 && (
                      <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: `${cfg.color}30` }}>
                        {count}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Barra de progresso do status mais avançado */}
            <div className="h-1 rounded-full overflow-hidden" style={{ background: '#30363D' }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${primaryCfg.progress}%`, background: primaryCfg.color, boxShadow: `0 0 12px ${primaryCfg.color}60` }}
              />
            </div>
          </div>
        ) : !sessionSettled ? (
          <div
            className="rounded-xl p-5 flex items-center gap-4"
            style={{ background: '#161B22', border: '1px dashed rgba(88,66,55,0.5)' }}
          >
            <span className="material-symbols-outlined text-[32px]" style={{ color: '#30363D' }}>receipt_long</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>Nenhum pedido ainda</p>
              <p className="text-xs" style={{ color: '#8B949E' }}>Acesse o cardápio e faça seu pedido</p>
            </div>
          </div>
        ) : null}

        {/* Couvert — atalho (só mesa, com a casa habilitando) */}
        {couvertCfg.enabled && couvertCfg.price > 0 && !isCounter && !sessionSettled && (
          <button
            type="button"
            onClick={toggleCouvert}
            disabled={couvertBusy}
            className="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-[0.98] disabled:opacity-60 text-left"
            style={{
              background: couvertAdded ? 'rgba(52,211,153,0.1)' : 'linear-gradient(145deg,#21262D,#161B22)',
              border: `1px solid ${couvertAdded ? 'rgba(52,211,153,0.4)' : 'rgba(0,230,118,0.35)'}`,
            }}
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: couvertAdded ? 'rgba(52,211,153,0.15)' : 'rgba(0,230,118,0.15)' }}>
              <span className="material-symbols-outlined text-[22px]"
                style={{ color: couvertAdded ? '#34d399' : '#00E676', fontVariationSettings: couvertAdded ? "'FILL' 1" : "'FILL' 0" }}>
                {couvertBusy ? 'hourglass_top' : couvertAdded ? 'check_circle' : 'bakery_dining'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: couvertAdded ? '#34d399' : '#FFFFFF' }}>
                {couvertAdded ? `${couvertCfg.label} adicionado` : `Adicionar ${couvertCfg.label}`}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#8B949E' }}>
                {couvertAdded
                  ? 'Toque para remover · sem taxa de serviço'
                  : `${formatCurrency(couvertCfg.price)} por pessoa · sem taxa de serviço`}
              </p>
            </div>
            <span className="text-xs font-mono shrink-0" style={{ color: couvertAdded ? '#34d399' : '#00E676' }}>
              {couvertAdded ? 'Remover' : `+ ${formatCurrency(couvertCfg.price)}`}
            </span>
          </button>
        )}

        {/* Quick actions */}
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: '#8B949E' }}>Acesso rápido</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              ...(!sessionSettled ? [{
                href: `/${params.slug}/menu?session=${sessionId}`,
                icon: 'restaurant_menu',
                label: 'Cardápio',
                desc: 'Ver todos os pratos',
                accent: '#00E676',
              }] : []),
              {
                href: `/${params.slug}/orders?session=${sessionId}`,
                icon: 'list_alt',
                label: 'Meus Pedidos',
                desc: sessionSettled ? 'Ver histórico' : 'Acompanhar status',
                accent: '#58A6FF',
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
              ...(!sessionSettled && !isCounter ? [{
                action: 'callWaiter' as const,
                icon: callingWaiter ? 'hourglass_top' : waiterCalledAt ? 'check_circle' : 'support_agent',
                label: 'Chamar Garçom',
                desc: callingWaiter ? 'Chamando…' : waiterCalledAt ? 'Garçom avisado!' : 'Toque para chamar',
                accent: waiterCalledAt ? '#34d399' : '#00E676',
              }] : []),
            ].map(item => {
              const content = (
                <>
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: `${item.accent}18` }}
                  >
                    <span className="material-symbols-outlined text-[22px]" style={{ color: item.accent }}>
                      {item.icon}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{item.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#8B949E' }}>{item.desc}</p>
                  </div>
                </>
              )
              const cardClass = 'flex flex-col gap-3 p-4 rounded-xl transition-all active:scale-95 text-left'
              const cardStyle = { background: '#21262D', border: '1px solid #30363D' } as const

              if ('action' in item && item.action === 'callWaiter') {
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={callWaiter}
                    disabled={callingWaiter}
                    className={`${cardClass} disabled:opacity-70`}
                    style={cardStyle}
                  >
                    {content}
                  </button>
                )
              }
              return (
                <Link key={item.label} href={item.href} className={cardClass} style={cardStyle}>
                  {content}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Session info — só enquanto a mesa está ativa */}
        {!sessionSettled && (
        <div
          className="rounded-xl px-5 py-4 flex items-center justify-between"
          style={{ background: '#161B22', border: '1px solid rgba(88,66,55,0.3)' }}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[18px]" style={{ color: '#8B949E' }}>info</span>
            <span className="text-xs font-mono" style={{ color: '#8B949E' }}>
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
