'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  BarChart,
  brl,
  DonutChart,
  HorizontalBars,
  StatCard,
} from '@/components/internal/overview-charts'
import type { InternalOverviewData } from '@/lib/internal-overview'
import { OverviewHealthBanner } from '@/components/internal/overview-health-banner'

const STATUS_LABEL: Record<string, string> = {
  trialing: 'Trial',
  active: 'Ativo',
  past_due: 'Inadimplente',
  paused: 'Pausado',
  cancelled: 'Cancelado',
  open: 'Aberto',
  in_progress: 'Em atendimento',
}

const SUB_COLORS: Record<string, string> = {
  active: '#34d399',
  trialing: '#60a5fa',
  past_due: '#f87171',
  paused: '#a78bfa',
  cancelled: '#64748b',
  none: '#475569',
}

export default function InternalOverviewPage() {
  const [data, setData] = useState<InternalOverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/internal/overview')
      .then(async r => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? 'Erro ao carregar.')
        setData(json)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-3">
        <span className="material-symbols-outlined text-4xl text-red-400">error</span>
        <p className="text-sm text-on-surface-variant">{error ?? 'Não foi possível carregar o overview.'}</p>
      </div>
    )
  }

  const { stats } = data
  const signupChartData = data.signupSeries.map(d => ({
    date: new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    count: d.count,
    label: new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
  }))

  const monthlyChartData = data.monthlySignups.map(d => ({
    label: d.label ?? d.date,
    count: d.count,
  }))

  const donutItems = data.subscriptionDistribution.map(d => ({
    label: d.label,
    count: d.count,
    color: SUB_COLORS[d.id] ?? '#94a3b8',
  }))

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-1">Operações</p>
          <h1 className="text-2xl font-black text-on-surface">Overview</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Saúde da base, receita recorrente e fila operacional
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/internal/clients/new" className="h-9 px-4 rounded-lg text-xs font-mono font-bold bg-primary-container text-on-primary-container hover:opacity-90 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            Novo cliente
          </Link>
          <Link href="/internal/support" className="h-9 px-4 rounded-lg text-xs font-mono border border-outline-variant text-on-surface-variant hover:text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">support_agent</span>
            Suporte
            {stats.openTickets > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px]">{stats.openTickets}</span>
            )}
          </Link>
        </div>
      </div>

      {/* Sinal de saúde do sistema (verde/amarelo/vermelho) */}
      <OverviewHealthBanner />

      {/* KPIs — receita KiComanda vs volume restaurante */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Clientes" value={stats.total} sub={`+${stats.newThisMonth} este mês`} icon="storefront" />
        <StatCard
          label="MRR planos"
          value={brl(stats.mrrContracted)}
          sub={stats.trialing > 0 ? `${stats.trialing} em trial · ${brl(stats.mrrBilled)} faturando` : `${brl(stats.mrrBilled)} faturando`}
          icon="subscriptions"
          accent="#34d399"
        />
        <StatCard
          label="Taxa tx 30d"
          value={brl(stats.txRevenueLast30Days)}
          sub={`${stats.avgTxFeePercent.toFixed(2)}% sobre Pay digital`}
          icon="percent"
          accent="#f97316"
        />
        <StatCard
          label="Receita KiComanda 30d"
          value={brl(stats.kicomandaRevenueLast30Days)}
          sub="Taxas tx (mensalidade entra após trial)"
          icon="account_balance_wallet"
          accent="#fbbf24"
        />
        <StatCard
          label="Volume Pay 30d"
          value={brl(stats.gmvLast30Days)}
          sub={`${stats.platformPaymentsLast30Days} pagamentos · GMV restaurante`}
          icon="point_of_sale"
          accent="#a78bfa"
        />
        <StatCard label="KiComanda Pay" value={stats.payActive} sub={`${stats.payPending} em análise`} icon="payments" accent="#60a5fa" />
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 text-xs text-on-surface-variant leading-relaxed">
        <span className="font-semibold text-on-surface">Como ler:</span>{' '}
        <strong className="text-on-surface font-medium">Volume Pay</strong> é o que os clientes pagaram nas mesas (dinheiro do restaurante).
        <strong className="text-on-surface font-medium"> Taxa tx</strong> é a comissão KiComanda (% do plano) sobre PIX/cartão.
        <strong className="text-on-surface font-medium"> MRR planos</strong> é a mensalidade contratada — durante trial aparece aqui, mas só entra na receita quando a assinatura vira ativa.
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-surface-container border border-outline-variant rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-on-surface">Novos clientes · últimos 30 dias</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Cadastros por dia</p>
            </div>
            <span className="text-[10px] font-mono uppercase text-on-surface-variant">
              {data.signupSeries.reduce((s, d) => s + d.count, 0)} total
            </span>
          </div>
          <BarChart data={signupChartData} emptyLabel="Nenhum cadastro nos últimos 30 dias." height="h-52" />
        </div>

        <div className="bg-surface-container border border-outline-variant rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-on-surface">Status das assinaturas</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Distribuição atual</p>
          </div>
          <DonutChart
            items={donutItems}
            centerLabel="Clientes"
            centerValue={String(stats.total)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-surface-container border border-outline-variant rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-on-surface">Cadastros por mês</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Últimos 6 meses</p>
          </div>
          <BarChart data={monthlyChartData} labelKey="label" height="h-44" />
        </div>

        <div className="bg-surface-container border border-outline-variant rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-on-surface">Planos</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Clientes e MRR por plano</p>
          </div>
          <HorizontalBars
            items={data.planDistribution.map(p => ({ label: p.label, count: p.count, value: p.value }))}
            showValue={item => brl(item.value ?? 0)}
          />
        </div>

        <div className="bg-surface-container border border-outline-variant rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-on-surface">KiComanda Pay</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Status digital por cliente</p>
          </div>
          <HorizontalBars items={data.payDistribution.map(p => ({ label: p.label, count: p.count }))} />
          <div className="pt-2 border-t border-outline-variant grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-[10px] font-mono uppercase text-on-surface-variant">Mesas ativas</p>
              <p className="text-lg font-black text-on-surface font-mono">{stats.totalTables}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase text-on-surface-variant">Sem conta bancária</p>
              <p className="text-lg font-black text-amber-400 font-mono">{stats.bankPending}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Listas operacionais */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
            <h2 className="text-sm font-semibold text-on-surface">Requer atenção</h2>
            <span className="text-[10px] font-mono text-on-surface-variant">{data.attention.length} itens</span>
          </div>
          <div className="divide-y divide-outline-variant max-h-72 overflow-y-auto">
            {data.attention.map(item => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-container-highest transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">{item.name}</p>
                  <p className="text-xs text-on-surface-variant">{item.reason} · /{item.slug}</p>
                </div>
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border shrink-0 ${
                  item.severity === 'high'
                    ? 'text-red-400 border-red-500/30 bg-red-500/10'
                    : item.severity === 'medium'
                      ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                      : 'text-on-surface-variant border-outline-variant'
                }`}>
                  {item.severity === 'high' ? 'Urgente' : item.severity === 'medium' ? 'Médio' : 'Baixo'}
                </span>
              </Link>
            ))}
            {!data.attention.length && (
              <p className="px-5 py-8 text-sm text-on-surface-variant text-center">Nada pendente — base saudável.</p>
            )}
          </div>
        </div>

        <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
            <h2 className="text-sm font-semibold text-on-surface">Tickets abertos</h2>
            <Link href="/internal/support" className="text-xs font-mono text-primary hover:opacity-80">Ver fila</Link>
          </div>
          <div className="divide-y divide-outline-variant max-h-72 overflow-y-auto">
            {data.openTickets.map(t => (
              <Link key={t.id} href={`/internal/support/${t.id}`} className="block px-5 py-3 hover:bg-surface-container-highest transition-colors">
                <p className="text-[10px] font-mono text-primary">{t.ref}</p>
                <p className="text-sm text-on-surface truncate">{t.subject}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {t.restaurant_name ?? '—'} · {STATUS_LABEL[t.status] ?? t.status}
                </p>
              </Link>
            ))}
            {!data.openTickets.length && (
              <p className="px-5 py-8 text-sm text-on-surface-variant text-center">Nenhum ticket aberto.</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
          <h2 className="text-sm font-semibold text-on-surface">Clientes recentes</h2>
          <Link href="/internal/clients" className="text-xs font-mono text-primary hover:opacity-80">Ver todos</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">
                {['Restaurante', 'Plano', 'Mensalidade', 'Pay', 'Mesas', 'Status'].map(h => (
                  <th key={h} className="px-5 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {data.recent.map(c => (
                <tr key={c.id} className="hover:bg-surface-container-highest">
                  <td className="px-5 py-3">
                    <Link href={`/internal/clients/${c.id}`} className="font-medium text-on-surface hover:text-primary">
                      {c.name}
                    </Link>
                    <p className="text-xs font-mono text-on-surface-variant">/{c.slug}</p>
                  </td>
                  <td className="px-5 py-3 text-on-surface-variant">{c.plan_name ?? '—'}</td>
                  <td className="px-5 py-3 font-mono">{brl(c.monthly_fee)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-mono uppercase ${
                      c.digital_status === 'active' ? 'text-emerald-400' : c.digital_status === 'pending' ? 'text-amber-400' : 'text-on-surface-variant'
                    }`}>
                      {c.digital_status === 'active' ? 'Ativo' : c.digital_status === 'pending' ? 'Análise' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-on-surface-variant">{c.tables_count}</td>
                  <td className="px-5 py-3 text-[10px] font-mono uppercase text-on-surface-variant">
                    {c.subscription_status ? STATUS_LABEL[c.subscription_status] : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.recent.length && (
            <p className="px-5 py-8 text-sm text-on-surface-variant text-center">Nenhum cliente cadastrado ainda.</p>
          )}
        </div>
      </div>
    </div>
  )
}
