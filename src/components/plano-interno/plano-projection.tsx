'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  GTM_CANAIS,
  GTM_CAPACITY,
  GTM_CHECKLIST_PRE_VENDA,
  GTM_FUNNEL,
  GTM_GATILHOS_SDR,
  GTM_ROTINA,
  GTM_SINAIS_ALERTA,
} from '@/components/plano-interno/plano-gtm'
import {
  ACCUMULATED,
  MARKET_BENCHMARK,
  SCENARIO,
  YEAR1_COST_ANNUAL,
  YEAR1_COST_MONTHLY,
  YEAR1_MONTHLY,
  YEAR1_PROFIT_ANNUAL,
  YEAR1_REVENUE_ANNUAL,
  fmtBrl,
  fmtClients,
  fmtK,
  monthlySplit,
} from '@/components/plano-interno/plano-scenario'

const GTM_CHECKLIST_KEY = 'kicomanda_plano_gtm_checklist_v1'

const C = {
  bg: '#06080f',
  surface: '#0c1120',
  surface2: '#111827',
  surface3: '#161f30',
  border: 'rgba(255,255,255,0.06)',
  border2: 'rgba(255,255,255,0.1)',
  text: '#e2e8f4',
  muted: '#4a5568',
  muted2: '#718096',
  y1: '#3b82f6',
  y2: '#8b5cf6',
  y3: '#06b6d4',
  y4: '#f59e0b',
  y5: '#10b981',
  green: '#10b981',
  red: '#ef4444',
} as const

const YEAR_COLORS = [C.y1, C.y2, C.y3, C.y4, C.y5] as const
const YEAR_LABELS = ['Ano 1', 'Ano 2', 'Ano 3', 'Ano 4', 'Ano 5'] as const
const CLIENTS = SCENARIO.clientsEoy
const REVENUES_K = SCENARIO.revenueK
const PROFITS_K = SCENARIO.profitK

const mono = { fontFamily: 'JetBrains Mono, ui-monospace, monospace' } as const

type YearIdx = 0 | 1 | 2 | 3 | 4

function yearKpi(i: YearIdx) {
  return {
    clients: `~${SCENARIO.clientsEoy[i]}`,
    clientsSub: i === 0
      ? `${SCENARIO.newPerMonth[0]} após piloto · churn 2%`
      : `${SCENARIO.yoyClientPct[i]} vs Ano ${i}`,
    mrr: SCENARIO.mrrEoy[i],
    revenue: fmtK(SCENARIO.revenueK[i]),
    profit: fmtK(SCENARIO.profitK[i]),
    margin: SCENARIO.marginPct[i],
    revenueBrl: fmtBrl(SCENARIO.revenueK[i] * 1000),
    profitBrl: fmtBrl(SCENARIO.profitK[i] * 1000),
  }
}

type TabId = 'overview' | 'gtm' | '1' | '2' | '3' | '4' | '5'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'gtm', label: 'Motor Comercial' },
  { id: '1', label: 'Ano 1 · 2026' },
  { id: '2', label: 'Ano 2 · 2027' },
  { id: '3', label: 'Ano 3 · 2028' },
  { id: '4', label: 'Ano 4 · 2029' },
  { id: '5', label: 'Ano 5 · 2030' },
]

function tabActiveStyle(id: TabId): React.CSSProperties {
  if (id === 'overview') return { background: 'rgba(255,255,255,0.08)', color: C.text }
  if (id === 'gtm') return { background: 'rgba(0,230,118,0.18)', color: '#fdba74', fontWeight: 600 }
  const map: Record<string, { bg: string; color: string }> = {
    '1': { bg: 'rgba(59,130,246,0.2)', color: '#93c5fd' },
    '2': { bg: 'rgba(139,92,246,0.2)', color: '#c4b5fd' },
    '3': { bg: 'rgba(6,182,212,0.2)', color: '#67e8f9' },
    '4': { bg: 'rgba(245,158,11,0.2)', color: '#fcd34d' },
    '5': { bg: 'rgba(16,185,129,0.2)', color: '#6ee7b7' },
  }
  const s = map[id]
  return { background: s.bg, color: s.color, fontWeight: 600 }
}

function Pill({ kind, children }: { kind: 'free' | 'paid' | 'new'; children: React.ReactNode }) {
  const styles: Record<string, React.CSSProperties> = {
    free: { background: 'rgba(100,100,100,0.2)', color: C.muted2 },
    paid: { background: 'rgba(59,130,246,0.15)', color: '#93c5fd' },
    new: { background: 'rgba(16,185,129,0.15)', color: '#6ee7b7' },
  }
  return (
    <span className="inline-block text-[9px] px-[7px] py-0.5 rounded-[3px] tracking-wide font-medium" style={styles[kind]}>
      {children}
    </span>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 my-7 mb-3">
      <span className="text-[9px] uppercase tracking-[0.2em] shrink-0" style={{ color: C.muted }}>{children}</span>
      <div className="flex-1 h-px" style={{ background: C.border }} />
    </div>
  )
}

function KpiCard({ accent, label, value, sub, valueColor }: {
  accent: 'blue' | 'purple' | 'cyan' | 'amber' | 'green'
  label: string
  value: string
  sub: string
  valueColor?: string
}) {
  const accentColor = { blue: C.y1, purple: C.y2, cyan: C.y3, amber: C.y4, green: C.y5 }[accent]
  return (
    <div className="rounded-[10px] p-4 relative overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: accentColor }} />
      <p className="text-[9px] uppercase tracking-[0.15em] mb-2" style={{ color: C.muted2 }}>{label}</p>
      <p className="text-[22px] font-semibold leading-none tracking-tight" style={{ color: valueColor ?? accentColor }}>{value}</p>
      <p className="text-[10px] mt-1.5" style={{ color: C.muted2 }}>{sub}</p>
    </div>
  )
}

function Callout({ variant, children }: { variant: 'warn' | 'info' | 'success'; children: React.ReactNode }) {
  const styles = {
    warn: { background: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)', color: '#fcd34d' },
    info: { background: 'rgba(59,130,246,0.07)', border: 'rgba(59,130,246,0.2)', color: '#93c5fd' },
    success: { background: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.2)', color: '#6ee7b7' },
  }[variant]
  return (
    <div className="rounded-lg px-4 py-3 text-[11px] leading-relaxed mt-2.5" style={{ ...styles, border: `1px solid ${styles.border}` }}>
      {children}
    </div>
  )
}

