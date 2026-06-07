'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveWaiterRestaurantId } from '@/lib/waiter-restaurant-id'
import { countWaiterPendingPayments } from '@/components/dashboard/waiter-pending-payments-panel'

export function useWaiterPendingCount() {
  const [count, setCount] = useState(0)

  const load = useCallback(async () => {
    const supabase = createClient()
    const restaurantId = await resolveWaiterRestaurantId(supabase)
    if (!restaurantId) {
      setCount(0)
      return
    }
    const n = await countWaiterPendingPayments(supabase, restaurantId)
    setCount(n)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    let ch: ReturnType<typeof supabase.channel> | undefined
    let cancelled = false
    void (async () => {
      const restaurantId = await resolveWaiterRestaurantId(supabase)
      if (cancelled || !restaurantId) return
      ch = supabase
        .channel('garcom-pending-payments-badge')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `restaurant_id=eq.${restaurantId}` }, () => load())
        .subscribe()
    })()
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch) }
  }, [load])

  return count
}
