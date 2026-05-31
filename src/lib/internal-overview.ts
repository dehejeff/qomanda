import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchClientList, fetchPlans } from '@/lib/internal-clients'
import type { InternalClientListItem, Plan, SubscriptionStatus } from '@/types/internal'
import { ticketRef } from '@/lib/support-tickets'

export type OverviewStats = {
  total: number
  active: number
  trialing: number
  pastDue: number
  paused: number
  cancelled: number
  payActive: number
  payPending: number
  bankPending: number
  openTickets: number
  newThisMonth: number
  totalTables: number
  /** Mensalidade dos planos (clientes elegíveis — inclui trial) */
  mrrContracted: number
  /** Mensalidade de assinaturas já ativas (cobrança em curso) */
  mrrBilled: number
  arr: number
  /** Volume total pago nas mesas (GMV) — dinheiro do consumidor, não receita Qomanda */
  gmvLast30Days: number
  platformPaymentsLast30Days: number
  /** Estimativa da taxa Qomanda retida no split (tx %) sobre pagamentos digitais */
  txRevenueLast30Days: number
  /** Taxa tx média ponderada pelo volume (30d) */
  avgTxFeePercent: number
  /** Receita Qomanda estimada no período = taxas tx (mensalidade trial ainda não entra) */
  qomandaRevenueLast30Days: number
}

export type OverviewSeriesPoint = { date: string; count: number; label?: string }

export type OverviewDistribution = { id: string; label: string; count: number; value?: number }

export type OverviewAttentionItem = {
  id: string
  name: string
  slug: string
  reason: string
  severity: 'high' | 'medium' | 'low'
  href: string
}

export type OverviewOpenTicket = {
  id: string
  ref: string
  subject: string
  restaurant_name: string | null
  status: string
  last_message_at: string
}

export type InternalOverviewData = {
  stats: OverviewStats
  signupSeries: OverviewSeriesPoint[]
  monthlySignups: OverviewSeriesPoint[]
  planDistribution: OverviewDistribution[]
  subscriptionDistribution: OverviewDistribution[]
  payDistribution: OverviewDistribution[]
  recent: InternalClientListItem[]
  openTickets: OverviewOpenTicket[]
  attention: OverviewAttentionItem[]
}

const SUB_LABEL: Record<SubscriptionStatus, string> = {
  trialing: 'Trial',
  active: 'Ativo',
  past_due: 'Inadimplente',
  paused: 'Pausado',
  cancelled: 'Cancelado',
}

function lastNDays(n: number): string[] {
  const days: string[] = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(cursor)
    d.setDate(d.getDate() - i)
    days.push(d.toLocaleDateString('en-CA'))
  }
  return days
}

function lastNMonths(n: number): { key: string; label: string }[] {
  const months: { key: string; label: string }[] = []
  const cursor = new Date()
  cursor.setDate(1)
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1)
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
    })
  }
  return months
}

function monthKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function resolveClientMonthlyFee(c: InternalClientListItem, plansById: Map<string, Plan>): number {
  if (c.monthly_fee > 0) return c.monthly_fee
  if (c.plan_id) {
    const plan = plansById.get(c.plan_id)
    if (plan) return Number(plan.monthly_fee)
  }
  return 0
}

function isMrrEligible(c: InternalClientListItem) {
  return c.status === 'active'
    && c.subscription_status !== 'cancelled'
    && c.subscription_status !== 'paused'
}

