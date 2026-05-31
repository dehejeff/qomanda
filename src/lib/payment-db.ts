import type { SupabaseClient } from '@supabase/supabase-js'

export function normalizePaymentAmount(amount: unknown): number | null {
  const value = Math.round(Number(amount) * 100) / 100
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

/** Garante customer_id válido no FK; retorna null se não existir. */
export async function resolvePaymentCustomerId(
  supabase: SupabaseClient,
  customerId: string | null | undefined,
): Promise<string | null> {
  if (!customerId) return null
  const { data } = await supabase.from('customers').select('id').eq('id', customerId).maybeSingle()
  return data?.id ?? null
}

export function paymentInsertErrorMessage(error: { message?: string; code?: string } | null) {
  if (!error?.message) return 'Erro ao registrar pagamento.'
  if (error.message.includes('amount')) {
    return 'Valor do pagamento inválido (deve ser maior que zero).'
  }
  if (error.code === '23503') {
    return 'Cliente não encontrado. Faça check-in novamente e tente outra vez.'
  }
  if (error.message.includes('split_type') || error.message.includes('customer_id') || error.message.includes('asaas_payment_id')) {
    return 'Banco desatualizado: rode supabase/migrate-payments-asaas.sql no SQL Editor do Supabase.'
  }
  return `Erro ao registrar pagamento: ${error.message}`
}
