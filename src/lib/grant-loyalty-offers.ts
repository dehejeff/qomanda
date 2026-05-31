import type { SupabaseClient } from '@supabase/supabase-js'
import { loyaltyRuleToOfferDraft, type LoyaltyRuleInput } from '@/lib/customer-offers'

type LoyaltyRuleRow = LoyaltyRuleInput & {
  rule_type: 'visits' | 'spend'
  visit_count: number | null
  min_spend: number | null
}

const GRANT_VALIDITY_DAYS = 60

/**
 * Concede automaticamente as ofertas de fidelidade conquistadas pelo cliente
 * (por nº de visitas OU por valor gasto acumulado) que ainda não foram concedidas.
 *
 * Roda server-side (service role) após um pagamento confirmado. As ofertas
 * concedidas aparecem em "Seus benefícios" no checkout da próxima visita.
 */
export async function grantEarnedLoyaltyOffers(
  supabase: SupabaseClient,
  customerId: string | null,
  restaurantId: string,
): Promise<void> {
  if (!customerId) return

  const { data: rulesData } = await supabase
    .from('loyalty_rules')
    .select('id, rule_type, visit_count, min_spend, benefit_type, benefit_value')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)

  const rules = (rulesData ?? []) as LoyaltyRuleRow[]
  if (rules.length === 0) return

  const [paymentsRes, visitsRes, existingRes] = await Promise.all([
    supabase
      .from('payments')
      .select('amount')
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)
      .eq('status', 'paid')
      .neq('method', 'offer'),
    supabase
      .from('customer_visits')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId),
    supabase
      .from('customer_offers')
      .select('source_rule_id')
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)
      .not('source_rule_id', 'is', null),
  ])

  const totalSpend = (paymentsRes.data ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const visits = visitsRes.count ?? 0
  const grantedRuleIds = new Set((existingRes.data ?? []).map(o => o.source_rule_id as string))

  const earned = rules.filter(rule => {
    if (grantedRuleIds.has(rule.id)) return false // concede só uma vez por regra
    if (rule.rule_type === 'spend') return rule.min_spend != null && totalSpend >= Number(rule.min_spend)
    return rule.visit_count != null && visits >= rule.visit_count
  })

  if (earned.length === 0) return

  const expiresAt = new Date(Date.now() + GRANT_VALIDITY_DAYS * 86_400_000).toISOString()

  const rows = earned.map(rule => {
    const draft = loyaltyRuleToOfferDraft(rule)
    return {
      restaurant_id: restaurantId,
      customer_id: customerId,
      benefit_type: draft.benefitType,
      benefit_value: draft.benefitValue,
      label: draft.label,
      status: 'active',
      expires_at: expiresAt,
      source_rule_id: rule.id,
    }
  })

  const { error } = await supabase.from('customer_offers').insert(rows)
  if (error) console.error('[grantEarnedLoyaltyOffers]', error)
}
