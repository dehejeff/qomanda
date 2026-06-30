'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveWaiterRestaurantId } from '@/lib/waiter-restaurant-id'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { Banknote, Check, Loader2, QrCode } from 'lucide-react'

type PendingPayment = {
  id: string
  amount: number
  created_at: string
  method: 'cash' | 'pix'
  customerName: string
  locationLabel: string
}

function formatLocation(tableNumber: string | null | undefined): string {
  if (!tableNumber) return 'Mesa'
  if (tableNumber.toUpperCase() === 'BALCAO') return 'Balcão'
  return `Mesa ${tableNumber}`
}

export function WaiterPendingPaymentsPanel() {
  const [payments, setPayments] = useState<PendingPayment[]>([])
  const [receivedAmounts, setReceivedAmounts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const rid = await resolveWaiterRestaurantId(supabase)
    setRestaurantId(rid)
    if (!rid) {
      setPayments([])
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('payments')
      .select(`
        id, amount, created_at, method, asaas_payment_id,
        customer:customers(first_name, last_name),
        session:sessions(table:tables(number))
      `)
      .eq('restaurant_id', rid)
      .in('method', ['cash', 'pix'])
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    const rows = (data ?? [])
      .filter((p: { method: string; asaas_payment_id?: string | null }) =>
        p.method === 'cash' || (p.method === 'pix' && !p.asaas_payment_id),
      )
      .map((p: any) => {
        const customerRaw = p.customer
        const customer = Array.isArray(customerRaw) ? customerRaw[0] : customerRaw
        const sessionRaw = p.session
        const session = Array.isArray(sessionRaw) ? sessionRaw[0] : sessionRaw
        const tableRaw = session?.table
        const table = Array.isArray(tableRaw) ? tableRaw[0] : tableRaw
        return {
          id: p.id,
          amount: Number(p.amount),
          created_at: p.created_at,
          method: p.method as 'cash' | 'pix',
          customerName: customer
            ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim()
            : 'Cliente',
          locationLabel: formatLocation(table?.number),
        }
      })

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
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!restaurantId) return

    const supabase = createClient()
    const ch = supabase
      .channel(`waiter-pending-payments-${restaurantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'payments',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => { load() })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [load, restaurantId])

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
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-on-surface-variant" />
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant py-4">
        Nenhum pagamento aguardando confirmação.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {payments.map(p => {
        const received = parseFloat(receivedAmounts[p.id]?.replace(',', '.') ?? '') || 0
        const differs = Math.abs(received - p.amount) > 0.02

        return (
          <li
            key={p.id}
            className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {p.method === 'pix'
                    ? <QrCode className="h-4 w-4 text-amber-400 shrink-0" />
                    : <Banknote className="h-4 w-4 text-amber-400 shrink-0" />}
                  <p className="text-sm font-bold text-on-surface truncate">{p.customerName}</p>
                </div>
                <p className="text-xs font-mono text-on-surface-variant">
                  {p.locationLabel} · {p.method === 'pix' ? 'PIX manual' : 'Dinheiro'} · Informou {formatCurrency(p.amount)}
                </p>
                <p className="text-[10px] font-mono text-on-surface-variant mt-0.5">
                  {new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {/* Código de referência — cliente mostra na tela */}
              <div className="shrink-0 text-center px-3 py-2 rounded-lg"
                style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)' }}>
                <p className="text-[9px] font-mono uppercase" style={{ color: '#8B949E' }}>Ref.</p>
                <p className="text-base font-black font-mono" style={{ color: '#00E676' }}>
                  #{p.id.slice(-6).toUpperCase()}
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
                    className="w-full h-11 pl-9 pr-3 rounded-lg font-mono text-sm bg-surface-container-low border border-outline-variant text-on-surface outline-none focus:border-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => confirmPayment(p.id, p.amount)}
                  disabled={confirmingId !== null}
                  className="shrink-0 flex items-center gap-1.5 px-4 h-11 bg-primary text-on-primary font-bold font-mono text-xs rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {confirmingId === p.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Check className="h-4 w-4" />}
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
          </li>
        )
      })}
    </ul>
  )
}

/** Contagem rápida para badge/alerta no painel de pedidos. */
export async function countWaiterPendingPayments(supabase: ReturnType<typeof createClient>, restaurantId: string): Promise<number> {
  const { data } = await supabase
    .from('payments')
    .select('id, method, asaas_payment_id')
    .eq('restaurant_id', restaurantId)
    .in('method', ['cash', 'pix'])
    .eq('status', 'pending')

  return (data ?? []).filter(p =>
    p.method === 'cash' || (p.method === 'pix' && !p.asaas_payment_id),
  ).length
}
