'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RestaurantNotificationDto } from '@/lib/nfe-retention-reminders'

const SEVERITY_STYLE: Record<string, string> = {
  info: 'text-sky-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DashboardNotificationBell() {
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
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-outline-variant last:border-0 ${
                    !n.readAt ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${SEVERITY_STYLE[n.severity] ?? 'text-on-surface-variant'}`}
                    >
                      {n.severity === 'critical' ? 'warning' : 'info'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-on-surface">{n.title}</p>
                      <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{n.body}</p>
                      <p className="text-[10px] text-on-surface-variant mt-1 font-mono">{formatWhen(n.createdAt)}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {n.link && (
                          <Link
                            href={n.link}
                            onClick={() => { if (!n.readAt) markRead(n.id); setOpen(false) }}
                            className="text-xs font-mono text-primary hover:opacity-80"
                          >
                            Ver NF-e →
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
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
