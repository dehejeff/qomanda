'use client'

import { useEffect, useState } from 'react'
import type { RestaurantTable } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { DEV_BYPASS } from '@/lib/dev-mock'
import { toast } from 'sonner'
import { X, Loader2, ArrowLeftRight, LogOut, XCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Props {
  table: RestaurantTable
  freeTables: RestaurantTable[]
  onClose: () => void
  onTableUpdated: (tableId: string, status: RestaurantTable['status']) => void
  onTableSwitched: (fromId: string, toId: string) => void
}

type View = 'detail' | 'switch'

interface SessionInfo {
  id: string
  started_at: string
  orderCount: number
  total: number
}

export function TableManageModal({ table, freeTables, onClose, onTableUpdated, onTableSwitched }: Props) {
  const [view, setView] = useState<View>('detail')
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [loadingSession, setLoadingSession] = useState(table.status === 'occupied')
  const [acting, setActing] = useState(false)

  useEffect(() => {
    if (table.status !== 'occupied') return

    if (DEV_BYPASS) {
      setSession({
        id: 'mock-session-1',
        started_at: new Date(Date.now() - 73 * 60 * 1000).toISOString(), // 1h13min atrás
        orderCount: 2,
        total: 61.80,
      })
      setLoadingSession(false)
      return
    }

    const supabase = createClient()
    supabase
      .from('sessions')
      .select('id, started_at, orders(id, order_items(unit_price, quantity))')
      .eq('table_id', table.id)
      .eq('status', 'open')
      .single()
      .then(({ data }) => {
        if (!data) { setLoadingSession(false); return }
        const orders = (data as any).orders ?? []
        const total = orders.flatMap((o: any) => o.order_items ?? [])
          .reduce((a: number, i: any) => a + i.unit_price * i.quantity, 0)
        setSession({ id: data.id, started_at: data.started_at, orderCount: orders.length, total })
        setLoadingSession(false)
      })
  }, [table])

  function formatDuration(startedAt: string) {
    const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000)
    if (mins < 60) return `${mins} min`
    return `${Math.floor(mins / 60)}h ${mins % 60}min`
  }

  async function handleCloseSession() {
    if (!session) return
    setActing(true)
    if (DEV_BYPASS) {
      onTableUpdated(table.id, 'free')
      toast.success(`Mesa ${table.number} encerrada.`)
      onClose()
      return
    }
    const supabase = createClient()
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', session.id)
    if (error) { toast.error('Erro ao encerrar sessão'); setActing(false); return }
    onTableUpdated(table.id, 'free')
    toast.success(`Mesa ${table.number} encerrada.`)
    onClose()
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
    // Move session to new table
    const { error: sessionError } = await supabase
      .from('sessions')
      .update({ table_id: targetTable.id })
      .eq('id', session.id)
    if (sessionError) { toast.error('Erro ao trocar mesa'); setActing(false); return }
    // Free old table manually (trigger only handles status changes, not table_id changes)
    await supabase.from('tables').update({ status: 'free' }).eq('id', table.id)
    await supabase.from('tables').update({ status: 'occupied' }).eq('id', targetTable.id)
    onTableSwitched(table.id, targetTable.id)
    toast.success(`Mesa ${table.number} → Mesa ${targetTable.number}`)
    onClose()
  }

  const statusColor = table.status === 'occupied'
    ? 'bg-primary-container/20 text-primary border border-primary/30'
    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-container border border-outline-variant rounded-xl w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            {view === 'switch' && (
              <button onClick={() => setView('detail')} className="text-on-surface-variant hover:text-on-surface transition-colors mr-1">
                <ArrowLeftRight className="h-4 w-4" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>
                {view === 'switch' ? 'Trocar para qual mesa?' : `Mesa ${table.number}`}
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
          {view === 'detail' && (
            <div className="space-y-4">
              {/* Session info — occupied */}
              {table.status === 'occupied' && (
                <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 space-y-3">
                  {loadingSession ? (
                    <div className="flex justify-center py-2">
                      <Loader2 className="h-5 w-5 animate-spin text-on-surface-variant" />
                    </div>
                  ) : session ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-mono text-on-surface-variant">Tempo na mesa</span>
                        <span className="text-sm font-bold font-mono text-on-surface">{formatDuration(session.started_at)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-mono text-on-surface-variant">Pedidos</span>
                        <span className="text-sm font-bold font-mono text-on-surface">{session.orderCount}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-outline-variant pt-3">
                        <span className="text-xs font-mono text-on-surface-variant">Total acumulado</span>
                        <span className="text-base font-bold font-mono text-primary">{formatCurrency(session.total)}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs font-mono text-on-surface-variant text-center">Sessão não encontrada</p>
                  )}
                </div>
              )}

              {/* Reserved info */}
              {table.status === 'reserved' && (
                <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4">
                  <p className="text-sm font-mono text-on-surface-variant text-center">Mesa aguardando cliente reservado.</p>
                </div>
              )}

              {/* Actions */}
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
                      {freeTables.length === 0 && <span className="text-[10px] text-on-surface-variant">(sem mesas livres)</span>}
                    </button>
                    <button
                      onClick={handleCloseSession}
                      disabled={acting || !session}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-error/10 border border-error/30 text-error font-bold font-mono text-sm rounded-lg hover:bg-error/20 transition-colors disabled:opacity-50"
                    >
                      {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
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

          {view === 'switch' && (
            <div className="space-y-3">
              <p className="text-xs font-mono text-on-surface-variant mb-3">
                Selecione uma mesa livre para mover a sessão atual.
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
        </div>
      </div>
    </div>
  )
}
