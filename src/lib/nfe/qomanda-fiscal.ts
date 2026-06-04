import type { NfeEnvironment } from '@/lib/nfe/types'

/**
 * Configuração fiscal da própria Qomanda (prestadora da NF-e de serviço).
 * Diferente da config por restaurante (que emite ao consumidor): aqui a Qomanda
 * é a EMITENTE e o restaurante é o TOMADOR.
 *
 * Sem token do provedor, a emissão roda em modo simulado (testável ponta a ponta).
 */
export type QomandaFiscalConfig = {
  provider: string
  token: string | null
  environment: NfeEnvironment
  cnpj: string | null
  cnae: string | null
  legalName: string
  serviceDescription: string
  hasCredentials: boolean
}

export function getQomandaFiscalConfig(): QomandaFiscalConfig {
  const token = (process.env.QOMANDA_NFE_TOKEN ?? '').trim() || null
  const cnpj = (process.env.QOMANDA_CNPJ ?? '').replace(/\D/g, '') || null
  const provider = (process.env.QOMANDA_NFE_PROVIDER ?? 'focusnfe').trim()
  const environment: NfeEnvironment =
    (process.env.QOMANDA_NFE_ENVIRONMENT ?? '').trim() === 'producao' ? 'producao' : 'homologacao'

  return {
    provider,
    token,
    environment,
    cnpj,
    cnae: (process.env.QOMANDA_NFE_CNAE ?? '').trim() || null,
    legalName: (process.env.QOMANDA_LEGAL_NAME ?? '').trim() || 'Qomanda Tecnologia',
    serviceDescription:
      (process.env.QOMANDA_NFE_SERVICE_DESCRIPTION ?? '').trim() ||
      'Assinatura e taxas da plataforma Qomanda',
    // Credenciais completas exigem token + CNPJ do prestador.
    hasCredentials: Boolean(token && cnpj && provider === 'focusnfe'),
  }
}
