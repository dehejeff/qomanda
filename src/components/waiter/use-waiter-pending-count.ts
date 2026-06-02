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
    const ch = supabase
      .channel('garcom-pending-payments-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  return count
}
