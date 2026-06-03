'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { RestaurantNotificationDto } from '@/lib/nfe-retention-reminders'

/** Banner no topo do painel para avisos críticos de retenção de NF-e. */
export function DashboardNotificationBanner() {
  const [alert, setAlert] = useState<RestaurantNotificationDto | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/notifications')
      .then(r => r.json())
      .then(data => {
        const list = (data.notifications ?? []) as RestaurantNotificationDto[]
        const unread = list.filter(n => !n.readAt && n.type === 'nfe_retention')
        const critical = unread.find(n => n.severity === 'critical') ?? unread[0]
        setAlert(critical ?? null)
      })
      .catch(() => setAlert(null))
  }, [])

  if (!alert) return null

  const isCritical = alert.severity === 'critical'

  return (
    <div
      className={`mb-6 rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${
        isCritical
          ? 'border-red-500/40 bg-red-500/10'
          : 'border-amber-500/40 bg-amber-500/10'
      }`}
      role="alert"
    >
      <span
        className={`material-symbols-outlined shrink-0 ${isCritical ? 'text-red-400' : 'text-amber-400'}`}
      >
        {isCritical ? 'warning' : 'schedule'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-on-surface">{alert.title}</p>
        <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{alert.body}</p>
      </div>
      {alert.link && (
        <Link
          href={alert.link}
          className="shrink-0 text-xs font-mono font-bold px-3 py-2 rounded-lg bg-surface-container border border-outline-variant hover:border-primary transition-colors"
        >
          Baixar NF-e
        </Link>
      )}
    </div>
  )
}