function BarChart({ data, fmt }: { data: readonly number[]; fmt: 'abs' | 'k' }) {
  const max = Math.max(...data)
  return (
    <div className="flex items-end gap-2 h-[120px]">
      {data.map((val, i) => {
        const pct = Math.max((val / max) * 100, 3)
        const label = fmt === 'k'
          ? (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val))
          : val.toLocaleString('pt-BR')
        return (
          <div key={YEAR_LABELS[i]} className="flex-1 flex flex-col items-center justify-end h-full">
            <div className="text-[9px] mb-0.5 font-semibold text-center" style={{ color: YEAR_COLORS[i], ...mono }}>{label}</div>
            <div
              className="w-[75%] rounded-t min-h-1 transition-opacity hover:opacity-100 opacity-80"
              style={{ height: `${pct}%`, background: YEAR_COLORS[i] }}
            />
            <div className="text-[9px] mt-1 text-center" style={{ color: C.muted, ...mono }}>{YEAR_LABELS[i]}</div>
          </div>
        )
      })}
    </div>
  )
}

function PlBox({ rows }: { rows: { label: string; value: string; color?: string; total?: boolean }[] }) {
  return (
    <div className="rounded-[10px] overflow-hidden mt-2.5" style={{ background: C.surface, border: `1px solid ${C.border2}` }}>
      {rows.map((r, i) => (
        <div
          key={r.label}
          className="flex justify-between items-center px-[18px] text-xs"
          style={{
            padding: r.total ? '14px 18px' : '11px 18px',
            borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : undefined,
            background: r.total ? C.surface3 : undefined,
            borderTop: r.total ? `1px solid ${C.border2}` : undefined,
          }}
        >
          <span style={{ color: r.total ? C.text : C.muted2, fontWeight: r.total ? 600 : undefined, fontSize: r.total ? 13 : 12 }}>{r.label}</span>
          <span className="font-semibold" style={{ color: r.color ?? C.text, fontSize: r.total ? 24 : 12 }}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className="text-[9px] uppercase tracking-wider font-medium px-4 py-2.5"
      style={{ color: C.muted2, textAlign: right ? 'right' : 'left', background: C.surface2, borderBottom: `1px solid ${C.border}` }}
    >
      {children}
    </th>
  )
}

function Td({ children, right, className, colSpan, style }: {
  children?: React.ReactNode
  right?: boolean
  className?: string
  colSpan?: number
  style?: React.CSSProperties
}) {
  return (
    <td
      colSpan={colSpan}
      className={`px-4 py-[11px] text-xs align-middle ${className ?? ''}`}
      style={{ color: C.text, textAlign: right ? 'right' : 'left', borderBottom: `1px solid ${C.border}`, ...style }}
    >
      {children}
    </td>
  )
}

function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] overflow-hidden mb-2.5" style={{ border: `1px solid ${C.border}` }}>
      <table className="w-full border-collapse" style={{ background: C.surface, ...mono }}>
        {children}
      </table>
    </div>
  )
}

