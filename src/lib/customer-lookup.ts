import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeWhatsApp, whatsappLookupVariants } from '@/lib/whatsapp-normalize'

export type CustomerRow = {
  id: string
  first_name: string
  last_name: string
  whatsapp: string
}

/**
 * Busca cliente pelo WhatsApp tolerando formatos legados e códigos de país.
 */
export async function findCustomerByWhatsApp(
  supabase: SupabaseClient,
  phone: string,
): Promise<CustomerRow | null> {
  const variants = whatsappLookupVariants(phone)
  if (variants.length === 0) return null

  const { data: rows, error } = await supabase
    .from('customers')
    .select('id, first_name, last_name, whatsapp')
    .in('whatsapp', variants)
    .limit(5)

  if (error) {
    console.error('[findCustomerByWhatsApp]', error.message)
    throw error
  }

  if (!rows?.length) return null

  const { e164 } = normalizeWhatsApp(phone)
  const exact = rows.find(r => r.whatsapp === e164)
  if (exact) return exact as CustomerRow

  return rows[0] as CustomerRow
}

/** Normaliza WhatsApp antes de gravar — sempre com código do país quando possível. */
export function whatsappForStorage(input: string): string {
  return normalizeWhatsApp(input).e164
}
