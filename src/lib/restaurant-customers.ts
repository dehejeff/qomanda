import type { LoyaltyRule } from '@/types'

export type RestaurantCustomerStats = {
  id: string
  firstName: string
  lastName: string
  whatsapp: string
  visitCount: number
  lastVisitAt: string
  daysSinceLastVisit: number
  visitsUntilNextReward: number | null
  nextRewardLabel: string | null
  segment: 'new' | 'regular' | 'loyal' | 'at_risk'
}

type VisitRow = {
  customer_id: string
  created_at: string
  customers: {
    id: string
    first_name: string
    last_name: string
    whatsapp: string
  } | {
    id: string
    first_name: string
    last_name: string
    whatsapp: string
  }[] | null
}

function unwrapCustomer(raw: VisitRow['customers']): {
  id: string
  first_name: string
  last_name: string
  whatsapp: string
} | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    const customer = raw[0]
    if (!customer) return null
    if (customer.id && customer.first_name && customer.whatsapp) return customer
    return null
  }
  if (raw.id && raw.first_name && raw.whatsapp) return raw
  return null
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function classifySegment(visitCount: number, daysSinceLastVisit: number): RestaurantCustomerStats['segment'] {
  if (daysSinceLastVisit >= 30) return 'at_risk'
  if (visitCount >= 8) return 'loyal'
  if (visitCount === 1) return 'new'
  return 'regular'
}

function nextRewardFor(
  visitCount: number,
  rules: Pick<LoyaltyRule, 'visit_count' | 'benefit_value' | 'active'>[],
): { visitsUntil: number; label: string } | null {
  const active = rules.filter(r => r.active).sort((a, b) => a.visit_count - b.visit_count)
  const upcoming = active.find(r => r.visit_count > visitCount)
  if (upcoming) {
    return { visitsUntil: upcoming.visit_count - visitCount, label: upcoming.benefit_value }
  }
  const earned = [...active].reverse().find(r => visitCount >= r.visit_count)
  if (earned) return { visitsUntil: 0, label: earned.benefit_value }
  return null
}

export function aggregateRestaurantCustomers(
  visits: VisitRow[],
  loyaltyRules: Pick<LoyaltyRule, 'visit_count' | 'benefit_value' | 'active'>[] = [],
): RestaurantCustomerStats[] {
  const byCustomer = new Map<string, { customer: NonNullable<ReturnType<typeof unwrapCustomer>>; dates: string[] }>()

  for (const row of visits) {
    const customer = unwrapCustomer(row.customers)
    if (!customer) continue

    // Ensure customer_id matches the customer.id from the relation
    if (customer.id !== row.customer_id) continue

    const entry = byCustomer.get(row.customer_id) ?? { customer, dates: [] }
    entry.dates.push(row.created_at)
    byCustomer.set(row.customer_id, entry)
  }

  const stats: RestaurantCustomerStats[] = []

  for (const [, { customer, dates }] of byCustomer) {
    dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    const lastVisitAt = dates[0]
    const visitCount = dates.length
    const daysSinceLastVisit = daysSince(lastVisitAt)
    const reward = nextRewardFor(visitCount, loyaltyRules)

    stats.push({
      id: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      whatsapp: customer.whatsapp,
      visitCount,
      lastVisitAt,
      daysSinceLastVisit,
      visitsUntilNextReward: reward?.visitsUntil ?? null,
      nextRewardLabel: reward?.label ?? null,
      segment: classifySegment(visitCount, daysSinceLastVisit),
    })
  }

  return stats.sort((a, b) => {
    if (a.segment === 'at_risk' && b.segment !== 'at_risk') return -1
    if (b.segment === 'at_risk' && a.segment !== 'at_risk') return 1
    return new Date(b.lastVisitAt).getTime() - new Date(a.lastVisitAt).getTime()
  })
}

export function maskWhatsApp(whatsapp: string): string {
  const d = whatsapp.replace(/\D/g, '')
  if (d.length <= 4) return d
  return `***${d.slice(-4)}`
}

export function whatsAppLink(whatsapp: string, message: string): string {
  const phone = whatsapp.replace(/\D/g, '')
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

export function buildWinBackMessage(
  customer: Pick<RestaurantCustomerStats, 'firstName' | 'daysSinceLastVisit' | 'visitCount'>,
  restaurantName: string,
  offer: string,
): string {
  const name = customer.firstName.trim() || 'cliente'
  return (
    `Olá, ${name}! 👋\n\n` +
    `Aqui é do ${restaurantName}. Sentimos sua falta` +
    (customer.daysSinceLastVisit > 0 ? ` — faz ${customer.daysSinceLastVisit} dia(s) da sua última visita` : '') +
    `!\n\n` +
    `Você já nos visitou ${customer.visitCount} vez${customer.visitCount !== 1 ? 'es' : ''}. ` +
    `Preparamos algo especial: ${offer}\n\n` +
    `Esperamos você em breve! 🍽️`
  )
}

export const OFFER_PRESETS = [
  { id: 'discount_10', label: '10% de desconto', offer: '10% de desconto na próxima conta' },
  { id: 'free_drink', label: 'Bebida grátis', offer: 'uma bebida grátis na próxima visita' },
  { id: 'free_dessert', label: 'Sobremesa grátis', offer: 'sobremesa da casa grátis' },
  { id: 'loyalty_bonus', label: 'Visita bônus', offer: 'contamos +1 visita no programa de fidelidade na próxima ida' },
] as const
