/**
 * Comissão Qomanda sobre GMV digital (faturada mensalmente — recebimento direto na conta do restaurante).
 * Faixas progressivas + desconto por plano (Growth −0,20 p.p. · Pro −0,40 p.p.).
 */

export type CommissionTier = {
  maxGmv: number | null
  ratePercent: number
}

/** Faixas globais (percentual sobre GMV digital do mês). */
export const COMMISSION_TIERS: CommissionTier[] = [
  { maxGmv: 15_000, ratePercent: 2.99 },
  { maxGmv: 40_000, ratePercent: 2.49 },
  { maxGmv: 100_000, ratePercent: 1.99 },
  { maxGmv: null, ratePercent: 1.49 },
]

export const SETUP_FEE_PILOT = 1990

export const PLAN_COMMISSION_DISCOUNT: Record<string, number> = {
  starter: 0,
  growth: 0.2,
  pro: 0.4,
  enterprise: 0.6,
}

export function isCommissionExemptMethod(method: string | null | undefined): boolean {
  return method === 'cash' || method === 'offer'
}

/** Taxa efetiva no momento do pagamento (snapshot para auditoria). */
export function effectiveCommissionRatePercent(
  planId: string | null | undefined,
  gmvDigitalMonthToDate: number,
): number {
  const base = tierRateForGmv(gmvDigitalMonthToDate)
  const discount = planId ? (PLAN_COMMISSION_DISCOUNT[planId] ?? 0) : 0
  return Math.max(0, Math.round((base - discount) * 100) / 100)
}

export function tierRateForGmv(gmv: number): number {
  for (const tier of COMMISSION_TIERS) {
    if (tier.maxGmv === null || gmv <= tier.maxGmv) return tier.ratePercent
  }
  return COMMISSION_TIERS[COMMISSION_TIERS.length - 1]!.ratePercent
}

export function commissionOnPayment(
  amount: number,
  planId: string | null | undefined,
  gmvDigitalMonthToDate: number,
): { ratePercent: number; commissionAmount: number } {
  const ratePercent = effectiveCommissionRatePercent(planId, gmvDigitalMonthToDate)
  const commissionAmount = Math.round(amount * (ratePercent / 100) * 100) / 100
  return { ratePercent, commissionAmount }
}

/** Comissão total do mês com faixas progressivas (marginal). */
export function commissionForMonthlyGmv(
  gmvDigital: number,
  planDiscountPercent = 0,
): number {
  if (gmvDigital <= 0) return 0

  let remaining = gmvDigital
  let prevCap = 0
  let total = 0

  for (const tier of COMMISSION_TIERS) {
    const cap = tier.maxGmv ?? Infinity
    const slice = Math.min(remaining, cap - prevCap)
    if (slice <= 0) break
    const rate = Math.max(0, tier.ratePercent - planDiscountPercent)
    total += slice * (rate / 100)
    remaining -= slice
    prevCap = cap
    if (remaining <= 0) break
  }

  return Math.round(total * 100) / 100
}

export type MonthlyInvoicePreview = {
  periodYear: number
  periodMonth: number
  monthlyFee: number
  gmvDigital: number
  commissionTotal: number
  totalDue: number
  effectiveAvgRate: number
}

export function buildMonthlyInvoicePreview(
  monthlyFee: number,
  gmvDigital: number,
  planId: string | null | undefined,
): MonthlyInvoicePreview {
  const discount = planId ? (PLAN_COMMISSION_DISCOUNT[planId] ?? 0) : 0
  const commissionTotal = commissionForMonthlyGmv(gmvDigital, discount)
  const totalDue = Math.round((monthlyFee + commissionTotal) * 100) / 100
  const effectiveAvgRate = gmvDigital > 0
    ? Math.round((commissionTotal / gmvDigital) * 10000) / 100
    : 0

  return {
    periodYear: 0,
    periodMonth: 0,
    monthlyFee,
    gmvDigital,
    commissionTotal,
    totalDue,
    effectiveAvgRate,
  }
}
