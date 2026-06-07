'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCounterOrderLabel } from '@/lib/counter-orders'

type OrderTrack = {
  id: string
  status: string
  display_number: number | null
}

const STATUS_MSG: Record<string, string> = {
  pending: 'Recebemos seu pedido',
  confirmed: 'Pedido confirmado',
  preparing: 'Preparando…',
  ready: 'Pronto para retirar!',
  delivered: 'Entregue',
}

export default function CounterTrackPage() {
  const params = useParams()
  const slug = params.slug as string
  const [orders, setOrders] = useState<OrderTrack[]>([])
  const sessionId = typeof window !== 'undefined' ? localStorage.getItem('qomanda_session_id') : null

  useEffect(() => {
    if (!sessionId) return
    const supabase = createClient()

    async function load() {
      const { data } = await supabase
        .from('orders')
        .select('id, status, display_number')
        .eq('session_id', sessionId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
      setOrders(data ?? [])
    }

    load()
    const ch = supabase
      .channel('counter-track')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `session_id=eq.${sessionId}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [sessionId])

  const latest = orders[0]
  const isReady = latest?.status === 'ready' || latest?.status === 'delivered'

  return (
    <div className="min-h-screen bg-background px-4 py-8 max-w-md mx-auto text-center">
      <h1 className="text-2xl font-black text-on-surface">Seu pedido</h1>

      {!latest ? (
        <p className="text-on-surface-variant mt-6 text-sm">Nenhum pedido ainda.</p>
      ) : (
        <div className={`mt-8 rounded-2xl border p-8 ${isReady ? 'border-green-500 bg-green-500/10' : 'border-outline-variant bg-surface-container'}`}>
          <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Número</p>
          <p className="text-6xl font-black text-primary font-mono mt-2">
            {formatCounterOrderLabel(latest.display_number)}
          </p>
          <p className={`text-lg font-semibold mt-6 ${isReady ? 'text-green-400' : 'text-on-surface'}`}>
            {STATUS_MSG[latest.status] ?? latest.status}
          </p>
          {latest.status === 'ready' && (
            <p className="text-sm text-on-surface-variant mt-2">Retire no balcão quando seu número for chamado.</p>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3">
        <Link href={`/${slug}/menu`} className="text-sm font-mono text-primary">Fazer outro pedido</Link>
        <Link href={`/${slug}/pedido`} className="text-sm font-mono text-on-surface-variant">Acompanhar pedidos</Link>
      </div>
    </div>
  )
}
