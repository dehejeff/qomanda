'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type RealtimeTable = 'orders' | 'payments' | 'tables' | 'sessions'

const DEFAULT_WATCH: RealtimeTable[] = ['orders', 'payments', 'tables', 'sessions']

type RealtimeOptions = {
  enabled?: boolean
  debounceMs?: number
  /** Escuta só estas tabelas (padrão: orders, payments, tables). */
  tables?: RealtimeTable[]
}

/**
 * Inscreve em mudanças do Supabase Realtime e chama onChange (com debounce).
 * Requer migrate-realtime.sql aplicado no Supabase.
 */
export function useRestaurantRealtime(
  restaurantId: string | null,
  onChange: () => void,
  options?: RealtimeOptions,
) {
  const enabled = options?.enabled ?? true
  const debounceMs = options?.debounceMs ?? 350
  const watchKey = (options?.tables ?? DEFAULT_WATCH).join(',')
  const watchTables = options?.tables ?? DEFAULT_WATCH

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!restaurantId || !enabled) return

    const supabase = createClient()

    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => onChangeRef.current(), debounceMs)
    }

    let channel = supabase.channel(`restaurant-live-${restaurantId}-${watchKey}`)

    if (watchTables.includes('orders')) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        schedule,
      )
    }

    if (watchTables.includes('payments')) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `restaurant_id=eq.${restaurantId}` },
        schedule,
      )
    }

    if (watchTables.includes('tables')) {
      channel = channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tables', filter: `restaurant_id=eq.${restaurantId}` },
        schedule,
      )
    }

    if (watchTables.includes('sessions')) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions', filter: `restaurant_id=eq.${restaurantId}` },
        schedule,
      )
    }

    channel.subscribe()

    // Poll de 30s como fallback caso o realtime não esteja na publication
    const poll = setInterval(() => onChangeRef.current(), 30_000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [restaurantId, enabled, debounceMs, watchKey])
}

/** Realtime para um pedido específico. */
export function useOrderRealtime(orderId: string | null, onChange: () => void, enabled = true) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!orderId || !enabled) return

    const supabase = createClient()
    const channel = supabase
      .channel(`order-live-${orderId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        () => onChangeRef.current(),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orderId, enabled])
}

/** Realtime para pedidos/pagamentos de uma sessão (mesa ou cliente). */
export function useSessionRealtime(
  sessionId: string | null,
  onChange: () => void,
  enabled = true,
) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!sessionId || !enabled) return

    const supabase = createClient()
    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => onChangeRef.current(), 300)
    }

    const channel = supabase
      .channel(`session-live-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `session_id=eq.${sessionId}` },
        schedule,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `session_id=eq.${sessionId}` },
        schedule,
      )
      .subscribe()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      supabase.removeChannel(channel)
    }
  }, [sessionId, enabled])
}
