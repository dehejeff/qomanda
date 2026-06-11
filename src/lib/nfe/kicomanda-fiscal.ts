import type { NfeEnvironment } from '@/lib/nfe/types'
import { readEnv } from '@/lib/kicomanda-env'

/**
 * Configuração fiscal da KiComanda (prestadora da NF-e de serviço).
 * Env: KICOMANDA_NFE_* (fallback legado QOMANDA_NFE_*).
 */
export type KiComandaFiscalConfig = {
  provider: string
  token: string | null
  environment: NfeEnvironment
  cnpj: string | null
  cnae: string | null
  legalName: string
  serviceDescription: string
  hasCredentials: boolean
}

export function getKiComandaFiscalConfig(): KiComandaFiscalConfig {
  const token = readEnv('KICOMANDA_NFE_TOKEN', 'QOMANDA_NFE_TOKEN') || null
  const cnpj = readEnv('KICOMANDA_CNPJ', 'QOMANDA_CNPJ').replace(/\D/g, '') || null
  const provider = readEnv('KICOMANDA_NFE_PROVIDER', 'QOMANDA_NFE_PROVIDER') || 'focusnfe'
  const environment: NfeEnvironment =
    readEnv('KICOMANDA_NFE_ENVIRONMENT', 'QOMANDA_NFE_ENVIRONMENT') === 'producao'
      ? 'producao'
      : 'homologacao'

  return {
    provider,
    token,
    environment,
    cnpj,
    cnae: readEnv('KICOMANDA_NFE_CNAE', 'QOMANDA_NFE_CNAE') || null,
    legalName: readEnv('KICOMANDA_LEGAL_NAME', 'QOMANDA_LEGAL_NAME') || 'KiComanda Tecnologia',
    serviceDescription:
      readEnv('KICOMANDA_NFE_SERVICE_DESCRIPTION', 'QOMANDA_NFE_SERVICE_DESCRIPTION') ||
      'Assinatura e taxas da plataforma KiComanda',
    hasCredentials: Boolean(token && cnpj && provider === 'focusnfe'),
  }
}

/** @deprecated use KiComandaFiscalConfig */
export type QomandaFiscalConfig = KiComandaFiscalConfig

/** @deprecated use getKiComandaFiscalConfig */
export const getQomandaFiscalConfig = getKiComandaFiscalConfig
