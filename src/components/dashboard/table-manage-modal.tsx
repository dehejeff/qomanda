'use client'

import { useEffect, useState } from 'react'
import type { RestaurantTable } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { DEV_BYPASS } from '@/lib/dev-mock'
import { toast } from 'sonner'
import { X, Loader2, ArrowLeftRight, LogOut, XCircle, CheckCircle2, ChevronLeft, Smartphone, CreditCard, Banknote, Users } from 'lucide-react'
import { formatCurrency, generateConfirmationCode } from '@/lib/utils'
import type { PaymentMethod } from '@/types'

type PaymentMethodExtended = PaymentMethod | 'cash'

interface Props {
  table: RestaurantTable
  freeTables: RestaurantTable[]
  onClose: () => void
  onTableUpdated: (tableId: string, status: RestaurantTable['status']) => void
  onTableSwitched: (fromId: string, toId: string) => void
}

type View = 'detail' | 'switch' | 'payment' | 'confirmed'

interface SessionInfo {
  id: string
  started_at: string
  restaurant_id: string
  orderCount: number
  total: number
}

const PAYMENT_METHODS: { id: PaymentMethodExtended; label: string; icon: React.ElementType }[] = [
  { id: 'pix',    label: 'PIX',      icon: Smartphone },
  { id: 'debit',  label: 'Débito',   icon: CreditCard },
  { id: 'credit', label: 'Crédito',  icon: CreditCard },
  { id: 'cash',   label: 'Dinheiro', icon: Banknote },
]

