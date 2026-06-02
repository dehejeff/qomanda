'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { Banknote, Check, Loader2, QrCode } from 'lucide-react'

type PendingPayment = {
  id: string
  amount: number
  created_at: string
  method: 'cash' | 'pix'
  customerName: string
}

interface Props {
  sessionId: string
}

export function PendingCashPaymentsPanel({ sessionId }: Props) {
  const [payments, setPayments] = useState<PendingPayment[]>([])
  const [receivedAmounts, setReceivedAmounts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('payments')
      .select('id, amount, created_at, method, asaas_payment_id, customer:customers(first_name, last_name)')
      .eq('session_id', sessionId)
      .in('method', ['cash', 'pix'])
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    const rows = (data ?? [])
      .filter((p: { method: string; asaas_payment_id?: string | null }) =>
        p.method === 'cash' || (p.method === 'pix' && !p.asaas_payment_id),
      )
      .map((p: any) => ({
        id: p.id,
        amount: Number(p.amount),
        created_at: p.created_at,
        method: p.method as 'cash' | 'pix',
        customerName: p.customer
          ? `${p.customer.first_name} ${p.customer.last_name}`.trim()
          : 'Cliente',
      }))

    setPayments(rows)
    setReceivedAmounts(prev => {
      const next = { ...prev }
      for (const row of rows) {
        if (next[row.id] == null) {
          next[row.id] = row.amount.toFixed(2)
        }
      }
      return next
    })
    setLoading(false)
  }, [sessionId])

  useEffect(() => {
    load()
    const supabase = createClient()
    const ch = supabase
      .channel(`pending-manual-${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'payments',
        filter: `session_id=eq.${sessionId}`,
      }, () => { load() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [sessionId, load])

  async function confirmPayment(paymentId: string, declaredAmount: number) {
    const parsed = parseFloat(receivedAmounts[paymentId]?.replace(',', '.') ?? '') || 0
    if (parsed <= 0) {
      toast.error('Informe o valor recebido.')
      return
    }

    setConfirmingId(paymentId)
    try {
      const body: { paymentId: string; receivedAmount?: number } = { paymentId }
      if (Math.abs(parsed - declaredAmount) > 0.02) {
        body.receivedAmount = parsed
      }

      const res = await fetch('/api/dashboard/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao confirmar pagamento.')
        return
      }
      toast.success(
        Math.abs(parsed - declaredAmount) > 0.02
          ? `Confirmado ${formatCurrency(parsed)} (cliente informou ${formatCurrency(declaredAmount)})`
          : 'Pagamento confirmado!',
      )
      await load()
    } catch {
      toast.error('Erro ao confirmar pagamento.')
    } finally {
      setConfirmingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-2">
        <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" />
      </div>
    )
  }

  if (payments.length === 0) return null

  const cashCount = payments.filter(p => p.method === 'cash').length
  const pixCount = payments.filter(p => p.method === 'pix').length
  const label = cashCount && pixCount
    ? 'Aguardando confirmação (dinheiro / PIX manual)'
    : pixCount
      ? 'Aguardando confirmação (PIX manual)'
      : 'Aguardando confirmação (dinheiro)'

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
        {pixCount ? <QrCode className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
        {label}
      </p>
      {payments.map(p => {
        const received = parseFloat(receivedAmounts[p.id]?.replace(',', '.') ?? '') || 0
        const differs = Math.abs(received - p.amount) > 0.02

        return (
          <div
            key={p.id}
            className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-3 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">{p.customerName}</p>
                <p className="text-xs font-mono text-on-surface-variant">
                  {p.method === 'pix' ? 'PIX manual · ' : 'Dinheiro · '}
                  Informou {formatCurrency(p.amount)} · {new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant block mb-1.5">
                Valor recebido
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-on-surface-variant">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={receivedAmounts[p.id] ?? p.amount.toFixed(2)}
                    onChange={e => setReceivedAmounts(prev => ({ ...prev, [p.id]: e.target.value }))}
                    className="w-full h-10 pl-9 pr-3 rounded-lg font-mono text-sm bg-surface-container-low border border-outline-variant text-on-surface outline-none focus:border-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => confirmPayment(p.id, p.amount)}
                  disabled={confirmingId !== null}
                  className="shrink-0 flex items-center gap-1.5 px-3 h-10 bg-primary-container text-on-primary-container font-bold font-mono text-xs rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {confirmingId === p.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Check className="h-3.5 w-3.5" />}
                  Confirmar
                </button>
              </div>
              {differs && received > 0.01 && (
                <p className="text-[10px] font-mono mt-1.5 text-amber-400">
                  {received > p.amount
                    ? `+${formatCurrency(received - p.amount)} a mais que o informado`
                    : `${formatCurrency(p.amount - received)} a menos que o informado`}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
