'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, ExternalLink } from 'lucide-react'
import type {
  BillingInvoiceDto,
  BillingSubscriptionDto,
} from '@/app/api/dashboard/billing/route'

type MonthPreview = {
  monthlyFee: number
  gmvDigital: number
  commissionTotal: number
  totalDue: number
  effectiveAvgRate: number
  periodYear?: number
  periodMonth?: number
}

type BillingData = {
  currentMonth?: MonthPreview
  previousMonth?: MonthPreview
  commissionTiers?: { maxGmv: number | null; ratePercent: number }[]
  billingDay?: number
  subscription?: BillingSubscriptionDto | null
  invoices?: BillingInvoiceDto[]
  openInvoice?: BillingInvoiceDto | null
  note?: string
}

const INVOICE_STATUS: Record<string, { label: string; className: string }> = {
  paid:      { label: 'Paga',        className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  sent:      { label: 'Aguardando',  className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  overdue:   { label: 'Vencida',     className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  draft:     { label: 'Rascunho',    className: 'bg-surface-container-high text-on-surface-variant border-outline-variant' },
  cancelled: { label: 'Cancelada',   className: 'bg-surface-container-high text-on-surface-variant border-outline-variant' },
}

const SUB_STATUS: Record<string, { label: string; className: string }> = {
  trialing:  { label: 'Trial',         className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  active:    { label: 'Ativo',         className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  past_due:  { label: 'Inadimplente',  className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  paused:    { label: 'Pausado',       className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  cancelled: { label: 'Cancelado',     className: 'bg-surface-container-high text-on-surface-variant border-outline-variant' },
}

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatPeriod(start: string, end: string) {
  const s = new Date(`${start}T12:00:00`)
  const e = new Date(`${end}T12:00:00`)
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()
  if (sameMonth) {
    return s.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }
  return `${s.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })} – ${e.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const d = iso.includes('T') ? new Date(iso) : new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function RestaurantBillingPanel() {
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/billing')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao carregar.')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-on-surface-variant text-sm font-mono">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando mensalidade…
      </div>
    )
  }

  if (error || !data?.currentMonth) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-400">
        {error ?? 'Não foi possível carregar os dados de faturamento.'}
      </div>
    )
  }

  const sub = data.subscription
  const subMeta = SUB_STATUS[sub?.status ?? ''] ?? SUB_STATUS.trialing
  const open = data.openInvoice
  const openMeta = open ? (INVOICE_STATUS[open.status] ?? INVOICE_STATUS.sent) : null

  return (
    <div className="space-y-card-gap">
      {/* Plano + assinatura */}
      {sub && (
        <section className="bg-surface-container border border-outline-variant rounded-xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Seu plano</p>
              <h3 className="text-xl font-bold text-on-surface mt-1">{sub.planName}</h3>
              <p className="text-sm text-on-surface-variant mt-1">
                {brl(sub.monthlyFee)}/mês
                {sub.maxTables ? ` · até ${sub.maxTables} mesas` : ''}
              </p>
            </div>
            <span className={`px-2.5 py-1 text-[10px] font-bold font-mono uppercase tracking-wider rounded border ${subMeta.className}`}>
              {subMeta.label}
            </span>
          </div>
          {sub.status === 'trialing' && sub.trialEndsAt && (
            <p className="text-xs text-on-surface-variant mt-4 font-mono">
              Trial até {formatDate(sub.trialEndsAt)}
            </p>
          )}
          {sub.status === 'past_due' && (
            <p className="text-xs text-red-400 mt-4">
              Há fatura em aberto. Regularize o pagamento para manter o acesso completo.
            </p>
          )}
        </section>
      )}

      {/* Fatura em aberto + link PIX */}
      {open && (
        <section className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-amber-400">Fatura em aberto</p>
              <h3 className="text-lg font-bold text-on-surface mt-1">{formatPeriod(open.periodStart, open.periodEnd)}</h3>
              <p className="text-2xl font-black text-on-surface font-mono mt-2">{brl(open.amount)}</p>
              <p className="text-xs text-on-surface-variant mt-1">
                Vencimento: {formatDate(open.dueDate)}
                {open.notes ? ` · ${open.notes}` : ''}
              </p>
            </div>
            {openMeta && (
              <span className={`px-2.5 py-1 text-[10px] font-bold font-mono uppercase rounded border ${openMeta.className}`}>
                {openMeta.label}
              </span>
            )}
          </div>
          {open.invoiceUrl ? (
            <a
              href={open.invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-primary text-on-primary font-bold text-sm font-mono hover:opacity-90 transition-opacity"
            >
              Pagar com PIX
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <p className="text-xs text-on-surface-variant font-mono">
              Cobrança gerada — link de pagamento em processamento. Entre em contato com o suporte se não receber em 24h.
            </p>
          )}
        </section>
      )}

      {/* Estimativa mês corrente */}
      <section className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Estimativa do mês</p>
          <h3 className="text-lg font-bold text-on-surface mt-1">Acumulado até agora</h3>
          <p className="text-sm text-on-surface-variant">
            Fechamento dia {data.billingDay ?? 5} · fatura referente ao mês anterior · pagamentos digitais 100% na sua conta
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Mensalidade', value: brl(data.currentMonth.monthlyFee) },
            { label: 'GMV digital', value: brl(data.currentMonth.gmvDigital) },
            { label: 'Comissão est.', value: brl(data.currentMonth.commissionTotal) },
            { label: 'Total est.', value: brl(data.currentMonth.totalDue) },
          ].map(s => (
            <div key={s.label} className="rounded-lg bg-surface-dim p-3">
              <p className="text-[10px] font-mono uppercase text-on-surface-variant">{s.label}</p>
              <p className="text-sm font-bold text-on-surface mt-1">{s.value}</p>
            </div>
          ))}
        </div>
        {data.previousMonth && (
          <p className="text-xs font-mono text-on-surface-variant">
            Mês anterior fechado (est.): {brl(data.previousMonth.totalDue)}
            {' '}(GMV {brl(data.previousMonth.gmvDigital)} · comissão {brl(data.previousMonth.commissionTotal)})
          </p>
        )}
      </section>

      {/* Faixas comissão */}
      {data.commissionTiers && (
        <section className="bg-surface-container border border-outline-variant rounded-xl p-6">
          <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-3">Comissão sobre GMV digital</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-on-surface-variant">
            {data.commissionTiers.map((t, i) => (
              <p key={i}>
                {t.maxGmv ? `Até ${brl(t.maxGmv)}` : 'Acima da última faixa'} → <span className="text-on-surface">{t.ratePercent}%</span>
              </p>
            ))}
          </div>
          <p className="text-xs text-on-surface-variant mt-3">Dinheiro na mesa: 0% comissão.</p>
        </section>
      )}

      {/* Histórico de faturas */}
      <section className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Histórico</p>
          <h3 className="text-lg font-bold text-on-surface mt-1">Faturas Qomanda</h3>
          <p className="text-xs text-on-surface-variant mt-1">Mensalidade do plano + comissão sobre vendas digitais do período.</p>
        </div>

        {(data.invoices ?? []).length === 0 ? (
          <p className="text-sm text-on-surface-variant py-6 text-center font-mono">
            Nenhuma fatura emitida ainda. A primeira cobrança ocorre após o trial, todo dia {data.billingDay ?? 5}.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-outline-variant">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  {['Período', 'Valor', 'Vencimento', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-on-surface-variant font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.invoices ?? []).map(inv => {
                  const meta = INVOICE_STATUS[inv.status] ?? INVOICE_STATUS.draft
                  const canPay = (inv.status === 'sent' || inv.status === 'overdue') && inv.invoiceUrl
                  return (
                    <tr key={inv.id} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-highest/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-on-surface capitalize">{formatPeriod(inv.periodStart, inv.periodEnd)}</p>
                        {inv.notes && (
                          <p className="text-[10px] text-on-surface-variant mt-0.5 line-clamp-1">{inv.notes}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-on-surface">{brl(inv.amount)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{formatDate(inv.dueDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold font-mono uppercase rounded border ${meta.className}`}>
                          {meta.label}
                        </span>
                        {inv.paidAt && inv.status === 'paid' && (
                          <p className="text-[10px] text-on-surface-variant mt-1">Pago {formatDate(inv.paidAt)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canPay && (
                          <a
                            href={inv.invoiceUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-primary hover:underline inline-flex items-center gap-1"
                          >
                            Pagar
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
