'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import { WaiterLoyaltyInlineList } from './waiter-loyalty-panel'
import type { WaiterLoyaltyAlert } from '@/lib/waiter-garcom'
import { useWaiterApp } from './waiter-app-shell'

type TableDetail = {
  table: { id: string; number: string; status: string }
  session: {
    id: string
    status: string
    statusLabel: string
    startedAt: string
    total: number
  } | null
  participants: { customerId: string; name: string; offers: WaiterLoyaltyAlert[] }[]
  loyaltyAlerts: WaiterLoyaltyAlert[]
  canClose: boolean
}

function formatDuration(startedAt: string) {
  const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}min`
}

export function WaiterTableSheet({
  tableId,
  onClose,
  onUpdated,
}: {
  tableId: string
  onClose: () => void
  onUpdated: () => void
}) {
  const { role } = useWaiterApp()
  const router = useRouter()
  const [detail, setDetail] = useState<TableDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/waiter/tables/${tableId}`)
      const json = await res.json()
      if (res.ok) setDetail(json)
    } finally {
      setLoading(false)
    }
  }, [tableId])

  useEffect(() => { load() }, [load])

  async function handleClose() {
    if (!detail?.session) return
    setClosing(true)
    try {
      const res = await fetch(`/api/dashboard/waiter/tables/${tableId}`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Erro ao encerrar mesa.')
        return
      }
      toast.success(json.message ?? 'Mesa atualizada.')
      onUpdated()
      if (json.action === 'closed') onClose()
      else await load()
    } catch {
      toast.error('Erro ao encerrar mesa.')
    } finally {
      setClosing(false)
    }
  }

  const canClose = detail?.canClose && role !== 'kitchen' && detail.session?.status === 'open'

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Fechar"
      />
      <div
        className="relative max-h-[85vh] overflow-y-auto rounded-t-3xl px-5 pt-5 pb-32 max-w-lg mx-auto w-full"
        style={{ background: '#171f33', borderTop: '1px solid rgba(88,66,55,0.5)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
              Mesa
            </p>
            <h2 className="text-3xl font-black font-mono" style={{ color: '#f97316' }}>
              {detail?.table.number ?? '…'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl"
            style={{ color: '#a78b7d', background: '#131b2e' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#f97316' }} />
          </div>
        ) : !detail?.session ? (
          <p className="text-sm font-mono py-8 text-center" style={{ color: '#a78b7d' }}>
            Mesa livre — aguardando clientes
          </p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Status', value: detail.session.statusLabel },
                { label: 'Tempo', value: formatDuration(detail.session.startedAt) },
                { label: 'Consumo', value: formatCurrency(detail.session.total) },
                { label: 'Pessoas', value: String(detail.participants.length) },
              ].map(item => (
                <div
                  key={item.label}
                  className="rounded-xl p-3"
                  style={{ background: '#131b2e', border: '1px solid rgba(88,66,55,0.35)' }}
                >
                  <p className="text-[10px] font-mono uppercase" style={{ color: '#584237' }}>{item.label}</p>
                  <p className="text-sm font-bold font-mono mt-1">{item.value}</p>
                </div>
              ))}
            </div>

            {detail.session.status === 'closing' && (
              <div
                className="rounded-xl px-4 py-3 text-sm font-mono"
                style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}
              >
                Cliente avisado para pagar · aguardando checkout
              </div>
            )}

            {detail.participants.length > 0 && (
              <section>
                <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: '#a78b7d' }}>
                  Na mesa
                </p>
                <ul className="space-y-1">
                  {detail.participants.map(p => (
                    <li key={p.customerId} className="text-sm font-medium">{p.name}</li>
                  ))}
                </ul>
              </section>
            )}

            {detail.loyaltyAlerts.length > 0 && (
              <section className="space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
                  Fidelidade
                </p>
                <WaiterLoyaltyInlineList alerts={detail.loyaltyAlerts} />
              </section>
            )}

            {role !== 'kitchen' && detail.session.status === 'open' && (
              <button
                type="button"
                onClick={() => router.push(`/garcom/pedido?session=${detail.session!.id}`)}
                className="w-full h-12 rounded-xl font-bold text-sm font-mono flex items-center justify-center gap-2 active:scale-[0.98]"
                style={{ background: '#131b2e', color: '#ffb690', border: '1px solid rgba(249,115,22,0.4)' }}
              >
                <span className="material-symbols-outlined text-[18px]">restaurant_menu</span>
                Fazer pedido
              </button>
            )}

            {canClose && (
              <button
                type="button"
                disabled={closing}
                onClick={() => void handleClose()}
                className="w-full h-12 rounded-xl font-bold text-sm font-mono flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
                style={{
                  background: detail.session.total <= 0.02 ? '#131b2e' : '#f97316',
                  color: detail.session.total <= 0.02 ? '#a78b7d' : '#582200',
                  border: detail.session.total <= 0.02 ? '1px solid #584237' : 'none',
                }}
              >
                {closing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">
                      {detail.session.total <= 0.02 ? 'door_open' : 'point_of_sale'}
                    </span>
                    {detail.session.total <= 0.02 ? 'Encerrar mesa (sem consumo)' : 'Solicitar fechamento'}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
