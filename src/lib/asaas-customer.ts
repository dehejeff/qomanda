import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptCPF } from '@/lib/crypto'
import { upsertCustomer } from '@/lib/asaas'

type CustomerRow = {
  id: string
  first_name: string
  last_name: string
  whatsapp: string
  cpf_encrypted: string | null
  document_type: string | null
  asaas_customer_id: string | null
}

export function buildHolderInfoFromCustomer(customer: CustomerRow) {
  let cpfCnpj = '00000000000'

  if (customer.document_type === 'cpf' && customer.cpf_encrypted) {
    try {
      cpfCnpj = decryptCPF(customer.cpf_encrypted)
    } catch {
      // mantém fallback em dev
    }
  }

  const phone = customer.whatsapp.replace(/\D/g, '')
  const email = phone.length >= 10
    ? `${phone}@cliente.kicomanda.app`
    : `cliente+${customer.id.slice(0, 8)}@kicomanda.app`

  return {
    name: `${customer.first_name} ${customer.last_name}`.trim(),
    email,
    cpfCnpj,
    phone,
    mobilePhone: phone,
  }
}

/**
 * Resolve ou cria o cliente no Asaas e persiste asaas_customer_id.
 */
export async function resolveAsaasCustomerId(
  supabase: SupabaseClient,
  customerId: string,
): Promise<{ asaasCustomerId: string; customer: CustomerRow }> {
  const { data: customer, error } = await supabase
    .from('customers')
    .select('id, first_name, last_name, whatsapp, cpf_encrypted, document_type, asaas_customer_id')
    .eq('id', customerId)
    .single()

  if (error || !customer) {
    throw new Error('Cliente não encontrado.')
  }

  if (customer.asaas_customer_id) {
    return { asaasCustomerId: customer.asaas_customer_id, customer }
  }

  const holder = buildHolderInfoFromCustomer(customer)
  const asaasCustomer = await upsertCustomer({
    name: holder.name || 'Cliente KiComanda',
    cpfCnpj: holder.cpfCnpj,
    mobilePhone: holder.phone,
    externalReference: customer.id,
  })

  await supabase
    .from('customers')
    .update({ asaas_customer_id: asaasCustomer.id })
    .eq('id', customerId)

  return { asaasCustomerId: asaasCustomer.id, customer: { ...customer, asaas_customer_id: asaasCustomer.id } }
}
