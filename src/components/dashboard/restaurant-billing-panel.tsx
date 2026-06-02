'use client'

import { useEffect, useState } from 'react'

export function RestaurantBillingPanel() {
  const [data, setData] = useState<{
    currentMonth?: { monthlyFee: number; gmvDigital: number; commissionTotal: number; totalDue: number; effectiveAvgRate: number }
    commissionTiers?: { maxGmv: number | null; ratePercent: number }[]
    billingDay?: number
  } | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/billing').then(r => r.json()).then(setData)
  }, [])

  if (!data?.currentMonth) {
    return <p className="text-sm text-on-surface-variant">Carregando faturamento…</p>
  }

  const c = data.currentMonth
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <section className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-4">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Fatura Qomanda</p>
        <h3 className="text-lg font-bold text-on-surface mt-1">Mês corrente (estimativa)</h3>
        <p className="text-sm text-on-surface-variant">Fechamento todo dia {data.billingDay ?? 5} · referente ao mês anterior</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Mensalidade', value: brl(c.monthlyFee) },
          { label: 'GMV digital', value: brl(c.gmvDigital) },
          { label: 'Comissão', value: brl(c.commissionTotal) },
          { label: 'Total estimado', value: brl(c.totalDue) },
        ].map(s => (
          <div key={s.label} className="rounded-lg bg-surface-dim p-3">
            <p className="text-[10px] font-mono uppercase text-on-surface-variant">{s.label}</p>
            <p className="text-sm font-bold text-on-surface mt-1">{s.value}</p>
          </div>
        ))}
      </div>
      {data.commissionTiers && (
        <div className="text-xs text-on-surface-variant font-mono space-y-1">
          <p className="font-semibold text-on-surface">Faixas de comissão (GMV digital/mês):</p>
          {data.commissionTiers.map((t, i) => (
            <p key={i}>
              {t.maxGmv ? `até ${brl(t.maxGmv)}` : 'acima'} → {t.ratePercent}%
            </p>
          ))}
          <p className="pt-2">Dinheiro na mesa: 0% comissão.</p>
        </div>
      )}
    </section>
  )
}
