/**
 * Stripe foi substituído pelo Asaas como gateway de pagamento.
 * Este arquivo está mantido apenas para compatibilidade com imports existentes.
 * @deprecated Use src/lib/asaas.ts
 */

export function getStripe() {
  throw new Error('Stripe foi substituído pelo Asaas. Use /api/asaas/payments.')
}

export const formatAmountForStripe = (amount: number): number => Math.round(amount * 100)
export const formatAmountFromStripe = (amount: number): number => amount / 100
