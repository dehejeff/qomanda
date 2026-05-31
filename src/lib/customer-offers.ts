import { amountWithServiceFee, roundMoney } from '@/lib/session-billing'

export type OfferBenefitType = 'discount_pct' | 'discount_fixed' | 'free_item' | 'custom'

export type CustomerOffer = {
  id: string
  restaurant_id: string
  customer_id: string
  benefit_type: OfferBenefitType
  benefit_value: string
  label: string
  status: 'active' | 'redeemed' | 'expired' | 'cancelled'
  expires_at: string | null
  created_at: string
  redeemed_at: string | null
  redeemed_session_id: string | null
  source_rule_id: string | null
}

/** Presets oferecidos no painel. Cada um carrega o tipo estruturado para aplicação. */
export type OfferPreset = {
  id: string
  label: string
  /** Texto usado na mensagem de WhatsApp. */
  offerText: string
  benefitType: OfferBenefitType
  /** Valor estruturado: pct ("10"), R$ fixo ("20") ou descrição/categoria. */
  benefitValue: string
}

export const OFFER_PRESETS: OfferPreset[] = [
  { id: 'discount_10',  label: '10% de desconto', offerText: '10% de desconto na próxima conta', benefitType: 'discount_pct', benefitValue: '10' },
  { id: 'free_drink',   label: 'Bebida grátis',   offerText: 'uma bebida grátis na próxima visita', benefitType: 'free_item', benefitValue: 'bebida' },
  { id: 'free_dessert', label: 'Sobremesa grátis', offerText: 'uma sobremesa da casa grátis', benefitType: 'free_item', benefitValue: 'sobremesa' },
  { id: 'discount_20rs', label: 'R$ 20 de desconto', offerText: 'R$ 20 de desconto na conta', benefitType: 'discount_fixed', benefitValue: '20' },
]

/** Regra de fidelidade (subset) usada para gerar opções de benefício. */
export type LoyaltyRuleInput = {
  id: string
  benefit_type: 'free_drink' | 'free_item' | 'discount_pct' | 'custom'
  benefit_value: string
}

/** Extrai o percentual de um texto livre ("10% de desconto" → 10). */
function extractPercent(text: string): string {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*%?/)
  return match ? match[1].replace(',', '.') : '10'
}

/**
 * Converte uma regra de fidelidade em um rascunho de oferta aplicável.
 * É a ponte entre as regras configuradas em Settings e o desconto no checkout.
 */
export function loyaltyRuleToOfferDraft(rule: LoyaltyRuleInput): {
  id: string
  label: string
  offerText: string
  benefitType: OfferBenefitType
  benefitValue: string
} {
  const label = rule.benefit_value
  switch (rule.benefit_type) {
    case 'discount_pct':
      return { id: rule.id, label, offerText: rule.benefit_value, benefitType: 'discount_pct', benefitValue: extractPercent(rule.benefit_value) }
    case 'free_drink':
      return { id: rule.id, label, offerText: rule.benefit_value, benefitType: 'free_item', benefitValue: 'bebida' }
    case 'free_item':
      return { id: rule.id, label, offerText: rule.benefit_value, benefitType: 'free_item', benefitValue: '' }
    case 'custom':
    default:
      return { id: rule.id, label, offerText: rule.benefit_value, benefitType: 'custom', benefitValue: rule.benefit_value }
  }
}

export const VALIDITY_OPTIONS: { days: number; label: string }[] = [
  { days: 7, label: '7 dias' },
  { days: 15, label: '15 dias' },
  { days: 30, label: '30 dias' },
  { days: 60, label: '60 dias' },
]

export const DEFAULT_VALIDITY_DAYS = 30

export type OfferLineItem = {
  unit_price: number
  quantity: number
  menu_item?: {
    name?: string
    contains_alcohol?: boolean
    category?: { name?: string } | null
  } | null
}

export type OfferDiscount = {
  /** Desconto sobre o subtotal (sem taxa). */
  discountSubtotal: number
  /** Desconto sobre o total (com taxa, se aplicável) — valor abatido do que o cliente paga. */
  discountTotal: number
  /** Item escolhido para 'free_item', se houver. */
  freeItemName?: string
}

/** True se o item bate com a categoria/hint do benefício (bebida, sobremesa, etc). */
function itemMatchesHint(item: OfferLineItem, hint: string): boolean {
  const h = hint.trim().toLowerCase()
  if (!h) return true
  const name = (item.menu_item?.name ?? '').toLowerCase()
  const category = (item.menu_item?.category?.name ?? '').toLowerCase()
  // hints comuns → termos relacionados
  const groups: Record<string, string[]> = {
    bebida: ['bebida', 'drink', 'refri', 'suco', 'cerveja', 'chopp', 'água', 'agua', 'caipi'],
    sobremesa: ['sobremesa', 'doce', 'dessert', 'pudim', 'sorvete', 'torta', 'mousse'],
  }
  const terms = groups[h] ?? [h]
  return terms.some(t => name.includes(t) || category.includes(t))
}

/**
 * Calcula o desconto de uma oferta sobre o saldo em aberto do cliente.
 * Trabalha em termos de subtotal para casar com o crédito de pagamento.
 */
export function computeOfferDiscount(
  benefitType: OfferBenefitType,
  benefitValue: string,
  openSubtotal: number,
  includeServiceFee: boolean,
  unpaidItems: OfferLineItem[] = [],
): OfferDiscount {
  const empty: OfferDiscount = { discountSubtotal: 0, discountTotal: 0 }
  if (openSubtotal <= 0.01) return empty

  const feeMult = includeServiceFee ? 1.1 : 1

  switch (benefitType) {
    case 'discount_pct': {
      const pct = Math.max(0, Math.min(100, parseFloat(benefitValue) || 0))
      const discountSubtotal = roundMoney(Math.min(openSubtotal, openSubtotal * (pct / 100)))
      return {
        discountSubtotal,
        discountTotal: amountWithServiceFee(discountSubtotal, includeServiceFee),
      }
    }

    case 'discount_fixed': {
      const reais = Math.max(0, parseFloat(benefitValue.replace(',', '.')) || 0)
      // valor fixo é abatido do total → converte para subtotal
      const discountSubtotal = roundMoney(Math.min(openSubtotal, reais / feeMult))
      return {
        discountSubtotal,
        discountTotal: amountWithServiceFee(discountSubtotal, includeServiceFee),
      }
    }

    case 'free_item': {
      const candidates = unpaidItems.filter(i => itemMatchesHint(i, benefitValue))
      const pool = candidates.length > 0 ? candidates : unpaidItems
      if (pool.length === 0) return empty
      // um item grátis = a menor unidade elegível
      const cheapest = pool.reduce((min, i) => (i.unit_price < min.unit_price ? i : min), pool[0])
      const discountSubtotal = roundMoney(Math.min(openSubtotal, cheapest.unit_price))
      return {
        discountSubtotal,
        discountTotal: amountWithServiceFee(discountSubtotal, includeServiceFee),
        freeItemName: cheapest.menu_item?.name,
      }
    }

    case 'custom':
    default:
      // benefício livre (ex: "visita bônus") — sem desconto monetário automático
      return empty
  }
}

/** Oferta ainda válida para resgate? */
export function isOfferRedeemable(offer: Pick<CustomerOffer, 'status' | 'expires_at' | 'benefit_type'>): boolean {
  if (offer.status !== 'active') return false
  if (offer.benefit_type === 'custom') return false // não aplica desconto automático
  if (offer.expires_at && new Date(offer.expires_at).getTime() < Date.now()) return false
  return true
}