export function TableManageModal({ table, freeTables, onClose, onTableUpdated, onTableSwitched }: Props) {
  const [view, setView] = useState<View>('detail')
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [loadingSession, setLoadingSession] = useState(table.status === 'occupied')
  const [acting, setActing] = useState(false)

  // Payment state
  const [splitCount, setSplitCount] = useState(1)
  const [method, setMethod] = useState<PaymentMethodExtended>('pix')
  const [confirmationCode, setConfirmationCode] = useState('')

  useEffect(() => {
    if (table.status !== 'occupied') return

    if (DEV_BYPASS) {
      setSession({
        id: 'mock-session-1',
        started_at: new Date(Date.now() - 73 * 60 * 1000).toISOString(),
        restaurant_id: 'mock-restaurant-id',
        orderCount: 2,
        total: 61.80,
      })
      setLoadingSession(false)
      return
    }

    const supabase = createClient()
    supabase
      .from('sessions')
      .select('id, started_at, restaurant_id, orders(id, order_items(unit_price, quantity))')
      .eq('table_id', table.id)
      .eq('status', 'open')
      .single()
      .then(({ data }) => {
        if (!data) { setLoadingSession(false); return }
        const orders = (data as any).orders ?? []
        const total = orders.flatMap((o: any) => o.order_items ?? [])
          .reduce((a: number, i: any) => a + i.unit_price * i.quantity, 0)
        setSession({ id: data.id, started_at: data.started_at, restaurant_id: data.restaurant_id, orderCount: orders.length, total })
        setLoadingSession(false)
      })
  }, [table])

  function formatDuration(startedAt: string) {
    const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000)
    if (mins < 60) return `${mins} min`
    return `${Math.floor(mins / 60)}h ${mins % 60}min`
  }

  async function handleConfirmPayment() {
    if (!session) return
    setActing(true)

    const amountPer = session.total / splitCount
    const code = generateConfirmationCode()

    if (DEV_BYPASS) {
      setConfirmationCode(code)
      onTableUpdated(table.id, 'free')
      setView('confirmed')
      setActing(false)
      return
    }

    const supabase = createClient()

    // Create payment record
    const { error: paymentError } = await supabase.from('payments').insert({
      session_id: session.id,
      restaurant_id: session.restaurant_id,
      amount: amountPer,
      method: method === 'cash' ? 'pix' : method, // map cash to pix for schema compatibility
      status: 'paid',
      confirmation_code: code,
      paid_at: new Date().toISOString(),
    })

    if (paymentError) { toast.error('Erro ao registrar pagamento'); setActing(false); return }

    // Close session
    const { error: sessionError } = await supabase
      .from('sessions')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', session.id)

    if (sessionError) { toast.error('Erro ao encerrar sessão'); setActing(false); return }

    onTableUpdated(table.id, 'free')
    setConfirmationCode(code)
    setView('confirmed')
    setActing(false)
  }

  async function handleCancelReservation() {
    setActing(true)
    if (DEV_BYPASS) {
      onTableUpdated(table.id, 'free')
      toast.success(`Reserva da Mesa ${table.number} cancelada.`)
      onClose()
      return
    }
    const supabase = createClient()
    const { error } = await supabase.from('tables').update({ status: 'free' }).eq('id', table.id)
    if (error) { toast.error('Erro ao cancelar reserva'); setActing(false); return }
    onTableUpdated(table.id, 'free')
    toast.success(`Reserva da Mesa ${table.number} cancelada.`)
    onClose()
  }

  async function handleSwitchTable(targetTable: RestaurantTable) {
    if (!session) return
    setActing(true)
    if (DEV_BYPASS) {
      onTableSwitched(table.id, targetTable.id)
      toast.success(`Mesa ${table.number} → Mesa ${targetTable.number}`)
      onClose()
      return
    }
    const supabase = createClient()
    const { error } = await supabase.from('sessions').update({ table_id: targetTable.id }).eq('id', session.id)
    if (error) { toast.error('Erro ao trocar mesa'); setActing(false); return }
    await supabase.from('tables').update({ status: 'free' }).eq('id', table.id)
    await supabase.from('tables').update({ status: 'occupied' }).eq('id', targetTable.id)
    onTableSwitched(table.id, targetTable.id)
    toast.success(`Mesa ${table.number} → Mesa ${targetTable.number}`)
    onClose()
  }

  const statusColor = table.status === 'occupied'
    ? 'bg-primary-container/20 text-primary border border-primary/30'
    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'

  const titles: Record<View, string> = {
    detail:    `Mesa ${table.number}`,
    switch:    'Trocar para qual mesa?',
    payment:   'Fechar Conta',
    confirmed: 'Pagamento Confirmado',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={view === 'confirmed' ? onClose : onClose}>
      <div className="bg-surface-container border border-outline-variant rounded-xl w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            {(view === 'switch' || view === 'payment') && (
              <button
                onClick={() => setView('detail')}
                className="text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>
                {titles[view]}
              </h2>
              {view === 'detail' && (
                <span className={`text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded mt-0.5 inline-block ${statusColor}`}>
                  {table.status === 'occupied' ? 'Ocupada' : 'Reservada'}
                </span>
              )}
            </div>
          </div>
          {view !== 'confirmed' && (
            <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-5">

          {/* ── DETAIL ── */}
          {view === 'detail' && (
            <div className="space-y-4">
              {table.status === 'occupied' && (
                <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 space-y-3">
                  {loadingSession ? (
                    <div className="flex justify-center py-2"><Loader2 className="h-5 w-5 animate-spin text-on-surface-variant" /></div>
                  ) : session ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-xs font-mono text-on-surface-variant">Tempo na mesa</span>
                        <span className="text-sm font-bold font-mono text-on-surface">{formatDuration(session.started_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs font-mono text-on-surface-variant">Pedidos</span>
                        <span className="text-sm font-bold font-mono text-on-surface">{session.orderCount}</span>
                      </div>
                      <div className="flex justify-between border-t border-outline-variant pt-3">
                        <span className="text-xs font-mono text-on-surface-variant">Total acumulado</span>
                        <span className="text-base font-bold font-mono text-primary">{formatCurrency(session.total)}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs font-mono text-on-surface-variant text-center">Sessão não encontrada</p>
                  )}
                </div>
              )}

              {table.status === 'reserved' && (
                <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4">
                  <p className="text-sm font-mono text-on-surface-variant text-center">Mesa aguardando cliente reservado.</p>
                </div>
              )}

              <div className="space-y-2 pt-1">
                {table.status === 'occupied' && (
                  <>
                    <button
                      onClick={() => setView('switch')}
                      disabled={freeTables.length === 0}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface font-mono text-sm rounded-lg hover:bg-surface-variant transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                      Trocar de Mesa
                    </button>
                    <button
                      onClick={() => setView('payment')}
                      disabled={!session}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-container text-on-primary-container font-bold font-mono text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      <LogOut className="h-4 w-4" />
                      Encerrar Mesa
                    </button>
                  </>
                )}

                {table.status === 'reserved' && (
                  <button
                    onClick={handleCancelReservation}
                    disabled={acting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-error/10 border border-error/30 text-error font-bold font-mono text-sm rounded-lg hover:bg-error/20 transition-colors disabled:opacity-50"
                  >
                    {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Cancelar Reserva
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── SWITCH TABLE ── */}
          {view === 'switch' && (
            <div className="space-y-3">
              <p className="text-xs font-mono text-on-surface-variant mb-3">Selecione uma mesa livre para mover a sessão.</p>
              <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                {freeTables.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSwitchTable(t)}
                    disabled={acting}
                    className="aspect-square border border-outline-variant hover:border-primary hover:bg-primary-container/10 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 group"
                  >
                    <span className="text-xs font-bold font-mono text-on-surface-variant group-hover:text-primary transition-colors">
                      T-{t.number.padStart(2, '0')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── PAYMENT ── */}
          {view === 'payment' && session && (
            <div className="space-y-4">
              {/* Total */}
              <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4">
                <p className="text-xs font-mono text-on-surface-variant mb-1">Total da conta</p>
                <p className="text-2xl font-black text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>
                  {formatCurrency(session.total)}
                </p>
              </div>

              {/* Split */}
              <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-on-surface-variant" />
                  <span className="text-xs font-mono text-on-surface-variant">Dividir entre</span>
                </div>
                <div className="flex items-center justify-center gap-5">
                  <button
                    onClick={() => setSplitCount(Math.max(1, splitCount - 1))}
                    className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface font-bold hover:bg-surface-variant transition-colors"
                  >
                    −
                  </button>
                  <span className="text-2xl font-black text-on-surface w-8 text-center" style={{ fontFamily: 'Geist, sans-serif' }}>
                    {splitCount}
                  </span>
                  <button
                    onClick={() => setSplitCount(splitCount + 1)}
                    className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-lg font-bold hover:opacity-90 transition-opacity"
                  >
                    +
                  </button>
                </div>
                {splitCount > 1 && (
                  <p className="text-center text-xs font-mono text-on-surface-variant">
                    Cada um paga: <span className="text-primary font-bold">{formatCurrency(session.total / splitCount)}</span>
                  </p>
                )}
              </div>

              {/* Payment method */}
              <div className="space-y-2">
                <p className="text-xs font-mono text-on-surface-variant uppercase tracking-widest">Forma de pagamento</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setMethod(id)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-colors text-sm font-mono ${
                        method === id
                          ? 'border-primary-container bg-primary-container/10 text-primary'
                          : 'border-outline-variant text-on-surface-variant hover:border-outline'
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount per person + confirm */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-xs font-mono text-on-surface-variant">
                    {splitCount > 1 ? `${splitCount} pessoas pagam` : 'Total a pagar'}
                  </p>
                  <p className="text-lg font-black text-primary" style={{ fontFamily: 'Geist, sans-serif' }}>
                    {formatCurrency(session.total / splitCount)}
                  </p>
                </div>
                <button
                  onClick={handleConfirmPayment}
                  disabled={acting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary-container text-on-primary-container font-bold font-mono text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
                </button>
              </div>
            </div>
          )}

          {/* ── CONFIRMED ── */}
          {view === 'confirmed' && (
            <div className="flex flex-col items-center gap-5 py-4 text-center">
              <CheckCircle2 className="h-16 w-16 text-emerald-400" />
              <div>
                <p className="text-lg font-bold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>Pagamento Confirmado!</p>
                <p className="text-sm font-mono text-on-surface-variant mt-1">Mesa {table.number} liberada</p>
              </div>
              <div className="bg-surface-container-low border border-outline-variant rounded-xl px-8 py-5 w-full">
                <p className="text-xs font-mono text-on-surface-variant mb-2">Código de confirmação</p>
                <p className="text-3xl font-black tracking-widest text-primary" style={{ fontFamily: 'Geist, sans-serif' }}>
                  {confirmationCode}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-surface-container-high border border-outline-variant text-on-surface font-mono text-sm rounded-lg hover:bg-surface-variant transition-colors"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
