'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useRestaurantRealtime } from '@/lib/use-restaurant-realtime'

type Payment = {
  id: string
  ref: string
  status: string
  method: string
  amount: number
  confirmationCode: string | null
  createdAt: string
  paidAt: string | null
  customerName: string
  tableNumber: string | null
  isManualPending: boolean
}

type Filter = 'all' | 'pending' | 'paid'

const METHOD_LABEL: Record<string, string> = {
  cash: 'Dinheiro',
  pix: 'PIX',
  credit: 'Crédito',
  debit: 'Débito',
}

const METHOD_ICON: Record<string, string> = {
  cash: 'payments',
  pix: 'qr_code_2',
  credit: 'credit_card',
  debit: 'credit_card',
}

function locationLabel(tableNumber: string | null | undefined): string {
  if (!tableNumber) return 'Mesa'
  if (tableNumber.toUpperCase() === 'BALCAO') return 'Balcão'
  return `Mesa ${tableNumber}`
}

function timeLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function CaixaPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/dashboard/caixa')
      const json = await res.json()
      if (res.ok) {
        setPayments(json.payments ?? [])
        if (!restaurantId && json.restaurantId) setRestaurantId(json.restaurantId)
      }
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => { void load() }, [load])

  // Descobre restaurantId para o hook de realtime
  useEffect(() => {
    fetch('/api/dashboard/onboarding')
      .then(r => r.json())
      .then(d => { if (d?.restaurantId) setRestaurantId(d.restaurantId) })
      .catch(() => {})
  }, [])

  useRestaurantRealtime(restaurantId, () => void load(true), { tables: ['payments'] })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return payments.filter(p => {
      if (filter === 'pending' && p.status !== 'pending') return false
      if (filter === 'paid' && p.status !== 'paid') return false
      if (!q) return true
      return (
        p.ref.toLowerCase().includes(q) ||
        p.confirmationCode?.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q) ||
        (p.tableNumber ?? '').toLowerCase().includes(q)
      )
    })
  }, [payments, filter, search])

  const pendingCount = payments.filter(p => p.isManualPending).length

  async function confirmPayment(paymentId: string) {
    setConfirmingId(paymentId)
    try {
      const res = await fetch('/api/dashboard/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro ao confirmar.'); return }
      toast.success(`Pagamento confirmado! Código: ${data.confirmationCode}`)
      void load(true)
    } catch {
      toast.error('Erro ao confirmar pagamento.')
    } finally {
      setConfirmingId(null)
    }
  }

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'pending', label: `Aguardando${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
    { id: 'paid', label: 'Confirmados' },
  ]

  return (
    <div className="space-y-stack-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}>
            Caixa
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Confirme recebimentos e valide códigos de pagamento
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm font-mono text-amber-400">
              {pendingCount} aguardando confirmação
            </span>
          </div>
        )}
      </div>

      {/* Busca + filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-on-surface-variant">search</span>
          <input
            type="text"
            placeholder="Buscar por código (#A3F2D1), nome do cliente, mesa…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-11 pl-9 pr-4 rounded-xl text-sm outline-none bg-surface-container border border-outline-variant text-on-surface focus:border-primary transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-on-surface-variant hover:text-on-surface"
            >
              close
            </button>
          )}
        </div>

        <div className="flex gap-1 p-1 rounded-xl bg-surface-container-low border border-outline-variant">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-lg text-xs font-mono transition-all ${
                filter === f.id
                  ? 'bg-primary-container text-on-primary-container font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border border-outline-variant bg-surface-container">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant opacity-30">
            {search ? 'search_off' : 'point_of_sale'}
          </span>
          <p className="text-sm text-on-surface-variant">
            {search ? `Nenhum resultado para "${search}"` : 'Nenhum pagamento encontrado'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const isPending = p.status === 'pending'
            const isPaid = p.status === 'paid'
            const isFailed = p.status === 'failed'

            return (
              <div
                key={p.id}
                className="bg-surface-container border border-outline-variant rounded-xl p-4"
                style={{
                  borderColor: isPending && p.isManualPending
                    ? 'rgba(245,158,11,0.4)'
                    : isPaid ? 'rgba(52,211,153,0.3)' : undefined,
                  background: isPending && p.isManualPending
                    ? 'rgba(245,158,11,0.05)'
                    : isPaid ? 'rgba(52,211,153,0.03)' : undefined,
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">

                  {/* Código de referência */}
                  <div className="shrink-0 w-24 text-center py-2 px-3 rounded-xl"
                    style={{
                      background: isPaid ? 'rgba(52,211,153,0.1)' : 'rgba(249,115,22,0.08)',
                      border: `1px solid ${isPaid ? 'rgba(52,211,153,0.3)' : 'rgba(249,115,22,0.25)'}`,
                    }}>
                    <p className="text-[9px] font-mono uppercase text-on-surface-variant">Ref.</p>
                    <p className="text-lg font-black font-mono" style={{ color: isPaid ? '#34d399' : '#f97316' }}>
                      #{p.ref}
                    </p>
                  </div>

                  {/* Detalhes */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-on-surface">{p.customerName}</p>
                      <span className="text-xs font-mono text-on-surface-variant">·</span>
                      <span className="text-xs font-mono text-on-surface-variant">{locationLabel(p.tableNumber)}</span>
                      <span className="text-xs font-mono text-on-surface-variant">·</span>
                      <span className="flex items-center gap-1 text-xs font-mono text-on-surface-variant">
                        <span className="material-symbols-outlined text-[13px]">{METHOD_ICON[p.method] ?? 'payments'}</span>
                        {METHOD_LABEL[p.method] ?? p.method}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-base font-bold text-on-surface font-mono">{formatCurrency(p.amount)}</p>
                      {isPaid && p.confirmationCode && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded"
                          style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                          ✓ {p.confirmationCode}
                        </span>
                      )}
                      {isFailed && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded"
                          style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
                          Cancelado
                        </span>
                      )}
                      {isPending && !p.isManualPending && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded"
                          style={{ background: 'rgba(123,208,255,0.1)', color: '#7bd0ff', border: '1px solid rgba(123,208,255,0.25)' }}>
                          Processando gateway
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-on-surface-variant">
                      {timeLabel(p.createdAt)}
                      {p.paidAt && ` · confirmado ${timeLabel(p.paidAt)}`}
                    </p>
                  </div>

                  {/* Ação */}
                  <div className="shrink-0">
                    {p.isManualPending ? (
                      <button
                        type="button"
                        disabled={confirmingId === p.id}
                        onClick={() => void confirmPayment(p.id)}
                        className="h-10 px-5 rounded-xl text-sm font-mono font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        style={{ background: '#f97316', color: '#582200' }}
                      >
                        {confirmingId === p.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <><span className="material-symbols-outlined text-[16px]">check</span> Confirmar</>}
                      </button>
                    ) : isPaid ? (
                      <span className="flex items-center gap-1.5 text-sm font-mono"
                        style={{ color: '#34d399' }}>
                        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        Confirmado
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
