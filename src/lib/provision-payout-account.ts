import type { SupabaseClient } from '@supabase/supabase-js'
import { createSubAccount } from '@/lib/asaas'

type RestaurantRow = {
  id: string
  name: string
  legal_name: string | null
  document_number: string | null
  company_type: string | null
  contact_email: string | null
  phone: string | null
  address_street: string | null
  address_number: string | null
  address_neighborhood: string | null
  address_postal_code: string | null
  estimated_monthly_revenue: number | null
  address: string | null
  asaas_wallet_id: string | null
}

export type BankAccountPayload = {
  holderName: string
  document: string
  bankCode: string
  bankName: string
  agency: string
  account: string
  accountDigit: string
  accountType: 'checking' | 'savings'
}

/** Tenta habilitar repasse digital nos bastidores (sem expor provedor ao restaurante). */
export async function provisionDigitalPayoutIfNeeded(
  supabase: SupabaseClient,
  restaurant: RestaurantRow,
  bank: BankAccountPayload,
  ownerEmail: string | null,
): Promise<{ provisioned: boolean; reason?: string }> {
  if (restaurant.asaas_wallet_id) {
    return { provisioned: true }
  }

  const email = restaurant.contact_email ?? ownerEmail
  if (!email) {
    return { provisioned: false, reason: 'missing_email' }
  }

  const phone = (restaurant.phone ?? '').replace(/\D/g, '')
  if (phone.length < 10) {
    return { provisioned: false, reason: 'missing_phone' }
  }

  const street = restaurant.address_street?.trim()
  const number = restaurant.address_number?.trim()
  const neighborhood = restaurant.address_neighborhood?.trim()
  const postalCode = (restaurant.address_postal_code ?? '').replace(/\D/g, '')

  if (!street || !number || !neighborhood || postalCode.length !== 8) {
    const legacy = restaurant.address?.trim()
    if (!legacy || legacy.length < 5) {
      return { provisioned: false, reason: 'missing_address' }
    }
  }

  const cpfCnpj = bank.document || restaurant.document_number
  if (!cpfCnpj) {
    return { provisioned: false, reason: 'missing_document' }
  }

  try {
    const sub = await createSubAccount({
      name: restaurant.legal_name ?? restaurant.name,
      email,
      cpfCnpj,
      mobilePhone: phone,
      incomeValue: Number(restaurant.estimated_monthly_revenue ?? 10_000),
      address: street || restaurant.address!.split(',')[0]?.trim() || restaurant.address!,
      addressNumber: number || 'S/N',
      province: neighborhood || 'Centro',
      postalCode: postalCode || '01310100',
      companyType: (restaurant.company_type as 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION' | undefined) ?? undefined,
      externalReference: restaurant.id,
    })

    await supabase
      .from('restaurants')
      .update({
        asaas_account_id: sub.id,
        asaas_wallet_id: sub.walletId,
        asaas_onboarding_status: 'submitted',
      })
      .eq('id', restaurant.id)

    return { provisioned: true }
  } catch (err) {
    console.error('[Provision payout]', err)
    return { provisioned: false, reason: 'gateway_error' }
  }
}
