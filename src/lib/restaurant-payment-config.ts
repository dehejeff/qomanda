import type { SupabaseClient } from '@supabase/supabase-js'
import { loadRestaurantGateway } from '@/lib/restaurant-gateway'

export type ManualPixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random'

export type ManualPaymentPublic = {
  pixKey: string
  pixKeyType: ManualPixKeyType | null
  holderName: string | null
  notes: string | null
  bankName: string | null
  bankAgency: string | null
  bankAccount: string | null
  bankAccountDigit: string | null
}

export type PublicPaymentConfig = {
  provider: 'manual' | 'asaas' | null
  manualReady: boolean
  asaasReady: boolean
  manual: ManualPaymentPublic | null
  /** Métodos digitais disponíveis no checkout */
  digitalMethods: Array<'pix' | 'debit' | 'credit'>
}

export function isManualPaymentConfigured(row: {
  payment_gateway_provider?: string | null
  manual_pix_key?: string | null
}): boolean {
  return row.payment_gateway_provider === 'manual' && Boolean(row.manual_pix_key?.trim())
}

export async function loadPublicPaymentConfig(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<PublicPaymentConfig> {
  const [gateway, restaurantRes] = await Promise.all([
    loadRestaurantGateway(admin, restaurantId),
    admin
      .from('restaurants')
      .select(`
        payment_gateway_provider,
        manual_pix_key,
        manual_pix_key_type,
        manual_payment_holder_name,
        manual_payment_notes,
        bank_name,
        bank_agency,
        bank_account,
        bank_account_digit
      `)
      .eq('id', restaurantId)
      .single(),
  ])

  const row = restaurantRes.data
  const provider = (row?.payment_gateway_provider as 'manual' | 'asaas' | null) ?? gateway.provider
  const manualReady = isManualPaymentConfigured({
    payment_gateway_provider: provider,
    manual_pix_key: row?.manual_pix_key,
  })
  const asaasReady = gateway.connected && gateway.provider === 'asaas'

  let manual: ManualPaymentPublic | null = null
  if (manualReady && row?.manual_pix_key) {
    manual = {
      pixKey: row.manual_pix_key.trim(),
      pixKeyType: (row.manual_pix_key_type as ManualPixKeyType | null) ?? null,
      holderName: row.manual_payment_holder_name,
      notes: row.manual_payment_notes,
      bankName: row.bank_name,
      bankAgency: row.bank_agency,
      bankAccount: row.bank_account,
      bankAccountDigit: row.bank_account_digit,
    }
  }

  const effectiveProvider = provider ?? (asaasReady ? 'asaas' : manualReady ? 'manual' : null)

  const digitalMethods: PublicPaymentConfig['digitalMethods'] =
    effectiveProvider === 'manual'
      ? manualReady ? ['pix'] : []
      : asaasReady || effectiveProvider === 'asaas'
        ? ['pix', 'debit', 'credit']
        : []

  return {
    provider: effectiveProvider,
    manualReady,
    asaasReady,
    manual,
    digitalMethods,
  }
}

export function manualFieldsToDb(input: {
  pixKey?: string | null
  pixKeyType?: ManualPixKeyType | null
  holderName?: string | null
  notes?: string | null
}) {
  const patch: Record<string, unknown> = {}
  if (input.pixKey !== undefined) {
    const trimmed = input.pixKey?.trim() ?? ''
    patch.manual_pix_key = trimmed || null
    patch.manual_payment_configured_at = trimmed ? new Date().toISOString() : null
  }
  if (input.pixKeyType !== undefined) patch.manual_pix_key_type = input.pixKeyType
  if (input.holderName !== undefined) patch.manual_payment_holder_name = input.holderName?.trim() || null
  if (input.notes !== undefined) patch.manual_payment_notes = input.notes?.trim() || null
  return patch
}

export const MANUAL_PIX_KEY_TYPE_LABELS: Record<ManualPixKeyType, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  phone: 'Telefone',
  random: 'Chave aleatória',
}
