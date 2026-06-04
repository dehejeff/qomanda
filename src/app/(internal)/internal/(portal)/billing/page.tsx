'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { InternalBillingData, BillingClientRow, BillingDerivedStatus } from '@/lib/internal-billing'

const STATUS_META: Record<BillingDerivedStatus, { label: string; cls: string }> = {
  overdue: { label: 'Em atraso', cls: 'text-red-400 border-red-500/30 bg-red-500/10' },
  due_soon: { label: 'A vencer', cls: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  open: { label: 'Em aberto', cls: 'text-sky-400 border-sky-500/30 bg-sky-500/10' },
  paid: { label: 'Paga', cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  none: { label: 'Sem fatura', cls: 'text-on-surface-variant border-outline-variant bg-surface-dim' },
  cancelled: { label: 'Cancelada', cls: 'text-on-surface-variant border-outline-variant bg-surface-dim' },
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function statusDetail(row: BillingClientRow): string {
  if (row.status === 'overdue') return `há ${row.daysOverdue} ${row.daysOverdue === 1 ? 'dia' : 'dias'}`
  if (row.status === 'due_soon') return row.daysToDue === 0 ? 'vence hoje' : `em ${row.daysToDue} ${row.daysToDue === 1 ? 'dia' : 'dias'}`
  if (row.status === 'paid' && row.paidAt) return `em ${fmtDate(row.paidAt)}`
  return ''
}

export default function InternalBillingPage() {
  const [data, setData] = useState<InternalBillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [billingType, setBillingType] = useState<'BOLETO' | 'PIX'>('BOLETO')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/internal/billing')
      const json = await res.json()
      if (res.ok) setData(json)
      else toast.error(json.error ?? 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function act(row: BillingClientRow, action: 'generate' | 'charge' | 'mark_paid') {
    setBusy(row.restaurantId + action)
    try {
      const res = await fetch('/api/internal/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          billingType,
          restaurantId: row.restaurantId,
          invoiceId: row.invoiceId,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Erro.'); return }
      if (action === 'mark_paid') toast.success('Fatura marcada como paga.')
      else toast.success(json.invoiceUrl ? 'Cobrança emitida.' : 'Fatura gerada.')
      if (json.invoiceUrl) window.open(json.invoiceUrl, '_blank', 'noopener')
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <p className="text-on-surface-variant font-mono">Carregando cobrança…</p>

  const kpis = data?.kpis
  const rows = data?.rows ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-on-surface">Cobrança</h1>
          <p className="text-sm text-on-surface-variant mt-1">Status de pagamento das mensalidades dos clientes.</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/api/internal/billing/export"
            className="px-3 py-1.5 rounded-lg text-xs font-mono border border-outline-variant text-on-surface-variant hover:text-on-surface flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Exportar CSV
          </a>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Emitir como</span>
            <div className="flex rounded-lg overflow-hidden border border-outline-variant">
              {(['BOLETO', 'PIX'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBillingType(t)}
                  className={`px-3 py-1.5 text-xs font-mono ${billingType === t ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'}`}
                >
                  {t === 'BOLETO' ? 'Boleto' : 'PIX'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Em aberto" value={formatCurrency(kpis?.openTotal ?? 0)} sub={`${kpis?.openCount ?? 0} faturas`} />
        <Kpi label="Em atraso" value={formatCurrency(kpis?.overdueTotal ?? 0)} sub={`${kpis?.overdueCount ?? 0} clientes`} accent="text-red-400" />
        <Kpi label="A vencer (5d)" value={String(kpis?.dueSoonCount ?? 0)} sub="próximas" accent="text-amber-400" />
        <Kpi label="Pagas no mês" value={formatCurrency(kpis?.paidThisMonthTotal ?? 0)} sub={`${kpis?.paidThisMonthCount ?? 0} faturas`} accent="text-emerald-400" />
      </div>

      {/* Tabela */}
      <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.6fr_1fr_0.9fr_0.9fr_1.4fr] gap-3 px-4 py-2.5 border-b border-outline-variant text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">
          <span>Cliente</span><span>Status</span><span>Valor</span><span>Vencimento</span><span className="text-right">Ações</span>
        </div>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-on-surface-variant">Nenhum cliente com assinatura.</p>
        ) : rows.map(row => {
          const meta = STATUS_META[row.status]
          const detail = statusDetail(row)
          const unpaid = row.status !== 'paid' && row.status !== 'cancelled'
          return (
            <div key={row.restaurantId} className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_0.9fr_0.9fr_1.4fr] gap-2 md:gap-3 px-4 py-3 border-b border-outline-variant last:border-0 md:items-center">
              <div className="min-w-0">
                <p className="text-sm font-medium text-on-surface truncate">{row.name}</p>
                <p className="text-[11px] font-mono text-on-surface-variant">{row.planName ?? '—'} · {row.subscriptionStatus ?? '—'}</p>
              </div>
              <div>
                <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${meta.cls}`}>{meta.label}</span>
                {detail && <span className="text-[11px] text-on-surface-variant ml-2">{detail}</span>}
              </div>
              <div className="text-sm font-mono text-on-surface">{row.amount != null ? formatCurrency(row.amount) : '—'}</div>
              <div className="text-sm font-mono text-on-surface-variant">{fmtDate(row.dueDate)}</div>
              <div className="flex flex-wrap gap-1.5 md:justify-end">
                {row.invoiceUrl && (
                  <a href={row.invoiceUrl} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 rounded-lg text-[11px] font-mono border border-outline-variant text-primary hover:opacity-80">
                    Ver cobrança
                  </a>
                )}
                {row.status === 'none' && (
                  <ActionBtn busy={busy === row.restaurantId + 'generate'} onClick={() => act(row, 'generate')} label="Gerar cobrança" primary />
                )}
                {unpaid && row.invoiceId && !row.hasCharge && row.status !== 'none' && (
                  <ActionBtn busy={busy === row.restaurantId + 'charge'} onClick={() => act(row, 'charge')} label={billingType === 'BOLETO' ? 'Emitir boleto' : 'Emitir PIX'} primary />
                )}
                {unpaid && row.invoiceId && (
                  <ActionBtn busy={busy === row.restaurantId + 'mark_paid'} onClick={() => act(row, 'mark_paid')} label="Marcar paga" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, accent = 'text-on-surface' }: { label: string; value: string; sub: string; accent?: string }) {
  return (
    <div className="bg-surface-container border border-outline-variant rounded-xl p-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">{label}</p>
      <p className={`text-xl font-black font-mono mt-1 ${accent}`}>{value}</p>
      <p className="text-[11px] text-on-surface-variant mt-0.5">{sub}</p>
    </div>
  )
}

function ActionBtn({ label, onClick, busy, primary }: { label: string; onClick: () => void; busy?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono flex items-center gap-1.5 disabled:opacity-50 ${
        primary ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface-variant hover:text-on-surface'
      }`}
    >
      {busy && <Loader2 className="w-3 h-3 animate-spin" />}
      {label}
    </button>
  )
}
