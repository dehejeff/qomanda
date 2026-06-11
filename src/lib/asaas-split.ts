/**
 * Cálculo do split do marketplace Asaas.
 *
 * A KiComanda (conta master) cria a cobrança e envia a parte do restaurante
 * para a subconta dele (walletId). A taxa da KiComanda = total − parte do
 * restaurante, e fica na conta master (não entra no array de split).
 *
 * Taxa por restaurante (plano): percentual + valor fixo.
 */

export type RestaurantFeeConfig = {
  walletId: string | null
  feePercent: number // ex: 3 = 3%
  feeFixed: number   // ex: 0.5 = R$0,50
}

export type AsaasSplitEntry = {
  walletId: string
  fixedValue: number
}

export type SplitResult = {
  /** Valor líquido enviado ao restaurante (fixedValue do split). */
  restaurantNet: number
  /** Taxa retida pela KiComanda (fica na conta master). */
  platformFee: number
  /** Array pronto para o campo `split` da cobrança Asaas (vazio se não aplicável). */
  split: AsaasSplitEntry[]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Calcula o split de uma cobrança de `total` reais para um restaurante.
 * Se não houver walletId, retorna split vazio (cobrança sem repasse — fallback).
 */
export function computeAsaasSplit(total: number, fee: RestaurantFeeConfig): SplitResult {
  const amount = round2(total)

  if (!fee.walletId || amount <= 0) {
    return { restaurantNet: 0, platformFee: amount > 0 ? amount : 0, split: [] }
  }

  const pct = Math.max(0, Math.min(100, Number(fee.feePercent) || 0))
  const fixed = Math.max(0, Number(fee.feeFixed) || 0)

  let platformFee = round2(amount * (pct / 100) + fixed)
  // A taxa nunca pode exceder o total (deixa ao menos 0 para o restaurante).
  if (platformFee > amount) platformFee = amount

  const restaurantNet = round2(amount - platformFee)

  // Split de valor 0 não é aceito; nesse caso não há repasse.
  if (restaurantNet <= 0) {
    return { restaurantNet: 0, platformFee: amount, split: [] }
  }

  return {
    restaurantNet,
    platformFee,
    split: [{ walletId: fee.walletId, fixedValue: restaurantNet }],
  }
}
