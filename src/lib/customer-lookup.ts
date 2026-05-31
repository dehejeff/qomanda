import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeBrazilWhatsApp, whatsappLookupVariants } from '@/lib/whatsapp-normalize'

export type CustomerRow = {
  id: string
  first_name: string
  last_name: string
  whatsapp: string
  pin_hash?: string | null
}

/**
 * Busca cliente pelo WhatsApp tolerando 55, 9º dígito e formatos legados.
 */
export async function findCustomerByWhatsApp(
  supabase: SupabaseClient,
  phone: string,
): Promise<CustomerRow | null> {
  const variants = whatsappLookupVariants(phone)
  if (variants.length === 0) return null

  const { data: rows } = await supabase
    .from('customers')
    .select('id, first_name, last_name, whatsapp, pin_hash')
    .in('whatsapp', variants)
    .limit(5)

  if (!rows?.length) return null

  const canonical = normalizeBrazilWhatsApp(phone)
  const exact = rows.find(r => r.whatsapp === canonical)
  if (exact) return exact as CustomerRow

  return rows[0] as CustomerRow
}

/** Normaliza WhatsApp antes de gravar (cadastro / check-in). */
export function whatsappForStorage(input: string): string {
  return normalizeBrazilWhatsApp(input)
}
