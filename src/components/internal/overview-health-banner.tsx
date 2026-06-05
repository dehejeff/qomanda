'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { SystemHealth, HealthLevel } from '@/lib/internal-health'

const META: Record<HealthLevel, { label: string; dot: string; text: string; border: string }> = {
  ok: { label: 'Tudo operacional', dot: 'bg-emerald-400', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  warn: { label: 'Atenção', dot: 'bg-amber-400', text: 'text-amber-400', border: 'border-amber-500/30' },
  critical: { label: 'Crítico', dot: 'bg-red-400', text: 'text-red-400', border: 'border-red-500/30' },
}

/** Faixa compacta de saúde no topo do Overview (sinal verde/amarelo/vermelho). */
export function OverviewHealthBanner() {
  const [health, setHealth] = useState<SystemHealth | null>(null)

  useEffect(() => {
    let alive = true
    const load = () => fetch('/api/internal/health', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (alive && d) setHealth(d) })
      .catch(() => {})
    load()
    const t = setInterval(load, 30_000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  if (!health) return null
  const m = META[health.status]

  const chips: { label: string; value: number; danger?: boolean }[] = [
    { label: 'webhooks c/ erro', value: health.webhooks.error, danger: true },
    { label: 'jobs c/ erro', value: health.jobs.error },
    { label: 'fila pendente', value: health.jobs.pending },
    { label: 'NF-e c/ erro', value: health.nfe.error },
    { label: 'faturas em atraso', value: health.billing.overdue },
  ].filter(c => c.value > 0)

  return (
    <Link
      href="/internal/health"
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border ${m.border} bg-surface-container px-4 py-3 hover:bg-surface-container-highest transition-colors`}
    >
      <span className="flex items-center gap-2 shrink-0">
        <span className={`w-2.5 h-2.5 rounded-full ${m.dot}`} style={{ boxShadow: '0 0 8px currentColor' }} />
        <span className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Saúde</span>
        <span className={`text-sm font-semibold ${m.text}`}>{m.label}</span>
      </span>

      {chips.length > 0 ? (
        <span className="flex flex-wrap items-center gap-2 flex-1">
          {chips.map(c => (
            <span key={c.label} className={`text-[11px] font-mono px-2 py-0.5 rounded border ${c.danger ? 'text-red-400 border-red-500/30' : 'text-amber-400 border-amber-500/30'}`}>
              {c.value} {c.label}
            </span>
          ))}
        </span>
      ) : (
        <span className="text-xs text-on-surface-variant flex-1">Fila, webhooks e cobrança sem pendências.</span>
      )}

      <span className="text-xs font-mono text-primary shrink-0 flex items-center gap-1">
        Ver detalhes <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
      </span>
    </Link>
  )
}
