import type { SupabaseClient } from '@supabase/supabase-js'

export type SavedPaymentMethodRow = {
  id: string
  brand: string | null
  last_four: string
  holder_name: string | null
  is_default: boolean
  credit_card_token: string
}

export type SavedPaymentMethod = {
  id: string
  brand: string | null
  lastFour: string
  holderName: string | null
  isDefault: boolean
}

export function toSavedPaymentMethod(row: SavedPaymentMethodRow): SavedPaymentMethod {
  return {
    id: row.id,
    brand: row.brand,
    lastFour: row.last_four,
    holderName: row.holder_name,
    isDefault: row.is_default,
  }
}

export function formatCardBrand(brand: string | null) {
  if (!brand) return 'Cartão'
  const map: Record<string, string> = {
    VISA: 'Visa',
    MASTERCARD: 'Mastercard',
    ELO: 'Elo',
    AMEX: 'Amex',
    HIPERCARD: 'Hipercard',
  }
  return map[brand.toUpperCase()] ?? brand
}

export async function listPaymentMethods(
  supabase: SupabaseClient,
  customerId: string,
): Promise<SavedPaymentMethod[]> {
  const { data, error } = await supabase
    .from('customer_payment_methods')
    .select('id, brand, last_four, holder_name, is_default, credit_card_token')
    .eq('customer_id', customerId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[PaymentMethods] list failed:', error.message)
    return []
  }

  return (data ?? []).map(toSavedPaymentMethod)
}

export async function savePaymentMethod(
  supabase: SupabaseClient,
  params: {
    customerId: string
    creditCardToken: string
    brand: string | null
    lastFour: string
    holderName: string | null
    setDefault?: boolean
  },
) {
  const { customerId, creditCardToken, brand, lastFour, holderName, setDefault = false } = params

  const { count } = await supabase
    .from('customer_payment_methods')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)

  const makeDefault = setDefault || (count ?? 0) === 0

  if (makeDefault) {
    await supabase
      .from('customer_payment_methods')
      .update({ is_default: false })
      .eq('customer_id', customerId)
  }

  const { data, error } = await supabase
    .from('customer_payment_methods')
    .upsert(
      {
        customer_id: customerId,
        credit_card_token: creditCardToken,
        brand,
        last_four: lastFour,
        holder_name: holderName,
        is_default: makeDefault,
      },
      { onConflict: 'customer_id,credit_card_token' },
    )
    .select('id, brand, last_four, holder_name, is_default, credit_card_token')
    .single()

  if (error) throw error
  return toSavedPaymentMethod(data as SavedPaymentMethodRow)
}

export async function getPaymentMethodToken(
  supabase: SupabaseClient,
  customerId: string,
  paymentMethodId: string,
) {
  const { data, error } = await supabase
    .from('customer_payment_methods')
    .select('credit_card_token')
    .eq('id', paymentMethodId)
    .eq('customer_id', customerId)
    .single()

  if (error || !data) return null
  return data.credit_card_token as string
}

export function clientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? '127.0.0.1'
  return req.headers.get('x-real-ip') ?? '127.0.0.1'
}
