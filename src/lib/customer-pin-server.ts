import type { SupabaseClient } from '@supabase/supabase-js'
import { listPaymentMethods } from '@/lib/payment-methods'

/** pin_hash ainda não migrado no Supabase de produção. */
export function isPinColumnMissing(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = error.message?.toLowerCase() ?? ''
  return error.code === '42703' || msg.includes('pin_hash') && msg.includes('does not exist')
}

export async function getCustomerPinHash(
  supabase: SupabaseClient,
  customerId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('pin_hash')
    .eq('id', customerId)
    .maybeSingle()

  if (error) {
    if (isPinColumnMissing(error)) return null
    throw error
  }

  return data?.pin_hash ?? null
}

export async function customerHasPin(
  supabase: SupabaseClient,
  customerId: string,
): Promise<boolean> {
  const hash = await getCustomerPinHash(supabase, customerId)
  return Boolean(hash)
}

export async function customerHasSavedCards(
  supabase: SupabaseClient,
  customerId: string,
): Promise<boolean> {
  const methods = await listPaymentMethods(supabase, customerId)
  return methods.length > 0
}

/** 6 dígitos se tem cartão; 4 se só tem PIN de login; null se sem PIN. */
export async function requiredLoginPinLength(
  supabase: SupabaseClient,
  customerId: string,
): Promise<4 | 6 | null> {
  if (await customerHasSavedCards(supabase, customerId)) return 6
  if (await customerHasPin(supabase, customerId)) return 4
  return null
}
