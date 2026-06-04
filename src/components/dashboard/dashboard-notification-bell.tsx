'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { RestaurantNotificationDto } from '@/lib/nfe-retention-reminders'

const SEVERITY_STYLE: Record<string, string> = {
  info: 'text-sky-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
}

/** Ícone + link/rótulo da ação por tipo de notificação. */
function notificationView(n: RestaurantNotificationDto): { icon: string; href: string | null; cta: string } {
  if (n.type === 'call_waiter') {
    return { icon: 'room_service', href: '/dashboard/tables', cta: 'Ver mesas →' }
  }
  return {
    icon: n.severity === 'critical' ? 'warning' : 'info',
    href: n.link,
    cta: 'Ver NF-e →',
  }
}

/** Beep curto via Web Audio — sem asset. Silencioso se o navegador bloquear. */
function playCallChime() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1175, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
    osc.start()
    osc.stop(ctx.currentTime + 0.36)
    osc.onended = () => ctx.close().catch(() => {})
  } catch { /* navegador pode exigir gesto do usuário — silencia */ }
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DashboardNotificationBell({ restaurantId }: { restaurantId: string }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<RestaurantNotificationDto[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/notifications')
      const data = await res.json()
      if (!res.ok) return
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [load])

  // Realtime: chamado de garçom chega na hora (toast + som), sem esperar o polling.
  useEffect(() => {
    if (!restaurantId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`dashboard-notifications-${restaurantId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'restaurant_notifications',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, (payload) => {
        const row = payload.new as { type?: string; metadata?: { localLabel?: string } }
        if (row.type === 'call_waiter') {
          const label = row.metadata?.localLabel ?? 'Mesa'
          playCallChime()
          toast(`🙋 ${label} está chamando o garçom`, { duration: 10_000 })
        }
        load()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [restaurantId, load])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  async function markRead(id: string) {
    await fetch('/api/dashboard/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: id }),
    })
    load()
  }

  async function markAllRead() {
    await fetch('/api/dashboard/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    load()
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="relative hover:text-primary transition-colors"
        title="Notificações"
        aria-label={`Notificações${unreadCount ? ` (${unreadCount} não lidas)` : ''}`}
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(100vw-2rem,380px)] rounded-xl border border-outline-variant bg-surface-container shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant bg-surface-container-low">
            <p className="text-sm font-semibold text-on-surface">Notificações</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[10px] font-mono text-primary hover:opacity-80"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading ? (
              <p className="text-sm text-on-surface-variant p-4 text-center">Carregando…</p>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-on-surface-variant p-6 text-center">Nenhuma notificação.</p>
            ) : (
              notifications.map(n => {
                const view = notificationView(n)
                return (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-outline-variant last:border-0 ${
                    !n.readAt ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${
                        n.type === 'call_waiter' ? 'text-amber-400' : SEVERITY_STYLE[n.severity] ?? 'text-on-surface-variant'
                      }`}
                    >
                      {view.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-on-surface">{n.title}</p>
                      <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{n.body}</p>
                      <p className="text-[10px] text-on-surface-variant mt-1 font-mono">{formatWhen(n.createdAt)}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {view.href && (
                          <Link
                            href={view.href}
                            onClick={() => { if (!n.readAt) markRead(n.id); setOpen(false) }}
                            className="text-xs font-mono text-primary hover:opacity-80"
                          >
                            {view.cta}
                          </Link>
                        )}
                        {!n.readAt && (
                          <button
                            type="button"
                            onClick={() => markRead(n.id)}
                            className="text-xs font-mono text-on-surface-variant hover:text-on-surface"
                          >
                            Marcar lida
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