export async function buildInternalOverview(admin: SupabaseClient): Promise<InternalOverviewData> {
  const [clients, plans] = await Promise.all([
    fetchClientList(admin),
    fetchPlans(admin),
  ])
  const plansById = new Map(plans.map(p => [p.id, p]))

  const clientsEnriched = clients.map(c => ({
    ...c,
    monthly_fee: resolveClientMonthlyFee(c, plansById),
    platform_fee_percent: c.platform_fee_percent > 0
      ? c.platform_fee_percent
      : (c.plan_id ? Number(plansById.get(c.plan_id)?.platform_fee_percent ?? 0) : 0),
  }))

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const mrrEligible = clientsEnriched.filter(isMrrEligible)
  const mrrContracted = mrrEligible.reduce((sum, c) => sum + c.monthly_fee, 0)
  const mrrBilled = clientsEnriched
    .filter(c => c.status === 'active' && c.subscription_status === 'active')
    .reduce((sum, c) => sum + c.monthly_fee, 0)

  const feeByRestaurant = new Map(
    clientsEnriched.map(c => [c.id, { percent: c.platform_fee_percent }]),
  )

  const stats: OverviewStats = {
    total: clientsEnriched.length,
    active: clientsEnriched.filter(c => c.subscription_status === 'active').length,
    trialing: clientsEnriched.filter(c => c.subscription_status === 'trialing').length,
    pastDue: clientsEnriched.filter(c => c.subscription_status === 'past_due').length,
    paused: clientsEnriched.filter(c => c.subscription_status === 'paused').length,
    cancelled: clientsEnriched.filter(c => c.subscription_status === 'cancelled').length,
    payActive: clientsEnriched.filter(c => c.digital_status === 'active').length,
    payPending: clientsEnriched.filter(c => c.digital_status === 'pending').length,
    bankPending: clientsEnriched.filter(c => !c.payout_configured).length,
    openTickets: 0,
    newThisMonth: clientsEnriched.filter(c => new Date(c.created_at) >= monthStart).length,
    totalTables: clientsEnriched.reduce((sum, c) => sum + c.tables_count, 0),
    mrrContracted,
    mrrBilled,
    arr: mrrContracted * 12,
    gmvLast30Days: 0,
    platformPaymentsLast30Days: 0,
    txRevenueLast30Days: 0,
    avgTxFeePercent: 0,
    qomandaRevenueLast30Days: 0,
  }

  const signupByDay = new Map<string, number>()
  for (const day of lastNDays(30)) signupByDay.set(day, 0)
  for (const c of clientsEnriched) {
    const day = new Date(c.created_at).toLocaleDateString('en-CA')
    if (signupByDay.has(day)) signupByDay.set(day, (signupByDay.get(day) ?? 0) + 1)
  }
  const signupSeries = lastNDays(30).map(date => ({ date, count: signupByDay.get(date) ?? 0 }))

  const monthBuckets = new Map(lastNMonths(6).map(m => [m.key, 0]))
  for (const c of clientsEnriched) {
    const key = monthKey(c.created_at)
    if (monthBuckets.has(key)) monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + 1)
  }
  const monthlySignups = lastNMonths(6).map(m => ({
    date: m.key,
    label: m.label,
    count: monthBuckets.get(m.key) ?? 0,
  }))

  const planMap = new Map<string, { label: string; count: number; mrr: number }>()
  for (const c of clientsEnriched) {
    const id = c.plan_id ?? 'none'
    const label = c.plan_name ?? 'Sem plano'
    const prev = planMap.get(id) ?? { label, count: 0, mrr: 0 }
    prev.count += 1
    if (mrrEligible.some(e => e.id === c.id)) prev.mrr += c.monthly_fee
    planMap.set(id, prev)
  }
  const planDistribution = [...planMap.entries()]
    .map(([id, v]) => ({ id, label: v.label, count: v.count, value: v.mrr }))
    .sort((a, b) => b.count - a.count)

  const subMap = new Map<string, number>()
  for (const c of clientsEnriched) {
    const id = c.subscription_status ?? 'none'
    subMap.set(id, (subMap.get(id) ?? 0) + 1)
  }
  const subscriptionDistribution = [...subMap.entries()].map(([id, count]) => ({
    id,
    label: id === 'none' ? 'Sem assinatura' : SUB_LABEL[id as SubscriptionStatus] ?? id,
    count,
  }))

  const payMap = {
    active: clientsEnriched.filter(c => c.digital_status === 'active').length,
    pending: clientsEnriched.filter(c => c.digital_status === 'pending').length,
    inactive: clientsEnriched.filter(c => c.digital_status === 'inactive').length,
  }
  const payDistribution: OverviewDistribution[] = [
    { id: 'active', label: 'Pay ativo', count: payMap.active },
    { id: 'pending', label: 'Em análise', count: payMap.pending },
    { id: 'inactive', label: 'Inativo', count: payMap.inactive },
  ]

  const attention: OverviewAttentionItem[] = []
  for (const c of clientsEnriched) {
    if (c.subscription_status === 'past_due') {
      attention.push({
        id: c.id, name: c.name, slug: c.slug, reason: 'Assinatura inadimplente',
        severity: 'high', href: `/internal/clients/${c.id}`,
      })
    } else if (c.digital_status === 'pending') {
      attention.push({
        id: `${c.id}-pay`, name: c.name, slug: c.slug, reason: 'Qomanda Pay em análise',
        severity: 'medium', href: `/internal/clients/${c.id}`,
      })
    } else if (!c.payout_configured && c.status === 'active') {
      attention.push({
        id: `${c.id}-bank`, name: c.name, slug: c.slug, reason: 'Conta bancária pendente',
        severity: 'low', href: `/internal/clients/${c.id}`,
      })
    }
  }

  let openTickets: OverviewOpenTicket[] = []
  try {
    const { data: tickets } = await admin
      .from('support_tickets')
      .select(`
        id, subject, status, last_message_at,
        restaurant:restaurants ( name )
      `)
      .in('status', ['open', 'in_progress'])
      .order('last_message_at', { ascending: false })
      .limit(8)

    openTickets = (tickets ?? []).map(t => ({
      id: t.id,
      ref: ticketRef(t.id),
      subject: t.subject,
      restaurant_name: (t.restaurant as { name?: string } | null)?.name ?? null,
      status: t.status,
      last_message_at: t.last_message_at,
    }))
    stats.openTickets = openTickets.length
  } catch {
    // tabela pode não existir ainda
  }

  try {
    const since = thirtyDaysAgo.toISOString()
    const { data: payments } = await admin
      .from('payments')
      .select('amount, restaurant_id, status, paid_at, method')
      .eq('status', 'paid')
      .gte('paid_at', since)

    const paid = payments ?? []
    let txRevenue = 0
    let gmvDigital = 0

    for (const p of paid) {
      const amount = Number(p.amount)
      stats.gmvLast30Days += amount
      const feeCfg = feeByRestaurant.get(p.restaurant_id)
      if (!feeCfg) continue
      // Taxa tx incide sobre pagamentos digitais (PIX/cartão), não dinheiro
      if (p.method === 'cash' || p.method === 'offer') continue
      gmvDigital += amount
      txRevenue += amount * (feeCfg.percent / 100)
    }

    stats.platformPaymentsLast30Days = paid.length
    stats.txRevenueLast30Days = Math.round(txRevenue * 100) / 100
    stats.avgTxFeePercent = gmvDigital > 0
      ? Math.round((txRevenue / gmvDigital) * 10000) / 100
      : (clientsEnriched[0]?.platform_fee_percent ?? 0)
    stats.qomandaRevenueLast30Days = stats.txRevenueLast30Days
  } catch {
    // ok
  }

  return {
    stats,
    signupSeries,
    monthlySignups,
    planDistribution,
    subscriptionDistribution,
    payDistribution,
    recent: clientsEnriched.slice(0, 6),
    openTickets,
    attention: attention.slice(0, 8),
  }
}
