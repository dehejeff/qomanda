'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveWaiterRestaurantId } from '@/lib/waiter-restaurant-id'
import { toast } from 'sonner'

type CallRow = {
  id: string
  title: string
  body: string
  created_at: string
  metadata: { localLabel?: string } | null
}

const ACTIVE_WINDOW_MIN = 30

/** Banner de "Chamar Garçom" — chamados em tempo real para o app do garçom. */
export function WaiterCallsBanner() {
  const [calls, setCalls] = useState<CallRow[]>([])
  const restaurantIdRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const restaurantId = restaurantIdRef.current ?? await resolveWaiterRestaurantId(supabase)
    if (!restaurantId) return
    restaurantIdRef.current = restaurantId

    const since = new Date(Date.now() - ACTIVE_WINDOW_MIN * 60_000).toISOString()
    const { data } = await supabase
      .from('restaurant_notifications')
      .select('id, title, body, created_at, metadata')
      .eq('restaurant_id', restaurantId)
      .eq('type', 'call_waiter')
      .is('read_at', null)
      .is('dismissed_at', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
    setCalls((data ?? []) as CallRow[])
  }, [])

  useEffect(() => {
    let ch: ReturnType<ReturnType<typeof createClient>['channel']> | undefined
    let mounted = true

    ;(async () => {
      const supabase = createClient()
      const restaurantId = await resolveWaiterRestaurantId(supabase)
      if (!restaurantId || !mounted) return
      restaurantIdRef.current = restaurantId
      await load()

      ch = supabase
        .channel('garcom-call-waiter')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'restaurant_notifications',
          filter: `restaurant_id=eq.${restaurantId}`,
        }, (payload) => {
          const row = payload.new as { type?: string; metadata?: { localLabel?: string } }
          if (row.type !== 'call_waiter') return
          const label = row.metadata?.localLabel ?? 'Mesa'
          toast(`🙋 ${label} está chamando`, { duration: 8000 })
          load()
        })
        .subscribe()
    })()

    return () => { mounted = false; if (ch) createClient().removeChannel(ch) }
  }, [load])

  async function acknowledge(id: string) {
    setCalls(prev => prev.filter(c => c.id !== id))
    const supabase = createClient()
    await supabase.from('restaurant_notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  }

  if (calls.length === 0) return null

  return (
    <div className="mb-4 space-y-2">
      {calls.map(call => (
        <div
          key={call.id}
          className="flex items-center gap-3 rounded-xl px-4 py-3 animate-pulse-once"
          style={{ background: 'rgba(249,115,22,0.14)', border: '1px solid rgba(249,115,22,0.4)' }}
        >
          <span className="material-symbols-outlined text-[24px] shrink-0" style={{ color: '#ffb690' }}>room_service</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: '#ffb690' }}>{call.metadata?.localLabel ?? 'Mesa'} chamando</p>
            <p className="text-xs truncate" style={{ color: '#e0c0b1' }}>{call.body}</p>
          </div>
          <button
            type="button"
            onClick={() => acknowledge(call.id)}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold font-mono active:scale-95 transition-all"
            style={{ background: '#f97316', color: '#582200' }}
          >
            Atender
          </button>
        </div>
      ))}
    </div>
  )
}
