import { getAsaasConfig } from '@/lib/asaas-config'

/**
 * Quando ativo, pagamentos são confirmados localmente sem chamar o gateway.
 * Configurável no portal interno ou via PAYMENT_BYPASS / ausência de API key.
 */
export async function isPaymentBypassEnabled() {
  const config = await getAsaasConfig()
  if (config.paymentBypass) return true
  return !config.apiKey
}
