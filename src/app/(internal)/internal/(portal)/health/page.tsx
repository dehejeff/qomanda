'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { SystemHealth, HealthLevel, RecentError } from '@/lib/internal-health'

const REFRESH_MS = 15_000

const LEVEL_META: Record<HealthLevel, { label: string; dot: string; text: string }> = {
  ok: { label: 'Operacional', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  warn: { label: 'Atenção', dot: 'bg-amber-400', text: 'text-amber-400' },
  critical: { label: 'Crítico', dot: 'bg-red-400', text: 'text-red-400' },
}

const SOURCE_META: Record<RecentError['source'], { icon: string; cls: string }> = {
  job: { icon: 'sync_problem', cls: 'text-amber-400' },
  webhook: { icon: 'webhook', cls: 'text-red-400' },
  nfe: { icon: 'receipt_long', cls: 'text-sky-400' },
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function InternalHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [auto, setAuto] = useState(true)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/internal/health', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setHealth(data)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!auto) { if (timer.current) clearInterval(timer.current); return }
    timer.current = setInterval(load, REFRESH_MS)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [auto, load])

  if (loading) return <p className="text-on-surface-variant font-mono">Carregando saúde do sistema…</p>
  if (!health) return <p className="text-on-surface-variant">Não foi possível carregar.</p>

  const level = LEVEL_META[health.status]

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${level.dot}`} style={{ boxShadow: `0 0 10px currentColor` }} />
          <div>
            <h1 className="text-2xl font-black text-on-surface">Saúde do sistema</h1>
            <p className={`text-sm font-mono ${level.text}`}>{level.label} · atualizado {fmtTime(health.generatedAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {refreshing && <Loader2 className="w-4 h-4 animate-spin text-on-surface-variant" />}
          <button
            type="button"
            onClick={() => setAuto(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono border ${auto ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-outline-variant text-on-surface-variant'}`}
          >
            {auto ? 'Auto (15s) ●' : 'Auto pausado'}
          </button>
          <button type="button" onClick={load} className="px-3 py-1.5 rounded-lg text-xs font-mono border border-outline-variant text-on-surface-variant hover:text-on-surface">
            Atualizar
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Fila — pendentes" value={health.jobs.pending} hint={health.jobs.oldestPendingMinutes != null ? `mais antigo: ${health.jobs.oldestPendingMinutes} min` : 'fila vazia'} alert={health.jobs.oldestPendingMinutes != null && health.jobs.oldestPendingMinutes > 15} />
        <Stat label="Fila — erros" value={health.jobs.error} hint="últimas 24h" alert={health.jobs.error > 0} />
        <Stat label="Webhooks — erros" value={health.webhooks.error} hint="últimas 24h" alert={health.webhooks.error > 0} critical />
        <Stat label="Jobs processados" value={health.jobs.done24h} hint="últimas 24h" />
        <Stat label="NF-e em erro" value={health.nfe.error} hint="recentes" alert={health.nfe.error > 0} />
        <Stat label="Webhooks OK" value={health.webhooks.processed24h} hint="últimas 24h" />
        <Stat label="Em processamento" value={health.jobs.processing + health.webhooks.processing} hint="jobs + webhooks" />
        <Stat label="Faturas em atraso" value={health.billing.overdue} hint="mensalidades" alert={health.billing.overdue > 0} />
      </div>

      {/* Erros recentes */}
      <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
          <h2 className="text-sm font-semibold text-on-surface">Erros recentes</h2>
          <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">{health.recentErrors.length} eventos</span>
        </div>
        {health.recentErrors.length === 0 ? (
          <p className="py-10 text-center text-sm text-emerald-400 font-mono">Nenhum erro recente 🎉</p>
        ) : (
          <ul className="divide-y divide-outline-variant">
            {health.recentErrors.map((e, i) => {
              const m = SOURCE_META[e.source]
              return (
                <li key={i} className="px-4 py-3 flex items-start gap-3">
                  <span className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${m.cls}`}>{m.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-on-surface">{e.label}</span>
                      <span className="text-[10px] font-mono text-on-surface-variant shrink-0">{fmtTime(e.at)}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5 break-words">{e.message}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-on-surface-variant">
        Para stack traces e alertas push, configure o Sentry (DSN) — ver <span className="font-mono">docs/OBSERVABILITY-WIP.md</span>.
      </p>
    </div>
  )
}

function Stat({ label, value, hint, alert, critical }: { label: string; value: number; hint: string; alert?: boolean; critical?: boolean }) {
  const color = alert ? (critical ? 'text-red-400' : 'text-amber-400') : 'text-on-surface'
  return (
    <div className={`bg-surface-container border rounded-xl p-4 ${alert ? (critical ? 'border-red-500/30' : 'border-amber-500/30') : 'border-outline-variant'}`}>
      <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">{label}</p>
      <p className={`text-2xl font-black font-mono mt-1 ${color}`}>{value}</p>
      <p className="text-[11px] text-on-surface-variant mt-0.5">{hint}</p>
    </div>
  )
}
