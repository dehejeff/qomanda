/**
 * Cenário realista — meta operacional KiComanda.
 * Ano 1: 8–10 clientes/mês após piloto (founders em vendas ativa).
 * ARPU ~R$ 550/mês (mensalidade + comissão).
 */

export const MARKET_BENCHMARK =
  'Meta Ano 1: 8–10 novos clientes/mês após os 5 pilotos (ritmo exigente, factível com outbound + indicação). ' +
  'Anos 2–5 mantêm o mesmo múltiplo de crescimento do plano anterior, escalados a partir de 100 clientes no Ano 1.'

const ARPU_MONTHLY = 550

export const SCENARIO = {
  clientsEoy: [100, 215, 385, 650, 1050] as const,
  revenueK: [390, 890, 1770, 2600, 3940] as const,
  costK: [71, 430, 850, 1200, 1800] as const,
  profitK: [275, 230, 460, 820, 1390] as const,
  marginPct: ['70%', '26%', '26%', '32%', '35%'] as const,
  team: ['2 founders', '4 pessoas', '6 pessoas', '12 pessoas', '18 pessoas'] as const,
  mrrEoy: ['R$ 55k', 'R$ 118k', 'R$ 212k', 'R$ 358k', 'R$ 578k'] as const,
  newPerMonth: ['8–10/mês', '~10/mês', '~14/mês', '~22/mês', '~33/mês'] as const,
  yoyClientPct: ['', '+115%', '+79%', '+69%', '+62%'] as const,
  years: ['2026 · Ano 1', '2027 · Ano 2', '2028 · Ano 3', '2029 · Ano 4', '2030 · Ano 5'] as const,
  yearColors: ['#93c5fd', '#c4b5fd', '#67e8f9', '#fcd34d', '#6ee7b7'] as const,
} as const

export const ACCUMULATED = {
  revenue: 'R$ 9,6M',
  cost: 'R$ 4,4M',
  profit: 'R$ 3,2M',
  margin: '~33%',
} as const

const MRR_SUB_SHARE = 0.836

/** Ramp: piloto M1–M2, depois ~9 clientes líquidos/mês até 100 no M12 */
export const YEAR1_MONTHLY = [
  { mes: 'M1', ativos: 10, total: 10 * ARPU_MONTHLY, saldo: 10 * ARPU_MONTHLY - 5_935 },
  { mes: 'M2', ativos: 18, total: 18 * ARPU_MONTHLY, saldo: 18 * ARPU_MONTHLY - 5_935 },
  { mes: 'M3', ativos: 28, total: 28 * ARPU_MONTHLY, saldo: 28 * ARPU_MONTHLY - 5_935 },
  { mes: 'M4', ativos: 38, total: 38 * ARPU_MONTHLY, saldo: 38 * ARPU_MONTHLY - 5_935 },
  { mes: 'M6', ativos: 58, total: 58 * ARPU_MONTHLY, saldo: 58 * ARPU_MONTHLY - 5_935 },
  { mes: 'M9', ativos: 82, total: 82 * ARPU_MONTHLY, saldo: 82 * ARPU_MONTHLY - 5_935 },
  { mes: 'M12', ativos: 100, total: 100 * ARPU_MONTHLY, saldo: 100 * ARPU_MONTHLY - 5_935 },
] as const

export function monthlySplit(total: number) {
  const sub = Math.round(total * MRR_SUB_SHARE)
  return { sub, com: total - sub }
}

export function fmtBrl(n: number): string {
  return `R$ ${n.toLocaleString('pt-BR')}`
}

export function fmtK(n: number): string {
  if (n >= 1000) {
    const m = n / 1000
    const dec = Number.isInteger(m) ? 0 : 2
    return `R$ ${m.toFixed(dec).replace('.', ',')}M`
  }
  return `R$ ${n}k`
}

export function fmtClients(n: number): string {
  return n.toLocaleString('pt-BR')
}

export const YEAR1_COST_MONTHLY = 5_935
export const YEAR1_COST_ANNUAL = 71_220
export const YEAR1_REVENUE_ANNUAL = 392_000
export const YEAR1_PROFIT_ANNUAL = 275_000
