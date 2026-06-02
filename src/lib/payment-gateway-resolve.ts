import type { SupabaseClient } from '@supabase/supabase-js'
import type { AsaasRequestContext } from '@/lib/asaas'
import { loadRestaurantGateway } from '@/lib/restaurant-gateway'
import { computeAsaasSplit } from '@/lib/asaas-split'

export type ResolvedPaymentGateway = {
  gateway: AsaasRequestContext | undefined
  split: ReturnType<typeof computeAsaasSplit>['split']
  usesRestaurantAccount: boolean
}

export async function resolvePaymentGateway(
  admin: SupabaseClient,
  restaurant: {
    id: string
    asaas_wallet_id?: string | null
    platform_fee_percent?: number | null
    platform_fee_fixed?: number | null
    marketplace_split_enabled?: boolean | null
  },
): Promise<ResolvedPaymentGateway> {
  const cfg = await loadRestaurantGateway(admin, restaurant.id)

  let gateway: AsaasRequestContext | undefined
  if (cfg.connected && cfg.apiKey && cfg.provider === 'asaas') {
    gateway = {
      apiKey: cfg.apiKey,
      environment: cfg.environment,
    }
  }

  const splitEnabled = Boolean(restaurant.marketplace_split_enabled)
  const split = splitEnabled
    ? computeAsaasSplit(0, {
        walletId: restaurant.asaas_wallet_id ?? null,
        feePercent: Number(restaurant.platform_fee_percent ?? 0),
        feeFixed: Number(restaurant.platform_fee_fixed ?? 0),
      }).split
    : []

  return {
    gateway,
    split: [], // Recebimento direto: sem split na hora da cobrança
    usesRestaurantAccount: Boolean(gateway),
  }
}
