'use client'

import { useCallback, useEffect, useState } from 'react'
import type { WaiterAlertsResponse } from '@/app/api/dashboard/waiter/alerts/route'

export function useWaiterLoyaltyCount() {
  const [count, setCount] = useState(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/waiter/alerts')
      const json = (await res.json()) as WaiterAlertsResponse
      if (res.ok) setCount(json.activeCount ?? 0)
    } catch {
      setCount(0)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  return count
}
