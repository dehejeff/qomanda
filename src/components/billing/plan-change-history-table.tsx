'use client'

import type { PlanChangeDto } from '@/lib/plan-change-history'

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
  changes: PlanChangeDto[]
  emptyMessage?: string
  /** Portal interno mostra origem; mensalidade do restaurante pode ocultar */
  showSource?: boolean
}

export function PlanChangeHistoryTable({
  changes,
  emptyMessage = 'Nenhuma alteração de plano registrada.',
  showSource = true,
}: Props) {
  if (!changes.length) {
    return (
      <p className="text-sm text-on-surface-variant py-4 text-center font-mono">{emptyMessage}</p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-outline-variant">
      <table className="w-full text-sm text-left min-w-[640px]">
        <thead>
          <tr className="border-b border-outline-variant bg-surface-container-low">
            {['Data', 'De → Para', 'Rateio do mês', ...(showSource ? ['Origem'] : [])].map(h => (
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
          {changes.map(row => (
            <tr
              key={row.id}
              className="border-b border-outline-variant last:border-0 hover:bg-surface-container-highest/50"
            >
              <td className="px-4 py-3">
                <p className="text-xs font-mono text-on-surface">{formatDateTime(row.changedAt)}</p>
                <p className="text-[10px] text-on-surface-variant mt-0.5 capitalize">{row.prorationPeriodLabel}</p>
              </td>
              <td className="px-4 py-3">
                <p className="font-medium text-on-surface">
                  {row.fromPlanName} → {row.toPlanName}
                </p>
                <p className="text-[10px] text-on-surface-variant mt-0.5 font-mono">
                  {brl(row.oldMonthlyFee)}/mês → {brl(row.newMonthlyFee)}/mês
                </p>
              </td>
              <td className="px-4 py-3">
                <p className="font-mono font-semibold text-on-surface">{brl(row.proratedTotal)}</p>
                <p className="text-[10px] text-on-surface-variant mt-0.5 font-mono">
                  {row.daysOnOldPlan}d antigo + {row.daysOnNewPlan}d novo
                </p>
                {row.notes && (
                  <p className="text-[10px] text-on-surface-variant mt-1 line-clamp-2">{row.notes}</p>
                )}
              </td>
              {showSource && (
                <td className="px-4 py-3 text-xs text-on-surface-variant">{row.sourceLabel}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
