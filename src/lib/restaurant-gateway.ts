import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptSecret, encryptSecret, maskSecret } from '@/lib/secret-crypto'

export type PaymentGatewayProvider = 'manual' | 'asaas' | 'mercado_pago'

export type ManualPixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random'

export type RestaurantGatewayConfig = {
  provider: PaymentGatewayProvider | null
  environment: 'sandbox' | 'production'
  connected: boolean
  apiKeyMasked: string | null
  connectedAt: string | null
  marketplaceSplitEnabled: boolean
  manualPixKey: string | null
  manualPixKeyType: ManualPixKeyType | null
  manualPaymentHolderName: string | null
  manualPaymentNotes: string | null
  manualConfigured: boolean
  mpConnectedVia: 'oauth' | 'manual' | null
  mpUserId: string | null
  mpPublicKey: string | null
}

export async function loadRestaurantGateway(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantGatewayConfig & { apiKey: string | null }> {
  const { data } = await admin
    .from('restaurants')
    .select(`
      payment_gateway_provider,
      payment_gateway_api_key_encrypted,
      payment_gateway_environment,
      payment_gateway_connected_at,
      marketplace_split_enabled,
      manual_pix_key,
      manual_pix_key_type,
      manual_payment_holder_name,
      manual_payment_notes,
      manual_payment_configured_at,
      mp_connected_via,
      mp_user_id,
      mp_public_key
    `)
    .eq('id', restaurantId)
    .single()

  if (!data) {
    return {
      provider: null,
      environment: 'sandbox',
      connected: false,
      apiKeyMasked: null,
      connectedAt: null,
      marketplaceSplitEnabled: false,
      manualPixKey: null,
      manualPixKeyType: null,
      manualPaymentHolderName: null,
      manualPaymentNotes: null,
      manualConfigured: false,
      mpConnectedVia: null,
      mpUserId: null,
      mpPublicKey: null,
      apiKey: null,
    }
  }

  let apiKey: string | null = null
  if (data.payment_gateway_api_key_encrypted) {
    try {
      apiKey = decryptSecret(data.payment_gateway_api_key_encrypted)
    } catch {
      apiKey = null
    }
  }

  return {
    provider: (data.payment_gateway_provider as PaymentGatewayProvider | null) ?? null,
    environment: (data.payment_gateway_environment as 'sandbox' | 'production') ?? 'sandbox',
    connected: Boolean(data.payment_gateway_connected_at && apiKey),
    apiKeyMasked: apiKey ? maskSecret(apiKey) : null,
    connectedAt: data.payment_gateway_connected_at,
    marketplaceSplitEnabled: Boolean(data.marketplace_split_enabled),
    manualPixKey: data.manual_pix_key,
    manualPixKeyType: (data.manual_pix_key_type as ManualPixKeyType | null) ?? null,
    manualPaymentHolderName: data.manual_payment_holder_name,
    manualPaymentNotes: data.manual_payment_notes,
    manualConfigured: Boolean(data.manual_pix_key?.trim()),
    mpConnectedVia: (data.mp_connected_via as 'oauth' | 'manual' | null) ?? null,
    mpUserId: data.mp_user_id ?? null,
    mpPublicKey: data.mp_public_key ?? null,
    apiKey,
  }
}

/** Campos a limpar ao desconectar o Mercado Pago. */
export function mercadoPagoDisconnectPatch(): Record<string, unknown> {
  return {
    payment_gateway_api_key_encrypted: null,
    payment_gateway_connected_at: null,
    mp_refresh_token_encrypted: null,
    mp_public_key: null,
    mp_user_id: null,
    mp_token_expires_at: null,
    mp_connected_via: null,
  }
}

export function gatewayFieldsToDb(input: {
  provider?: PaymentGatewayProvider | null
  apiKey?: string | null
  environment?: 'sandbox' | 'production'
  existingEncrypted?: string | null
}) {
  const patch: Record<string, unknown> = {}
  if (input.provider !== undefined) {
    patch.payment_gateway_provider = input.provider
  }
  if (input.environment) {
    patch.payment_gateway_environment = input.environment
  }
  if (input.apiKey?.trim()) {
    patch.payment_gateway_api_key_encrypted = encryptSecret(input.apiKey.trim())
    patch.payment_gateway_connected_at = new Date().toISOString()
  } else if (input.apiKey === null) {
    patch.payment_gateway_api_key_encrypted = null
    patch.payment_gateway_connected_at = null
  }
  return patch
}
