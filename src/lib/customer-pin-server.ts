import type { SupabaseClient } from '@supabase/supabase-js'

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