function YearBadge({ year, title, color, bg, border }: { year: string; title: string; color: string; bg: string; border: string }) {
  return (
    <div
      className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider mb-5"
      style={{ background: bg, color, border: `1px solid ${border}` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      {year} — {title}
    </div>
  )
}

function OverviewPanel() {
  const summaryRows = useMemo(() =>
    SCENARIO.years.map((year, i) => ({
      year,
      color: SCENARIO.yearColors[i],
      clients: fmtClients(SCENARIO.clientsEoy[i]),
      revenue: fmtK(SCENARIO.revenueK[i]),
      cost: fmtK(SCENARIO.costK[i]),
      profit: fmtK(SCENARIO.profitK[i]),
      margin: SCENARIO.marginPct[i],
      team: SCENARIO.team[i],
    })),
  [])

  const milestones = [
    { icon: '🚀', title: 'Ano 1 (2026) — Validação', text: `Solo founders. Piloto de 5 casas no H1, depois ${SCENARIO.newPerMonth[0]} em vendas ativa. Meta: ${SCENARIO.clientsEoy[0]} clientes ativos — ritmo ambicioso e executável com outbound + indicação.` },
    { icon: '👥', title: 'Ano 2 (2027) — Primeiras contratações (M7)', text: `1 suporte + 1 SDR. Meta ${SCENARIO.clientsEoy[1]} clientes (${SCENARIO.newPerMonth[1]}). Upgrade Vercel Pro e Supabase Pro. Margem aperta com folha — normal nesta fase.` },
    { icon: '📐', title: 'Ano 3 (2028) — Estruturação', text: `Time de 6 pessoas. Meta ${SCENARIO.clientsEoy[2]} clientes. Lucro ~${fmtK(SCENARIO.profitK[2])}/ano. Produto e retenção precisam estar sólidos antes de acelerar.` },
    { icon: '⚡', title: 'Ano 4 (2029) — Aceleração comercial', text: `12 pessoas. Motor de vendas enxuto (2 SDRs + 2 Closers). Salto de ${SCENARIO.clientsEoy[2]} → ${SCENARIO.clientsEoy[3]} clientes — ritmo exigente mas factível com PMF.` },
    { icon: '🏆', title: 'Ano 5 (2030) — Escala sustentável', text: `18 pessoas · ${SCENARIO.clientsEoy[4]} clientes · ${SCENARIO.mrrEoy[4]} MRR. ARR ~R$7M run-rate. Base forte para bootstrapped permanente ou rodada estratégica.` },
  ]

  return (
    <div>
      <Callout variant="info">
        <strong>📊 Cenário realista (meta base):</strong> {MARKET_BENCHMARK}
        {' '}Detalhe operacional na aba <strong>Motor Comercial</strong>.
      </Callout>

      <SectionTitle>Clientes ativos ao fim de cada ano</SectionTitle>
      <div className="rounded-[10px] p-5 mb-2.5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <p className="text-[9px] uppercase tracking-wider mb-4" style={{ color: C.muted2 }}>Crescimento de base de clientes</p>
        <BarChart data={CLIENTS} fmt="abs" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
        <div className="rounded-[10px] p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <p className="text-[9px] uppercase tracking-wider mb-4" style={{ color: C.muted2 }}>Receita total anual (R$ mil)</p>
          <BarChart data={REVENUES_K} fmt="k" />
        </div>
        <div className="rounded-[10px] p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <p className="text-[9px] uppercase tracking-wider mb-4" style={{ color: C.muted2 }}>Lucro líquido anual (R$ mil)</p>
          <BarChart data={PROFITS_K} fmt="k" />
        </div>
      </div>

      <SectionTitle>Linha do tempo</SectionTitle>
      <div className="rounded-[10px] p-5 mb-2.5 relative" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center relative">
          <div className="absolute top-4 left-[10%] right-[10%] h-px z-0" style={{ background: C.border2 }} />
          {CLIENTS.map((n, i) => (
            <div key={YEAR_LABELS[i]} className="flex-1 flex flex-col items-center gap-1.5 relative z-10">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold border"
                style={{ background: `${YEAR_COLORS[i]}26`, color: YEAR_COLORS[i], borderColor: C.border2 }}
              >
                A{i + 1}
              </div>
              <div className="text-[11px] font-semibold text-center" style={{ color: YEAR_COLORS[i] }}>{n.toLocaleString('pt-BR')}</div>
              <div className="text-[9px] text-center tracking-wide" style={{ color: C.muted2 }}>clientes</div>
            </div>
          ))}
        </div>
      </div>

      <SectionTitle>Resumo financeiro dos 5 anos</SectionTitle>
      <DataTable>
        <thead>
          <tr>
            <Th>Ano</Th><Th right>Clientes</Th><Th right>Receita</Th><Th right>Custo total</Th>
            <Th right>Lucro líquido</Th><Th right>Margem</Th><Th right>Equipe</Th>
          </tr>
        </thead>
        <tbody>
          {summaryRows.map(r => (
            <tr key={r.year}>
              <Td><span style={{ color: r.color }}>{r.year}</span></Td>
              <Td right>{r.clients}</Td>
              <Td right className="!text-[#60a5fa]">{r.revenue}</Td>
              <Td right className="!text-[#f87171]">{r.cost}</Td>
              <Td right className="!text-[#10b981]">{r.profit}</Td>
              <Td right className="!text-[#10b981]">{r.margin}</Td>
              <Td right className="!text-[#718096]">{r.team}</Td>
            </tr>
          ))}
          <tr style={{ background: C.surface3 }}>
            <Td className="font-semibold !border-t" style={{ borderTop: `1px solid ${C.border2}` }} colSpan={2}>ACUMULADO 5 ANOS</Td>
            <Td right className="font-semibold !text-[#60a5fa] !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>{ACCUMULATED.revenue}</Td>
            <Td right className="font-semibold !text-[#f87171] !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>{ACCUMULATED.cost}</Td>
            <Td right className="font-semibold !text-[#10b981] !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>{ACCUMULATED.profit}</Td>
            <Td right className="font-semibold !text-[#10b981] !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>{ACCUMULATED.margin}</Td>
            <Td right className="!border-t" style={{ borderTop: `1px solid ${C.border2}` }} />
          </tr>
        </tbody>
      </DataTable>

      <SectionTitle>Marcos operacionais</SectionTitle>
      <div className="flex flex-col gap-1.5">
        {milestones.map(m => (
          <div key={m.title} className="flex items-start gap-2.5 rounded-md px-3.5 py-2.5 text-[11px] leading-relaxed" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.muted2 }}>
            <span className="text-[13px] shrink-0 mt-px">{m.icon}</span>
            <div>
              <strong className="block font-medium mb-0.5" style={{ color: C.text }}>{m.title}</strong>
              {m.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Year1Panel() {
  const y = yearKpi(0)
  return (
    <div>
      <YearBadge year="Ano 1 · 2026" title="Validação & Lançamento" color="#93c5fd" bg="rgba(59,130,246,0.1)" border="rgba(59,130,246,0.2)" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-2.5">
        <KpiCard accent="blue" label="Clientes ao fim do ano" value={y.clients} sub={y.clientsSub} />
        <KpiCard accent="blue" label="MRR no mês 12" value={y.mrr} sub="mensalidade + comissão" />
        <KpiCard accent="blue" label="Receita total no ano" value={y.revenue} sub="acumulado 12 meses" />
        <KpiCard accent="blue" label="Lucro líquido anual" value={y.profit} sub={`margem ~${y.margin}`} valueColor={C.green} />
      </div>

      <SectionTitle>Ferramentas & Infraestrutura</SectionTitle>
      <DataTable>
        <thead><tr><Th>Item</Th><Th>Status</Th><Th right>Custo/mês</Th><Th right>Custo anual</Th><Th>Obs.</Th></tr></thead>
        <tbody>
          {[
            ['Claude Pro', <Pill key="p" kind="paid">pago</Pill>, 'R$ 110', 'R$ 1.320', '~$20 USD · já ativo'],
            ['GitHub', <Pill key="p" kind="free">free</Pill>, '—', '—', 'plano gratuito'],
            ['Vercel', <Pill key="p" kind="free">free</Pill>, '—', '—', 'hobby tier'],
            ['Supabase', <Pill key="p" kind="free">free</Pill>, '—', '—', 'free tier'],
            ['Domínio (kicomanda.app + .com.br)', <Pill key="p" kind="new">comprar</Pill>, 'R$ 15', 'R$ 180', '~$35/ano'],
            ['Google Workspace (2 users)', <Pill key="p" kind="new">comprar</Pill>, 'R$ 110', 'R$ 1.320', '~$10/user/mês'],
            ['Gateway Asaas (taxas op.)', <Pill key="p" kind="paid">pago</Pill>, 'R$ 200', 'R$ 2.400', 'cresce com clientes'],
            ['WhatsApp Business API', <Pill key="p" kind="paid">pago</Pill>, 'R$ 150', 'R$ 1.800', 'notificações básicas'],
            ['Email transacional (Resend)', <Pill key="p" kind="free">free</Pill>, '—', '—', 'até 3k emails/mês'],
            ['Sentry (monitoramento)', <Pill key="p" kind="free">free</Pill>, '—', '—', 'plano dev'],
            ['Contabilidade', <Pill key="p" kind="paid">pago</Pill>, 'R$ 350', 'R$ 4.200', 'contador MEI/ME'],
            ['Pró-labore founders (2×)', <Pill key="p" kind="paid">pago</Pill>, 'R$ 5.000', 'R$ 60.000', 'R$ 2.500 cada'],
          ].map(([item, status, mes, ano, obs]) => (
            <tr key={String(item)}>
              <Td>{item}</Td><Td>{status}</Td>
              <Td right className={mes === '—' ? '!text-[#718096]' : '!text-[#fbbf24]'}>{mes}</Td>
              <Td right className={ano === '—' ? '!text-[#718096]' : '!text-[#fbbf24]'}>{ano}</Td>
              <Td className="!text-[#718096]">{obs}</Td>
            </tr>
          ))}
          <tr style={{ background: C.surface3 }}>
            <Td colSpan={2} className="font-semibold !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>CUSTO TOTAL MENSAL</Td>
            <Td right className="font-semibold !text-[#f87171] !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>R$ 5.935</Td>
            <Td right className="font-semibold !text-[#f87171] !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>R$ 71.220</Td>
            <Td className="!border-t" style={{ borderTop: `1px solid ${C.border2}` }} />
          </tr>
        </tbody>
      </DataTable>

      <SectionTitle>Projeção mensal de receita</SectionTitle>
      <DataTable>
        <thead>
          <tr>
            <Th>Mês</Th><Th right>Clientes ativos</Th><Th right>MRR mensalidade</Th><Th right>MRR comissão</Th>
            <Th right>Receita total</Th><Th right>Custo</Th><Th right>Saldo mês</Th>
          </tr>
        </thead>
        <tbody>
          {YEAR1_MONTHLY.map(row => {
            const { sub, com } = monthlySplit(row.total)
            const saldoColor = row.saldo < 0 ? '#f87171' : '#10b981'
            return (
              <tr key={row.mes}>
                <Td>{row.mes}</Td><Td right>{row.ativos}</Td>
                <Td right className="!text-[#60a5fa]">{fmtBrl(sub)}</Td>
                <Td right className="!text-[#60a5fa]">{fmtBrl(com)}</Td>
                <Td right>{fmtBrl(row.total)}</Td>
                <Td right className="!text-[#f87171]">{fmtBrl(YEAR1_COST_MONTHLY)}</Td>
                <Td right style={{ color: saldoColor }}>{fmtBrl(row.saldo)}</Td>
              </tr>
            )
          })}
          <tr style={{ background: C.surface3 }}>
            <Td colSpan={4} className="font-semibold !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>RECEITA ANUAL ACUMULADA</Td>
            <Td right className="font-semibold !text-white !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>{fmtBrl(YEAR1_REVENUE_ANNUAL)}</Td>
            <Td right className="font-semibold !text-[#f87171] !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>{fmtBrl(YEAR1_COST_ANNUAL)}</Td>
            <Td right className="font-semibold !text-[#10b981] !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>{fmtBrl(YEAR1_PROFIT_ANNUAL)}</Td>
          </tr>
        </tbody>
      </DataTable>

      <Callout variant="info">
        <strong>📌 Realidade do Ano 1:</strong> com custo fixo de R$ 5,9k/mês, o break-even mensal chega rápido (~11 clientes).
        Meta de 8–10 novos/mês exige motor comercial rodando — veja a aba <strong>Motor Comercial</strong> (funil, materiais, capacidade de implantação).
      </Callout>
    </div>
  )
}

function Year2Panel() {
  const y = yearKpi(1)
  return (
    <div>
      <YearBadge year="Ano 2 · 2027" title="Primeiras Contratações (M7)" color="#c4b5fd" bg="rgba(139,92,246,0.1)" border="rgba(139,92,246,0.2)" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-2.5">
        <KpiCard accent="purple" label="Clientes ao fim do ano" value={y.clients} sub={y.clientsSub} valueColor="#c4b5fd" />
        <KpiCard accent="purple" label="MRR no mês 24" value={y.mrr} sub="mensalidade + comissão" valueColor="#c4b5fd" />
        <KpiCard accent="purple" label="Receita total no ano" value={y.revenue} sub="acumulado 12 meses" valueColor="#c4b5fd" />
        <KpiCard accent="purple" label="Lucro líquido anual" value={y.profit} sub={`margem ~${y.margin}`} valueColor={C.green} />
      </div>

      <SectionTitle>Upgrades de ferramentas vs Ano 1</SectionTitle>
      <DataTable>
        <thead><tr><Th>Item</Th><Th>Mudança</Th><Th right>Custo/mês</Th><Th right>Custo anual</Th><Th>Quando</Th></tr></thead>
        <tbody>
          {[
            ['Vercel Pro', 'upgrade', 'R$ 110', 'R$ 1.320', '~100 clientes'],
            ['Supabase Pro', 'upgrade', 'R$ 140', 'R$ 1.680', 'banco em crescimento'],
            ['GitHub Team', 'upgrade', 'R$ 55', 'R$ 660', 'com 1 dev contratado'],
            ['Sentry pago', 'upgrade', 'R$ 165', 'R$ 1.980', 'produção estável'],
            ['CRM (HubSpot Starter)', 'novo', 'R$ 280', 'R$ 3.360', 'time de vendas'],
            ['CS Tool (Crisp/Intercom)', 'novo', 'R$ 200', 'R$ 2.400', 'suporte estruturado'],
            ['Google Workspace (4 users)', 'upgrade', 'R$ 220', 'R$ 2.640', '+2 contratados'],
            ['Contabilidade (empresa maior)', 'upgrade', 'R$ 700', 'R$ 8.400', 'faturamento ~R$1M+'],
            ['Gateway + WhatsApp (volume)', 'upgrade', 'R$ 800', 'R$ 9.600', `~${SCENARIO.clientsEoy[1]} clientes`],
          ].map(([item, kind, mes, ano, quando]) => (
            <tr key={String(item)}>
              <Td>{item}</Td>
              <Td><Pill kind={kind === 'novo' ? 'new' : 'new'}>{kind}</Pill></Td>
              <Td right className="!text-[#fbbf24]">{mes}</Td>
              <Td right className="!text-[#fbbf24]">{ano}</Td>
              <Td className="!text-[#718096]">{quando}</Td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      <SectionTitle>Equipe — contratações a partir de M7</SectionTitle>
      <DataTable>
        <thead><tr><Th>Papel</Th><Th>Regime</Th><Th right>Salário base</Th><Th right>Encargos (~35%)</Th><Th right>Custo real/mês</Th></tr></thead>
        <tbody>
          {[
            ['Founders pró-labore (2×)', 'sócios', 'R$ 5.000', '—', 'R$ 10.000'],
            ['Suporte / CS Jr', 'CLT', 'R$ 2.500', 'R$ 875', 'R$ 3.375'],
            ['SDR Jr', 'CLT', 'R$ 2.800', 'R$ 980', 'R$ 3.780'],
          ].map(([papel, regime, base, enc, real]) => (
            <tr key={String(papel)}>
              <Td>{papel}</Td><Td className="!text-[#718096]">{regime}</Td>
              <Td right>{base}</Td><Td right>{enc}</Td>
              <Td right className="!text-[#fbbf24]">{real}</Td>
            </tr>
          ))}
          <tr style={{ background: C.surface3 }}>
            <Td colSpan={4} className="font-semibold !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>Folha total/mês (a partir de M7)</Td>
            <Td right className="font-semibold !text-[#f87171] !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>R$ 17.155</Td>
          </tr>
        </tbody>
      </DataTable>

      <SectionTitle>Custos físicos e operacionais novos</SectionTitle>
      <DataTable>
        <thead><tr><Th>Item</Th><Th>Descrição</Th><Th right>Custo/mês</Th></tr></thead>
        <tbody>
          {[
            ['Coworking / escritório', 'Espaço compartilhado para 4 pessoas', 'R$ 1.500'],
            ['Equipamentos (notebooks)', '2 notebooks ~R$4k cada · amortizado 24 meses', 'R$ 333'],
            ['Internet + celular corporativo', 'Fibra + linha empresarial', 'R$ 400'],
            ['Jurídico (contratos de trabalho)', 'Revisão ToS, contratos CLT', 'R$ 500'],
          ].map(([item, desc, custo]) => (
            <tr key={String(item)}>
              <Td>{item}</Td><Td className="!text-[#718096]">{desc}</Td>
              <Td right className="!text-[#fbbf24]">{custo}</Td>
            </tr>
          ))}
          <tr style={{ background: C.surface3 }}>
            <Td colSpan={2} className="font-semibold !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>Overhead físico/mês (H2)</Td>
            <Td right className="font-semibold !text-[#f87171] !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>R$ 2.733</Td>
          </tr>
        </tbody>
      </DataTable>

      <SectionTitle>Resultado anual consolidado</SectionTitle>
      <PlBox rows={[
        { label: 'Receita anual total', value: y.revenueBrl, color: '#60a5fa' },
        { label: 'Custos H1 (~R$ 7k/mês × 6, sem equipe)', value: '− R$ 42.000', color: '#f87171' },
        { label: 'Custos H2 (~R$ 20k/mês × 6, com equipe)', value: '− R$ 120.000', color: '#f87171' },
        { label: 'Infra & ferramentas upgrades (anual)', value: '− R$ 28.000', color: '#f87171' },
        { label: 'Simples Nacional estimado (~12%)', value: '− R$ 107.000', color: '#f87171' },
        { label: 'Equipamentos + setup físico', value: '− R$ 10.000', color: '#f87171' },
        { label: 'Lucro líquido estimado', value: y.profitBrl, color: C.green, total: true },
      ]} />

      <Callout variant="warn">
        <strong>⚠️ Ponto de atenção:</strong> a entrada da equipe no M7 comprime a margem — típico em SaaS SMB no Ano 2.
        Com ~{SCENARIO.clientsEoy[1]} clientes a receita absorve a folha, mas o SDR precisa entregar {SCENARIO.newPerMonth[1]} para manter o ritmo do Ano 3.
      </Callout>
    </div>
  )
}

function Year3Panel() {
  const y = yearKpi(2)
  return (
    <div>
      <YearBadge year="Ano 3 · 2028" title="Estruturação & Break-even Confortável" color="#67e8f9" bg="rgba(6,182,212,0.1)" border="rgba(6,182,212,0.2)" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-2.5">
        <KpiCard accent="cyan" label="Clientes ao fim do ano" value={y.clients} sub={y.clientsSub} valueColor="#67e8f9" />
        <KpiCard accent="cyan" label="MRR no mês 36" value={y.mrr} sub="mensalidade + comissão" valueColor="#67e8f9" />
        <KpiCard accent="cyan" label="Receita total no ano" value={y.revenue} sub="acumulado 12 meses" valueColor="#67e8f9" />
        <KpiCard accent="cyan" label="Lucro líquido anual" value={y.profit} sub={`margem ~${y.margin}`} valueColor={C.green} />
      </div>

      <SectionTitle>Equipe — Ano 3 (6 pessoas)</SectionTitle>
      <DataTable>
        <thead><tr><Th>Papel</Th><Th right>Qtd</Th><Th right>Salário base</Th><Th right>Custo real (c/ encargos)</Th></tr></thead>
        <tbody>
          {[
            ['Founders (pró-labore aumentado)', 2, 'R$ 6.000', 'R$ 12.000'],
            ['Dev Backend Pleno', 1, 'R$ 8.000', 'R$ 10.800'],
            ['CS / Suporte', 1, 'R$ 3.000', 'R$ 4.050'],
            ['SDR', 1, 'R$ 3.500', 'R$ 4.725'],
            ['Closer / AE', 1, 'R$ 4.500', 'R$ 6.075'],
          ].map(([papel, qtd, base, real]) => (
            <tr key={String(papel)}>
              <Td>{papel}</Td><Td right>{qtd}</Td><Td right>{base}</Td>
              <Td right className="!text-[#fbbf24]">{real}</Td>
            </tr>
          ))}
          <tr style={{ background: C.surface3 }}>
            <Td colSpan={3} className="font-semibold !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>Folha mensal total</Td>
            <Td right className="font-semibold !text-[#f87171] !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>R$ 37.650</Td>
          </tr>
        </tbody>
      </DataTable>

      <SectionTitle>Infraestrutura & overhead operacional</SectionTitle>
      <DataTable>
        <thead><tr><Th>Categoria</Th><Th>Detalhes</Th><Th right>Custo/mês</Th></tr></thead>
        <tbody>
          {[
            ['Cloud & Infra', 'Vercel Pro, Supabase Pro, CDN, backups', 'R$ 800'],
            ['Serviços SaaS', 'CRM, CS tool, WhatsApp, email, monitoring', 'R$ 1.500'],
            ['Escritório / coworking', '6 pessoas', 'R$ 3.000'],
            ['Equipamentos', '4 notebooks novos ~R$4k · amortizados 24m', 'R$ 667'],
            ['Internet, telefone, misc', 'Fibra, celulares, despesas diversas', 'R$ 700'],
            ['Contabilidade + Jurídico', 'Escritório contábil + revisões contratuais', 'R$ 1.200'],
            [`Gateway Asaas (volume ~${SCENARIO.clientsEoy[2]})`, 'Custos operacionais de pagamento', 'R$ 700'],
          ].map(([cat, det, custo]) => (
            <tr key={String(cat)}>
              <Td>{cat}</Td><Td className="!text-[#718096]">{det}</Td>
              <Td right className="!text-[#fbbf24]">{custo}</Td>
            </tr>
          ))}
          <tr style={{ background: C.surface3 }}>
            <Td colSpan={2} className="font-semibold !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>Overhead mensal</Td>
            <Td right className="font-semibold !text-[#f87171] !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>R$ 8.767</Td>
          </tr>
        </tbody>
      </DataTable>

      <SectionTitle>Resultado anual consolidado</SectionTitle>
      <PlBox rows={[
        { label: 'Receita anual total', value: y.revenueBrl, color: '#60a5fa' },
        { label: 'Folha anual (6 pessoas + encargos)', value: '− R$ 451.800', color: '#f87171' },
        { label: 'Overhead operacional anual', value: '− R$ 95.000', color: '#f87171' },
        { label: 'Simples Nacional / Presumido (~17%)', value: '− R$ 301.000', color: '#f87171' },
        { label: 'Equipamentos + setup físico', value: '− R$ 15.000', color: '#f87171' },
        { label: 'Lucro líquido estimado', value: y.profitBrl, color: C.green, total: true },
      ]} />

      <Callout variant="success">
        <strong>✅ Marco importante:</strong> {SCENARIO.clientsEoy[2]} clientes com time de 6 pessoas valida PMF e retenção.
        Lucro modesto em valor absoluto, mas negócio autossustentável — base para contratar vendas e mirar {SCENARIO.clientsEoy[3]} no Ano 4.
      </Callout>
    </div>
  )
}

function Year4Panel() {
  const y = yearKpi(3)
  return (
    <div>
      <YearBadge year="Ano 4 · 2029" title="Aceleração & Motor de Vendas" color="#fcd34d" bg="rgba(245,158,11,0.1)" border="rgba(245,158,11,0.2)" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-2.5">
        <KpiCard accent="amber" label="Clientes ao fim do ano" value={y.clients} sub={y.clientsSub} valueColor="#fcd34d" />
        <KpiCard accent="amber" label="MRR no mês 48" value={y.mrr} sub="mensalidade + comissão" valueColor="#fcd34d" />
        <KpiCard accent="amber" label="Receita total no ano" value={y.revenue} sub="acumulado 12 meses" valueColor="#fcd34d" />
        <KpiCard accent="amber" label="Lucro líquido anual" value={y.profit} sub={`margem ~${y.margin}`} valueColor={C.green} />
      </div>

      <SectionTitle>Equipe — Ano 4 (~12 pessoas)</SectionTitle>
      <DataTable>
        <thead><tr><Th>Área</Th><Th right>Pessoas</Th><Th right>Custo folha/mês (c/ encargos)</Th></tr></thead>
        <tbody>
          {[
            ['Founders / C-Level', 2, 'R$ 15.000'],
            ['Engenharia (BE + FE)', 3, 'R$ 38.000'],
            [`CS & Suporte (1:~${Math.round(SCENARIO.clientsEoy[3] / 4)} clientes)`, 4, 'R$ 18.000'],
            ['Vendas (2 SDRs + 2 Closers)', 3, 'R$ 24.000'],
          ].map(([area, p, custo]) => (
            <tr key={String(area)}>
              <Td>{area}</Td><Td right>{p}</Td>
              <Td right className="!text-[#fbbf24]">{custo}</Td>
            </tr>
          ))}
          <tr style={{ background: C.surface3 }}>
            <Td colSpan={2} className="font-semibold !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>Folha mensal total</Td>
            <Td right className="font-semibold !text-[#f87171] !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>R$ 95.000</Td>
          </tr>
        </tbody>
      </DataTable>

      <SectionTitle>Infraestrutura & overhead operacional</SectionTitle>
      <DataTable>
        <thead><tr><Th>Categoria</Th><Th right>Custo/mês</Th></tr></thead>
        <tbody>
          {[
            ['Cloud (Vercel, Supabase, Redis, CDN)', 'R$ 4.500'],
            ['Serviços SaaS (CRM, CS, APIs)', 'R$ 3.500'],
            ['Escritório / coworking (~12 pessoas)', 'R$ 6.000'],
            ['Equipamentos (parque amortizado)', 'R$ 2.000'],
            ['Contabilidade, jurídico, compliance', 'R$ 4.500'],
            ['Gateway + antifraude', 'R$ 2.500'],
            ['Marketing / conteúdo orgânico', 'R$ 3.000'],
          ].map(([cat, custo]) => (
            <tr key={String(cat)}>
              <Td>{cat}</Td>
              <Td right className="!text-[#fbbf24]">{custo}</Td>
            </tr>
          ))}
          <tr style={{ background: C.surface3 }}>
            <Td className="font-semibold !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>Overhead mensal</Td>
            <Td right className="font-semibold !text-[#f87171] !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>R$ 26.000</Td>
          </tr>
        </tbody>
      </DataTable>

      <SectionTitle>Resultado anual consolidado</SectionTitle>
      <PlBox rows={[
        { label: 'Receita anual total', value: y.revenueBrl, color: '#60a5fa' },
        { label: 'Folha anual (12 pessoas + encargos)', value: '− R$ 1.140.000', color: '#f87171' },
        { label: 'Overhead operacional anual', value: '− R$ 312.000', color: '#f87171' },
        { label: 'Lucro Presumido / Real (~18%)', value: '− R$ 468.000', color: '#f87171' },
        { label: 'Lucro líquido estimado', value: y.profitBrl, color: C.green, total: true },
      ]} />

      <Callout variant="warn">
        <strong>⚡ Ponto de inflexão:</strong> o salto de {SCENARIO.clientsEoy[2]} → {SCENARIO.clientsEoy[3]} clientes exige {SCENARIO.newPerMonth[3]} líquidos.
        Com 2 SDRs + 2 Closers é factível se o playbook do Ano 3 já estiver documentado — sem isso, adie contratações.
      </Callout>
    </div>
  )
}

function Year5Panel() {
  const y = yearKpi(4)
  return (
    <div>
      <YearBadge year="Ano 5 · 2030" title="Maturidade & ARR ~R$7M" color="#6ee7b7" bg="rgba(16,185,129,0.1)" border="rgba(16,185,129,0.2)" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-2.5">
        <KpiCard accent="green" label="Clientes ao fim do ano" value={y.clients} sub={y.clientsSub} valueColor="#6ee7b7" />
        <KpiCard accent="green" label="MRR no mês 60" value={y.mrr} sub="mensalidade + comissão" valueColor="#6ee7b7" />
        <KpiCard accent="green" label="Receita total no ano" value={y.revenue} sub="acumulado 12 meses" valueColor="#6ee7b7" />
        <KpiCard accent="green" label="Lucro líquido anual" value={y.profit} sub={`margem ~${y.margin}`} valueColor={C.green} />
      </div>

      <SectionTitle>Equipe — Ano 5 (~18 pessoas)</SectionTitle>
      <DataTable>
        <thead><tr><Th>Área</Th><Th right>Pessoas</Th><Th right>Custo folha/mês (c/ encargos)</Th></tr></thead>
        <tbody>
          {[
            ['Founders / C-Level', 2, 'R$ 22.000'],
            ['Engenharia (BE, FE, DevOps, QA)', 6, 'R$ 72.000'],
            [`CS & Suporte (~1:${Math.round(SCENARIO.clientsEoy[4] / 6)} clientes)`, 6, 'R$ 28.000'],
            ['Vendas (SDRs, Closers, RevOps)', 3, 'R$ 30.000'],
            ['Ops, Financeiro, Jurídico', 1, 'R$ 12.000'],
          ].map(([area, p, custo]) => (
            <tr key={String(area)}>
              <Td>{area}</Td><Td right>{p}</Td>
              <Td right className="!text-[#fbbf24]">{custo}</Td>
            </tr>
          ))}
          <tr style={{ background: C.surface3 }}>
            <Td colSpan={2} className="font-semibold !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>Folha mensal (com encargos ~35%)</Td>
            <Td right className="font-semibold !text-[#f87171] !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>R$ 164.000</Td>
          </tr>
        </tbody>
      </DataTable>

      <SectionTitle>Infraestrutura & overhead operacional</SectionTitle>
      <DataTable>
        <thead><tr><Th>Categoria</Th><Th right>Custo/mês</Th></tr></thead>
        <tbody>
          {[
            ['Cloud (compute, DB, storage, CDN)', 'R$ 12.000'],
            ['Serviços SaaS (CRM, CS, analytics)', 'R$ 8.000'],
            ['Escritório (~18 pessoas)', 'R$ 10.000'],
            ['Equipamentos (parque amortizado)', 'R$ 4.000'],
            ['Contabilidade, jurídico, compliance', 'R$ 8.000'],
            ['Gateway Asaas + antifraude', 'R$ 5.000'],
            ['Marketing / conteúdo / eventos', 'R$ 8.000'],
          ].map(([cat, custo]) => (
            <tr key={String(cat)}>
              <Td>{cat}</Td>
              <Td right className="!text-[#fbbf24]">{custo}</Td>
            </tr>
          ))}
          <tr style={{ background: C.surface3 }}>
            <Td className="font-semibold !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>Overhead mensal</Td>
            <Td right className="font-semibold !text-[#f87171] !border-t" style={{ borderTop: `1px solid ${C.border2}` }}>R$ 55.000</Td>
          </tr>
        </tbody>
      </DataTable>

      <SectionTitle>Resultado anual consolidado</SectionTitle>
      <PlBox rows={[
        { label: 'Receita anual total', value: y.revenueBrl, color: '#60a5fa' },
        { label: 'Folha anual (18 pessoas + encargos)', value: '− R$ 1.968.000', color: '#f87171' },
        { label: 'Overhead operacional anual', value: '− R$ 660.000', color: '#f87171' },
        { label: 'Lucro Real / Presumido (~20%)', value: '− R$ 788.000', color: '#f87171' },
        { label: 'Lucro líquido estimado', value: y.profitBrl, color: C.green, total: true },
      ]} />

      <Callout variant="success">
        <strong>🏆 O que {SCENARIO.clientsEoy[4]} clientes significa:</strong> {SCENARIO.mrrEoy[4]} MRR · ARR ~R$ 7M em run-rate.
        Com 18 pessoas e lucro ~R$ 116k/mês, valuation bootstrapped estimado R$ 25–40M (4–6× ARR).
        Empresa rentável, independente, com opção de acelerar ou buscar capital estratégico.
      </Callout>
    </div>
  )
}

function GtmPanel() {
  const [checks, setChecks] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(GTM_CHECKLIST_KEY)
      if (raw) setChecks(JSON.parse(raw) as Record<string, boolean>)
    } catch { /* ignore */ }
  }, [])

  const toggleCheck = useCallback((id: string) => {
    setChecks(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(GTM_CHECKLIST_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const checklistDone = useMemo(
    () => GTM_CHECKLIST_PRE_VENDA.filter(i => checks[i.id]).length,
    [checks],
  )

  return (
    <div>
      <div
        className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider mb-5"
        style={{ background: 'rgba(0,230,118,0.12)', color: '#fdba74', border: '1px solid rgba(0,230,118,0.25)' }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00E676', boxShadow: '0 0 8px #00E676' }} />
        Playbook · 8–10 clientes/mês · 2 founders
      </div>

      <Callout variant="info">
        <strong>Objetivo:</strong> bater {SCENARIO.newPerMonth[0]} após os 5 pilotos sem contratar SDR.
        Isso exige ~{GTM_FUNNEL[0].meta} no topo do funil e implantação em até {GTM_CAPACITY.implantacaoSalao.dias} para o caso simples.
      </Callout>

      <SectionTitle>Funil de vendas — metas mensais</SectionTitle>
      <DataTable>
        <thead>
          <tr>
            <Th>Etapa</Th><Th right>Meta</Th><Th right>Conversão</Th><Th>Obs.</Th>
          </tr>
        </thead>
        <tbody>
          {GTM_FUNNEL.map((row, i) => (
            <tr key={row.etapa} style={i === GTM_FUNNEL.length - 1 ? { background: C.surface3 } : undefined}>
              <Td className={i === GTM_FUNNEL.length - 1 ? 'font-semibold' : undefined}>{row.etapa}</Td>
              <Td right className={i === GTM_FUNNEL.length - 1 ? 'font-semibold !text-[#fdba74]' : '!text-[#60a5fa]'}>{row.meta}</Td>
              <Td right className="!text-[#718096]">{row.conversao ?? '—'}</Td>
              <Td className="!text-[#718096]">{row.obs}</Td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      <SectionTitle>Capacidade de implantação (gargalo real)</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-2.5">
        {[
          { label: 'Salão simples', val: GTM_CAPACITY.implantacaoSalao.dias, sub: GTM_CAPACITY.implantacaoSalao.horas },
          { label: 'Salão + balcão', val: GTM_CAPACITY.implantacaoMisto.dias, sub: GTM_CAPACITY.implantacaoMisto.horas },
          { label: 'Complexo (fila/NF-e)', val: GTM_CAPACITY.implantacaoComplexo.dias, sub: GTM_CAPACITY.implantacaoComplexo.horas },
        ].map(c => (
          <div key={c.label} className="rounded-[10px] p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <p className="text-[9px] uppercase tracking-wider mb-2" style={{ color: C.muted2 }}>{c.label}</p>
            <p className="text-lg font-semibold" style={{ color: '#fdba74' }}>{c.val}</p>
            <p className="text-[10px] mt-1" style={{ color: C.muted2 }}>{c.sub} de trabalho founder</p>
          </div>
        ))}
      </div>
      <Callout variant="warn">
        <strong>Regra de ouro:</strong> {GTM_CAPACITY.paraleloMax}. {GTM_CAPACITY.regra}
        Treinamento no go-live: {GTM_CAPACITY.treinamento}.
      </Callout>

      <SectionTitle>Checklist antes de acelerar vendas ({checklistDone}/{GTM_CHECKLIST_PRE_VENDA.length})</SectionTitle>
      <div className="flex flex-col gap-1.5 mb-2.5">
        {GTM_CHECKLIST_PRE_VENDA.map(item => (
          <label
            key={item.id}
            className="flex items-start gap-3 rounded-md px-3.5 py-2.5 cursor-pointer text-[11px] leading-relaxed"
            style={{ background: C.surface2, border: `1px solid ${checks[item.id] ? 'rgba(16,185,129,0.3)' : C.border}`, color: C.muted2 }}
          >
            <input
              type="checkbox"
              checked={!!checks[item.id]}
              onChange={() => toggleCheck(item.id)}
              className="mt-0.5 accent-[#10b981]"
            />
            <span>
              <strong className="block font-medium mb-0.5" style={{ color: checks[item.id] ? C.green : C.text }}>{item.label}</strong>
              {item.hint}
            </span>
          </label>
        ))}
      </div>

      <SectionTitle>Materiais completos (páginas internas)</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
        {[
          { href: '/materiais-vendas', title: 'Materiais de vendas', desc: 'Pitch deck, scripts WhatsApp, FAQ, proposta, one-pager — com botão copiar' },
          { href: '/materiais-entrega', title: 'Materiais de entrega', desc: 'Kickoff, cardápio, QR, treino garçom/dono, pós go-live — checklists salvos' },
        ].map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="block rounded-[10px] px-4 py-4 transition-opacity hover:opacity-90"
            style={{ background: C.surface2, border: '1px solid rgba(0,230,118,0.25)' }}
          >
            <p className="text-sm font-semibold" style={{ color: '#fdba74' }}>{card.title}</p>
            <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: C.muted2 }}>{card.desc}</p>
            <p className="text-[10px] mt-2 font-mono" style={{ color: C.muted }}>{card.href}</p>
          </Link>
        ))}
      </div>

      {GTM_CANAIS.map(block => (
        <div key={block.title}>
          <SectionTitle>{block.title}</SectionTitle>
          {block.intro && <p className="text-[11px] mb-3 -mt-1" style={{ color: C.muted2 }}>{block.intro}</p>}
          <div className="flex flex-col gap-1.5 mb-2.5">
            {block.items.map(text => (
              <div key={text} className="flex items-start gap-2.5 rounded-md px-3.5 py-2.5 text-[11px] leading-relaxed" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}>
                <span className="shrink-0" style={{ color: '#6ee7b7' }}>→</span>
                {text}
              </div>
            ))}
          </div>
        </div>
      ))}

      <SectionTitle>Rotina semanal dos founders</SectionTitle>
      <DataTable>
        <thead><tr><Th>Quando</Th><Th>Quem</Th><Th>Foco</Th></tr></thead>
        <tbody>
          {GTM_ROTINA.map(row => (
            <tr key={row.dia}>
              <Td className="font-medium">{row.dia}</Td>
              <Td className="!text-[#718096]">{row.founder}</Td>
              <Td>{row.foco}</Td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      <SectionTitle>Quando contratar o primeiro SDR (Ano 2 · M7)</SectionTitle>
      <div className="flex flex-col gap-1.5 mb-2.5">
        {GTM_GATILHOS_SDR.map(text => (
          <div key={text} className="flex items-start gap-2.5 rounded-md px-3.5 py-2.5 text-[11px] leading-relaxed" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: '#c4b5fd' }}>
            <span className="shrink-0">✓</span>
            {text}
          </div>
        ))}
      </div>

      <SectionTitle>Sinais de alerta</SectionTitle>
      <div className="flex flex-col gap-1.5">
        {GTM_SINAIS_ALERTA.map(text => (
          <div key={text} className="flex items-start gap-2.5 rounded-md px-3.5 py-2.5 text-[11px] leading-relaxed" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', color: '#fcd34d' }}>
            <span className="shrink-0">⚠</span>
            {text}
          </div>
        ))}
      </div>
    </div>
  )
}

const PANELS: Record<TabId, () => React.ReactNode> = {
  overview: OverviewPanel,
  gtm: GtmPanel,
  '1': Year1Panel,
  '2': Year2Panel,
  '3': Year3Panel,
  '4': Year4Panel,
  '5': Year5Panel,
}

export function PlanoProjection() {
  const [tab, setTab] = useState<TabId>('overview')
  const Panel = PANELS[tab]

  return (
    <div className="min-h-screen overflow-x-hidden relative" style={{ background: C.bg, color: C.text, ...mono, fontSize: 13 }}>
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 20% 10%, rgba(59,130,246,0.06) 0%, transparent 60%), radial-gradient(ellipse 40% 60% at 80% 80%, rgba(16,185,129,0.05) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 max-w-[1000px] mx-auto px-6 py-10 pb-20">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12 pb-6" style={{ borderBottom: `1px solid ${C.border2}` }}>
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: C.green }}>
              <span className="w-2 h-2 rounded-full" style={{ background: C.green, boxShadow: `0 0 12px ${C.green}` }} />
              KiComanda
            </div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.red }} />
              <span className="text-[10px] uppercase tracking-widest" style={{ color: '#f87171' }}>
                Confidencial · uso interno dos sócios
              </span>
            </div>
          </div>
          <div className="sm:text-right">
            <h1 className="text-xl font-semibold tracking-tight">Projeção Financeira · 5 Anos</h1>
            <p className="text-[11px] mt-1 tracking-wide" style={{ color: C.muted2 }}>
              Meta 8–10 clientes/mês (Ano 1) · Mix 40/40/20 · Churn 2%/mês
            </p>
          </div>
        </header>

        <div className="flex gap-1 mb-8 p-1 rounded-[10px] overflow-x-auto" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="flex-1 min-w-[100px] px-2 py-2.5 rounded-[7px] border-none text-[11px] font-medium uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer"
              style={{
                background: tab === t.id ? undefined : 'transparent',
                color: tab === t.id ? undefined : C.muted2,
                ...(tab === t.id ? tabActiveStyle(t.id) : {}),
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="animate-[fadeIn_0.25s_ease]">
          <Panel />
        </div>

        <footer className="mt-16 pt-5 text-center text-[10px] tracking-wider" style={{ color: C.muted, borderTop: `1px solid ${C.border}` }}>
          KiComanda · Cenário realista 2026–2030 · Meta base: 100→1.050 clientes · 8–10 novos/mês no Ano 1
        </footer>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
