'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, FileText, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import type { FinancialAuditEventDto, FinancialAuditSummary } from '@/lib/financial-audit'
import type { RestaurantMonthlyStat } from '@/lib/restaurant-monthly-stats'
import { FINANCIAL_RETENTION_DAYS, type FinancialRetentionRun } from '@/lib/financial-retention'

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = {
  clientId: string
}

export function FinancialAuditPanel({ clientId }: Props) {
  const [summary, setSummary] = useState<FinancialAuditSummary | null>(null)
  const [events, setEvents] = useState<FinancialAuditEventDto[]>([])
  const [monthlyStats, setMonthlyStats] = useState<RestaurantMonthlyStat[]>([])
  const [lastPurge, setLastPurge] = useState<FinancialRetentionRun | null>(null)
  const [filter, setFilter] = useState<'all' | 'payment' | 'order'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [confirmationCode, setConfirmationCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [purging, setPurging] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ entity: filter, limit: '80' })
    if (from) params.set('from', new Date(from).toISOString())
    if (to) params.set('to', new Date(`${to}T23:59:59`).toISOString())
    if (confirmationCode.trim()) params.set('confirmationCode', confirmationCode.trim())

    try {
      const [auditRes, retentionRes] = await Promise.all([
        fetch(`/api/internal/clients/${clientId}/financial-audit?${params}`),
        fetch(`/api/internal/clients/${clientId}/financial-retention`),
      ])
      const auditData = await auditRes.json()
      const retentionData = await retentionRes.json()
      setSummary(auditData.summary ?? null)
      setEvents(auditData.events ?? [])
      setMonthlyStats(retentionData.monthlyStats ?? [])
      setLastPurge(retentionData.status?.lastRun ?? null)
    } catch {
      setSummary(null)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [clientId, filter, from, to, confirmationCode])

  useEffect(() => {
    load()
  }, [load])

  function exportUrl(format: 'csv' | 'html') {
    const params = new URLSearchParams({ format, entity: filter })
    if (from) params.set('from', new Date(from).toISOString())
    if (to) params.set('to', new Date(`${to}T23:59:59`).toISOString())
    if (confirmationCode.trim()) params.set('confirmationCode', confirmationCode.trim())
    return `/api/internal/clients/${clientId}/financial-audit/export?${params}`
  }

  async function handlePurge() {
    if (!confirm(
      `Executar purge agora? Registros detalhados com mais de ${FINANCIAL_RETENTION_DAYS} dias serão removidos após rollup mensal. Totais permanentes são preservados.`,
    )) return
    setPurging(true)
    try {
      const res = await fetch(`/api/internal/clients/${clientId}/financial-retention`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha')
      toast.success(`Purge concluído — ${data.run?.paymentsDeleted ?? 0} pagamentos removidos.`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao executar retenção.')
    } finally {
      setPurging(false)
    }
  }

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-16 text-on-surface-variant">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Carregando auditoria…
      </div>
    )
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
          Integridade financeira
        </p>
        <h3 className="text-sm font-semibold text-on-surface mt-1">Pedidos e pagamentos</h3>
        <p className="text-xs text-on-surface-variant mt-1">
          Detalhes (logs, recibos, NF-e) retidos por {FINANCIAL_RETENTION_DAYS} dias.
          Totais mensais e gasto acumulado do cliente são permanentes — dashboard e hub não perdem histórico agregado.
        </p>
      </div>

      <div className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-xs text-on-surface-variant space-y-1">
        <p>
          <span className="font-mono text-on-surface">Retenção:</span> {FINANCIAL_RETENTION_DAYS} dias de detalhe
          {lastPurge && (
            <> · último purge em {formatDateTime(lastPurge.createdAt)} ({lastPurge.paymentsDeleted} pagamentos)</>
          )}
        </p>
        <p>
          Relatórios do restaurante (até mês anterior) e recibos recentes ficam dentro da janela.
          Faturamento KiComanda usa agregados quando transações antigas já foram purgadas.
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Pagamentos (ativos)', value: String(summary.paidPaymentsCount) },
            { label: 'Volume recente', value: brl(summary.paidVolume) },
            { label: 'Histórico agregado', value: brl(summary.archivedRevenue) },
            { label: 'Meses arquivados', value: String(summary.archivedMonths) },
            { label: 'Eventos auditoria', value: String(summary.auditEventsCount) },
          ].map(item => (
            <div
              key={item.label}
              className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3"
            >
              <p className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">
                {item.label}
              </p>
              <p className="text-lg font-semibold text-on-surface mt-1 font-mono">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {monthlyStats.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
            Faturamento mensal (permanente)
          </p>
          <div className="overflow-x-auto rounded-lg border border-outline-variant">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  {['Período', 'Receita', 'GMV digital', 'Pagamentos'].map(h => (
                    <th key={h} className="px-4 py-2 text-[10px] font-mono uppercase text-on-surface-variant text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyStats.map(s => (
                  <tr key={`${s.periodYear}-${s.periodMonth}`} className="border-b border-outline-variant last:border-0">
                    <td className="px-4 py-2 capitalize">{s.periodLabel}</td>
                    <td className="px-4 py-2 font-mono">{brl(s.revenueTotal)}</td>
                    <td className="px-4 py-2 font-mono">{brl(s.gmvDigital)}</td>
                    <td className="px-4 py-2 font-mono">{s.paymentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-end">
        <label className="space-y-1">
          <span className="text-[10px] font-mono uppercase text-on-surface-variant">De</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="block px-3 py-2 rounded-lg text-sm bg-surface-dim border border-outline-variant" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-mono uppercase text-on-surface-variant">Até</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="block px-3 py-2 rounded-lg text-sm bg-surface-dim border border-outline-variant" />
        </label>
        <label className="space-y-1 flex-1 min-w-[160px]">
          <span className="text-[10px] font-mono uppercase text-on-surface-variant">Cód. confirmação</span>
          <input type="text" value={confirmationCode} onChange={e => setConfirmationCode(e.target.value)}
            placeholder="Ex: ABC123"
            className="block w-full px-3 py-2 rounded-lg text-sm bg-surface-dim border border-outline-variant font-mono" />
        </label>
        <button type="button" onClick={load}
          className="h-10 px-4 rounded-lg text-sm font-mono border border-outline-variant hover:border-primary flex items-center gap-2">
          <Search className="w-4 h-4" />
          Filtrar
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {(
          [
            { id: 'all', label: 'Todos' },
            { id: 'payment', label: 'Pagamentos' },
            { id: 'order', label: 'Pedidos' },
          ] as const
        ).map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setFilter(opt.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-colors ${
              filter === opt.id
                ? 'bg-primary text-on-primary border-primary'
                : 'border-outline-variant text-on-surface-variant hover:border-primary/50'
            }`}
          >
            {opt.label}
          </button>
        ))}

        <span className="flex-1" />

        <a href={exportUrl('csv')} download
          className="h-9 px-3 rounded-lg text-xs font-mono border border-outline-variant hover:border-primary flex items-center gap-2">
          <Download className="w-3.5 h-3.5" />
          CSV
        </a>
        <a href={exportUrl('html')} target="_blank" rel="noopener noreferrer"
          className="h-9 px-3 rounded-lg text-xs font-mono border border-outline-variant hover:border-primary flex items-center gap-2">
          <FileText className="w-3.5 h-3.5" />
          PDF / Imprimir
        </a>
        <button type="button" onClick={handlePurge} disabled={purging}
          className="h-9 px-3 rounded-lg text-xs font-mono border border-error/40 text-error hover:bg-error/10 disabled:opacity-50">
          {purging ? 'Executando…' : 'Executar purge'}
        </button>
      </div>

      {!events.length ? (
        <p className="text-sm text-on-surface-variant py-8 text-center font-mono">
          Nenhum evento no filtro. Exporte antes do purge de {FINANCIAL_RETENTION_DAYS} dias para disputas.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-outline-variant">
          <table className="w-full text-sm text-left min-w-[720px]">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low">
                {['Data', 'Evento', 'Entidade', 'Valor', 'Hash'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-on-surface-variant font-normal"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map(row => (
                <tr
                  key={row.id}
                  className="border-b border-outline-variant last:border-0 hover:bg-surface-container-highest/50"
                >
                  <td className="px-4 py-3 text-xs font-mono text-on-surface">
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-on-surface">{row.eventLabel}</p>
                    {(row.previousStatus || row.newStatus) && (
                      <p className="text-[10px] text-on-surface-variant mt-0.5 font-mono">
                        {row.previousStatus ?? '—'} → {row.newStatus ?? '—'}
                      </p>
                    )}
                    {row.confirmationCode && (
                      <p className="text-[10px] text-on-surface-variant mt-0.5 font-mono">
                        Cód. {row.confirmationCode}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs capitalize text-on-surface">{row.entityType}</p>
                    <p className="text-[10px] text-on-surface-variant font-mono truncate max-w-[140px]">
                      {row.entityId}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-on-surface">
                    {row.amount != null ? brl(row.amount) : '—'}
                    {row.method && (
                      <p className="text-[10px] text-on-surface-variant mt-0.5">{row.method}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p
                      className="text-[10px] font-mono text-on-surface-variant truncate max-w-[120px]"
                      title={row.integrityHash}
                    >
                      {row.integrityHash.slice(0, 12)}…
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
