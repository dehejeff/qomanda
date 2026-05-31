/**
 * Quando ativo, pagamentos são confirmados localmente sem chamar o Asaas.
 * Ativa com PAYMENT_BYPASS=true ou quando ASAAS_API_KEY não está configurada.
 */
export function isPaymentBypassEnabled() {
  if (process.env.PAYMENT_BYPASS === 'true') return true
  if (process.env.PAYMENT_BYPASS === 'false') return false
  return !process.env.ASAAS_API_KEY
}
