'use client'

import { useEffect, useState } from 'react'
import type { RestaurantTable } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { DEV_BYPASS } from '@/lib/dev-mock'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { X, Loader2, ArrowLeftRight, XCircle, ChevronLeft, Clock, Send, ListOrdered } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { SETTLE_TOLERANCE } from '@/lib/session-billing'
import { PendingCashPaymentsPanel } from '@/components/dashboard/pending-cash-payments-panel'
import { TableFeaturesField } from '@/components/dashboard/table-features-field'
import { TableCapacityField } from '@/components/dashboard/table-capacity-field'

interface Props {
  table: RestaurantTable
  freeTables: RestaurantTable[]
  onClose: () => void
  onTableUpdated: (tableId: string, status: RestaurantTable['status']) => void
  onTableSwitched: (fromId: string, toId: string) => void
}

type View = 'detail' | 'switch' | 'waiting'

interface TableChange {
  from: string
  to: string
  at: string
}

interface SessionInfo {
  id: string
  restaurant_id: string
  started_at: string
  orderCount: number
  total: number
  table_history: TableChange[]
}

export function TableManageModal({ table, freeTables, onClose, onTableUpdated, onTableSwitched }: Props) {
  const router = useRouter()
  const [view, setView] = useState<View>('detail')
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [loadingSession, setLoadingSession] = useState(table.status === 'occupied')
  const [acting, setActing] = useState(false)

  useEffect(() => {
    if (table.status !== 'occupied') return

    if (DEV_BYPASS) {
      const savedHistory = localStorage.getItem('qomanda_mock_table_history')
      const savedStartedAt = localStorage.getItem('qomanda_mock_started_at')
      setSession({
        id: 'mock-session-1',
        restaurant_id: 'mock-restaurant-id',
        started_at: savedStartedAt ?? new Date(Date.now() - 73 * 60 * 1000).toISOString(),
        orderCount: 2,
        total: 61.80,
        table_history: savedHistory ? JSON.parse(savedHistory) : [],
      })
      setLoadingSession(false)
      return
    }

    const supabase = createClient()
    supabase
      .from('sessions')
      .select('id, started_at, restaurant_id, table_history')
      .eq('table_id', table.id)
      .in('status', ['open', 'closing'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) { setLoadingSession(false); return }

        const { data: orders } = await supabase
          .from('orders')
          .select('id, items:order_items(unit_price, quantity)')
          .eq('session_id', data.id)

        const orderList = orders ?? []
        const total = orderList
          .flatMap((o) => o.items ?? [])
          .reduce((a, i) => a + i.unit_price * i.quantity, 0)

        setSession({
          id: data.id,
          restaurant_id: data.restaurant_id,
          started_at: data.started_at,
          orderCount: orderList.length,
          total,
          table_history: (data as any).table_history ?? [],
        })
        setLoadingSession(false)
      })
  }, [table])

  function formatDuration(startedAt: string) {
    const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000)
    if (mins < 60) return `${mins} min`
    return `${Math.floor(mins / 60)}h ${mins % 60}min`
  }

  async function handleRequestClose() {
    if (!session) return
    setActing(true)

    // Sem consumo: nada a pagar → fecha a sessão direto e libera a mesa.
    const hasNothingToPay = session.total <= SETTLE_TOLERANCE

    if (DEV_BYPASS) {
      localStorage.removeItem('qomanda_mock_table_history')
      localStorage.removeItem('qomanda_mock_started_at')
      if (hasNothingToPay) {
        onTableUpdated(table.id, 'free')
        toast.success(`Mesa ${table.number} encerrada (sem consumo).`)
        onClose()
        return
      }
      setView('waiting')
      setActing(false)
      toast.success('Solicitação enviada ao cliente.')
      return
    }

    const supabase = createClient()

    if (hasNothingToPay) {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'closed', closed_at: new Date().toISOString() })
        .eq('id', session.id)
        .in('status', ['open', 'closing'])

      if (error) { toast.error('Erro ao encerrar mesa'); setActing(false); return }

      onTableUpdated(table.id, 'free')
      toast.success(`Mesa ${table.number} encerrada (sem consumo).`)
      onClose()
      return
    }

    const { error } = await supabase
      .from('sessions')
      .update({ status: 'closing' })
      .eq('id', session.id)

    if (error) { toast.error('Erro ao solicitar fechamento'); setActing(false); return }

    setView('waiting')
    setActing(false)
    toast.success('Solicitação enviada ao cliente.')
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

  /** Libera uma mesa órfã: ocupada mas sem sessão aberta (estado inconsistente). */
  async function handleForceFree() {
    setActing(true)
    if (DEV_BYPASS) {
      onTableUpdated(table.id, 'free')
      toast.success(`Mesa ${table.number} liberada.`)
      onClose()
      return
    }
    const supabase = createClient()
    // Encerra qualquer sessão pendente e libera a mesa.
    await supabase
      .from('sessions')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('table_id', table.id)
      .in('status', ['open', 'closing'])
    const { error } = await supabase.from('tables').update({ status: 'free' }).eq('id', table.id)
    if (error) { toast.error('Erro ao liberar mesa'); setActing(false); return }
    onTableUpdated(table.id, 'free')
    toast.success(`Mesa ${table.number} liberada.`)
    onClose()
  }

  async function handleSwitchTable(targetTable: RestaurantTable) {
    if (!session) return
    setActing(true)

    const changeEntry: TableChange = {
      from: table.number,
      to: targetTable.number,
      at: new Date().toISOString(),
    }
    const newHistory = [...session.table_history, changeEntry]

    if (DEV_BYPASS) {
      const newHistory = [...session.table_history, changeEntry]
      localStorage.setItem('qomanda_mock_table_history', JSON.stringify(newHistory))
      // Preserve started_at so timer continues from original start
      if (!localStorage.getItem('qomanda_mock_started_at')) {
        localStorage.setItem('qomanda_mock_started_at', session.started_at)
      }
      onTableSwitched(table.id, targetTable.id)
      toast.success(`Mesa ${table.number} → Mesa ${targetTable.number}`)
      onClose()
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('sessions')
      .update({ table_id: targetTable.id, table_history: newHistory })
      .eq('id', session.id)

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
    detail:  `Mesa ${table.number}`,
    switch:  'Trocar para qual mesa?',
    waiting: 'Aguardando cliente',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-container border border-outline-variant rounded-t-2xl sm:rounded-xl w-full sm:max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            {view === 'switch' && (
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
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">

          {/* ── DETAIL ── */}
          {view === 'detail' && (
            <div className="space-y-4">
              {table.status === 'occupied' && (
                <>
                  <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 space-y-3">
                    {loadingSession ? (
                      <div className="flex justify-center py-2">
                        <Loader2 className="h-5 w-5 animate-spin text-on-surface-variant" />
                      </div>
                    ) : session ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-xs font-mono text-on-surface-variant">Tempo na mesa</span>
                          <span className="text-sm font-bold font-mono text-on-surface">{formatDuration(session.started_at)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs font-mono text-on-surface-variant">Pedidos realizados</span>
                          <span className="text-sm font-bold font-mono text-on-surface">{session.orderCount}</span>
                        </div>
                        <div className="flex justify-between border-t border-outline-variant pt-3">
                          <span className="text-xs font-mono text-on-surface-variant">Total em aberto</span>
                          <span className="text-base font-bold font-mono text-primary">{formatCurrency(session.total)}</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs font-mono text-on-surface-variant text-center">Sessão não encontrada</p>
                    )}
                  </div>

                  {session && (
                    <PendingCashPaymentsPanel sessionId={session.id} />
                  )}

                  {/* Table history */}
                  {session && session.table_history.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                        <Clock className="h-3 w-3" /> Histórico de trocas
                      </p>
                      {session.table_history.map((h, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-mono text-on-surface-variant bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2">
                          <span>Mesa {h.from}</span>
                          <ArrowLeftRight className="h-3 w-3 text-primary flex-shrink-0" />
                          <span>Mesa {h.to}</span>
                          <span className="ml-auto opacity-50">{new Date(h.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {table.status === 'reserved' && (
                <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4">
                  <p className="text-sm font-mono text-on-surface-variant text-center">Mesa aguardando cliente reservado.</p>
                </div>
              )}

              <div className="space-y-2 pt-1">
                {table.status === 'occupied' && session && (
                  <>
                    <button
                      onClick={() => {
                        onClose()
                        router.push(`/dashboard/orders/table/${table.id}`)
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface font-mono text-sm rounded-lg hover:bg-surface-variant transition-colors"
                    >
                      <ListOrdered className="h-4 w-4" />
                      Ir para pedidos
                    </button>
                    <button
                      onClick={() => setView('switch')}
                      disabled={freeTables.length === 0}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface font-mono text-sm rounded-lg hover:bg-surface-variant transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                      Trocar de Mesa
                      {freeTables.length === 0 && (
                        <span className="text-[10px] text-on-surface-variant">(sem mesas livres)</span>
                      )}
                    </button>
                    <button
                      onClick={handleRequestClose}
                      disabled={acting}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-container text-on-primary-container font-bold font-mono text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      {acting
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : session.total <= SETTLE_TOLERANCE
                          ? <XCircle className="h-4 w-4" />
                          : <Send className="h-4 w-4" />
                      }
                      {session.total <= SETTLE_TOLERANCE ? 'Encerrar Mesa (sem consumo)' : 'Encerrar Mesa'}
                    </button>
                  </>
                )}

                {/* Mesa órfã: ocupada mas sem sessão aberta — permite recuperação */}
                {table.status === 'occupied' && !loadingSession && !session && (
                  <button
                    onClick={handleForceFree}
                    disabled={acting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-error/10 border border-error/30 text-error font-bold font-mono text-sm rounded-lg hover:bg-error/20 transition-colors disabled:opacity-50"
                  >
                    {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Liberar Mesa
                  </button>
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

              {/* Características da mesa (fila de espera) */}
              <div className="pt-2 border-t border-outline-variant space-y-4">
                <TableCapacityField tableId={table.id} initial={table.capacity} />
                <TableFeaturesField mode="persist" tableId={table.id} />
              </div>
            </div>
          )}

          {/* ── SWITCH TABLE ── */}
          {view === 'switch' && (
            <div className="space-y-3">
              <p className="text-xs font-mono text-on-surface-variant">
                Todos os pedidos, tempo e histórico serão migrados para a mesa escolhida.
              </p>
              <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                {freeTables.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSwitchTable(t)}
                    disabled={acting}
                    className="aspect-square border border-outline-variant hover:border-primary hover:bg-primary-container/10 rounded-lg flex flex-col items-center justify-center transition-all disabled:opacity-50 group"
                  >
                    <span className="text-xs font-bold font-mono text-on-surface-variant group-hover:text-primary transition-colors">
                      T-{t.number.padStart(2, '0')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── WAITING FOR CLIENT PAYMENT ── */}
          {view === 'waiting' && (
            <div className="flex flex-col items-center gap-5 py-4 text-center">
              <div className="w-16 h-16 rounded-full bg-primary-container/10 border border-primary/20 flex items-center justify-center">
                <Send className="h-7 w-7 text-primary animate-pulse" />
              </div>
              <div>
                <p className="text-base font-bold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>
                  Solicitação enviada!
                </p>
                <p className="text-sm font-mono text-on-surface-variant mt-1.5 leading-relaxed">
                  O cliente da Mesa {table.number} recebeu a notificação no app e irá escolher o método de pagamento e fechar a conta.
                </p>
              </div>
              <div className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-4">
                <p className="text-xs font-mono text-on-surface-variant">Total em aberto</p>
                <p className="text-xl font-black text-primary mt-1" style={{ fontFamily: 'Geist, sans-serif' }}>
                  {session ? formatCurrency(session.total) : '—'}
                </p>
              </div>
              <p className="text-xs font-mono text-on-surface-variant/60">
                A mesa será liberada automaticamente após a confirmação do pagamento.
              </p>
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
