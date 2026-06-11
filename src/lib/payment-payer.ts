import type { SupabaseClient } from '@supabase/supabase-js'
import { buildHolderInfoFromCustomer } from '@/lib/asaas-customer'

/** E-mail do pagador exigido pela API Mercado Pago. */
export async function resolvePayerEmail(
  supabase: SupabaseClient,
  customerId: string | null | undefined,
): Promise<string> {
  if (!customerId) return 'cliente@kicomanda.app'

  const { data: customer } = await supabase
    .from('customers')
    .select('id, first_name, last_name, whatsapp, cpf_encrypted, document_type, asaas_customer_id')
    .eq('id', customerId)
    .maybeSingle()

  if (!customer) return 'cliente@kicomanda.app'
  return buildHolderInfoFromCustomer(customer).email
}
