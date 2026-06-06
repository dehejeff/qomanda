'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resolveWaiterRestaurantId } from '@/lib/waiter-restaurant-id'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

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

export function WaiterPaymentsMobile() {
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
      .map((p: Record<string, unknown>) => {
        const customerRaw = p.customer
        const customer = Array.isArray(customerRaw) ? customerRaw[0] : customerRaw
        const sessionRaw = p.session
        const session = Array.isArray(sessionRaw) ? sessionRaw[0] : sessionRaw
        const tableRaw = (session as { table?: unknown })?.table
        const table = Array.isArray(tableRaw) ? tableRaw[0] : tableRaw
        const c = customer as { first_name?: string; last_name?: string } | null
        return {
          id: String(p.id),
          amount: Number(p.amount),
          created_at: String(p.created_at),
          method: p.method as 'cash' | 'pix',
          customerName: c
            ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()
            : 'Cliente',
          locationLabel: formatLocation((table as { number?: string })?.number),
        }
      })

    setPayments(rows)
    setReceivedAmounts(prev => {
      const next = { ...prev }
      for (const row of rows) {
        if (next[row.id] == null) next[row.id] = row.amount.toFixed(2)
      }
      return next
    })
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!restaurantId) return
    const supabase = createClient()
    const ch = supabase
      .channel(`garcom-payments-${restaurantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'payments',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => { load() })
      .subscribe()
    const poll = setInterval(() => { void load() }, 20_000)
    return () => { supabase.removeChannel(ch); clearInterval(poll) }
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
      if (Math.abs(parsed - declaredAmount) > 0.02) body.receivedAmount = parsed

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
          ? `Confirmado ${formatCurrency(parsed)}`
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
      <div className="flex justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <div
        className="rounded-2xl py-14 text-center"
        style={{ background: '#171f33', border: '1px solid rgba(88,66,55,0.4)' }}
      >
        <span className="material-symbols-outlined text-[40px] mb-2" style={{ color: '#584237' }}>
          payments
        </span>
        <p className="text-sm font-mono" style={{ color: '#a78b7d' }}>
          Nenhum pagamento aguardando confirmação
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {payments.map(p => {
        const received = parseFloat(receivedAmounts[p.id]?.replace(',', '.') ?? '') || 0
        const differs = Math.abs(received - p.amount) > 0.02
        const time = new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

        return (
          <li
            key={p.id}
            className="rounded-2xl p-4 space-y-4"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(249,115,22,0.15)' }}
              >
                <span className="material-symbols-outlined text-[22px]" style={{ color: '#ffb690' }}>
                  {p.method === 'pix' ? 'qr_code_2' : 'payments'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold truncate">{p.customerName}</p>
                <p className="text-xs font-mono mt-0.5" style={{ color: '#a78b7d' }}>
                  {p.locationLabel} · {p.method === 'pix' ? 'PIX manual' : 'Dinheiro'} · {time}
                </p>
                <p className="text-lg font-black font-mono mt-2" style={{ color: '#ffb690' }}>
                  Informou {formatCurrency(p.amount)}
                </p>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider block mb-2" style={{ color: '#a78b7d' }}>
                Valor recebido
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono"
                    style={{ color: '#584237' }}
                  >
                    R$
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    value={receivedAmounts[p.id] ?? p.amount.toFixed(2)}
                    onChange={e => setReceivedAmounts(prev => ({ ...prev, [p.id]: e.target.value }))}
                    className="w-full h-12 pl-9 pr-3 rounded-xl font-mono text-base outline-none"
                    style={{
                      background: '#131b2e',
                      border: '1px solid #584237',
                      color: '#dae2fd',
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void confirmPayment(p.id, p.amount)}
                  disabled={confirmingId !== null}
                  className="shrink-0 h-12 px-5 rounded-xl font-bold font-mono text-xs flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50"
                  style={{ background: '#f97316', color: '#582200' }}
                >
                  {confirmingId === p.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">check</span>
                      OK
                    </>
                  )}
                </button>
              </div>
              {differs && received > 0.01 && (
                <p className="text-[10px] font-mono mt-2" style={{ color: '#fbbf24' }}>
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
