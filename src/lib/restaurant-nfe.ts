import { encryptSecret } from '@/lib/secret-crypto'

export type NfeStatus = 'disabled' | 'pending' | 'active' | 'error'

export type NfeProvider = 'focusnfe' | 'nfe_io' | 'nota_simples' | 'tecnospeed' | 'other'

export type NfeEnvironment = 'homologacao' | 'producao'

export type NfeTaxRegime = 'mei' | 'simples_nacional' | 'simples_excesso' | 'lucro_presumido' | 'lucro_real'

export const NFE_PROVIDERS: { id: NfeProvider; label: string }[] = [
  { id: 'focusnfe', label: 'Focus NFe' },
  { id: 'nfe_io', label: 'NFe.io' },
  { id: 'nota_simples', label: 'Nota Simples' },
  { id: 'tecnospeed', label: 'TecnoSpeed' },
  { id: 'other', label: 'Outro emissor' },
]

export const NFE_TAX_REGIMES: { id: NfeTaxRegime; label: string }[] = [
  { id: 'mei', label: 'MEI' },
  { id: 'simples_nacional', label: 'Simples Nacional' },
  { id: 'simples_excesso', label: 'Simples — excesso sublimite' },
  { id: 'lucro_presumido', label: 'Lucro Presumido' },
  { id: 'lucro_real', label: 'Lucro Real' },
]

export type RestaurantNfeInput = {
  nfeEnabled?: boolean
  nfeStatus?: NfeStatus
  nfeProvider?: NfeProvider | ''
  nfeEnvironment?: NfeEnvironment
  nfeProviderToken?: string
  nfeProviderCompanyId?: string
  nfeStateRegistration?: string
  nfeMunicipalRegistration?: string
  nfeTaxRegime?: NfeTaxRegime | ''
  nfeCnae?: string
  nfeInvoiceSeries?: string
  nfeNextInvoiceNumber?: number | string
  nfeAutoEmit?: boolean
  nfeSplitFoodDrinks?: boolean
  nfeNotes?: string
}

export type RestaurantNfeProfile = {
  nfe_enabled: boolean
  nfe_status: NfeStatus
  nfe_provider: NfeProvider | null
  nfe_environment: NfeEnvironment
  nfe_provider_company_id: string | null
  nfe_state_registration: string | null
  nfe_municipal_registration: string | null
  nfe_tax_regime: NfeTaxRegime | null
  nfe_cnae: string | null
  nfe_invoice_series: string | null
  nfe_next_invoice_number: number | null
  nfe_auto_emit: boolean
  nfe_split_food_drinks: boolean
  whatsapp_nfe_enabled: boolean
  nfe_notes: string | null
  nfe_configured_at: string | null
  has_provider_token: boolean
}

export const NFE_PROFILE_SELECT = `
  nfe_enabled, nfe_status, nfe_provider, nfe_environment,
  nfe_provider_token_encrypted, nfe_provider_company_id,
  nfe_state_registration, nfe_municipal_registration, nfe_tax_regime, nfe_cnae,
  nfe_invoice_series, nfe_next_invoice_number,
  nfe_auto_emit, nfe_split_food_drinks, whatsapp_nfe_enabled,
  nfe_notes, nfe_configured_at
`

export function nfeProfileFromRow(row: Record<string, unknown>): RestaurantNfeProfile {
  return {
    nfe_enabled: Boolean(row.nfe_enabled),
    nfe_status: (row.nfe_status as NfeStatus) ?? 'disabled',
    nfe_provider: (row.nfe_provider as NfeProvider | null) ?? null,
    nfe_environment: (row.nfe_environment as NfeEnvironment) ?? 'homologacao',
    nfe_provider_company_id: (row.nfe_provider_company_id as string | null) ?? null,
    nfe_state_registration: (row.nfe_state_registration as string | null) ?? null,
    nfe_municipal_registration: (row.nfe_municipal_registration as string | null) ?? null,
    nfe_tax_regime: (row.nfe_tax_regime as NfeTaxRegime | null) ?? null,
    nfe_cnae: (row.nfe_cnae as string | null) ?? null,
    nfe_invoice_series: (row.nfe_invoice_series as string | null) ?? null,
    nfe_next_invoice_number: row.nfe_next_invoice_number != null ? Number(row.nfe_next_invoice_number) : null,
    nfe_auto_emit: Boolean(row.nfe_auto_emit),
    nfe_split_food_drinks: row.nfe_split_food_drinks !== false,
    whatsapp_nfe_enabled: Boolean(row.whatsapp_nfe_enabled),
    nfe_notes: (row.nfe_notes as string | null) ?? null,
    nfe_configured_at: (row.nfe_configured_at as string | null) ?? null,
    has_provider_token: Boolean(row.nfe_provider_token_encrypted),
  }
}

export function validateRestaurantNfe(input: RestaurantNfeInput, documentType?: 'cpf' | 'cnpj' | null): string | null {
  const enabled = input.nfeEnabled ?? input.nfeStatus !== 'disabled'
  if (!enabled && input.nfeStatus !== 'pending') return null

  if (documentType === 'cpf' && input.nfeStatus === 'active') {
    // MEI pode emitir NFS-e — exige menos campos
    if (!input.nfeProvider) return 'Selecione o emissor de notas.'
    return null
  }

  if (!input.nfeProvider) return 'Selecione o provedor de NF-e.'
  if (!input.nfeTaxRegime) return 'Selecione o regime tributário.'
  if (!input.nfeStateRegistration?.trim()) return 'Informe a Inscrição Estadual (ou ISENTO).'
  if (!input.nfeCnae?.trim()) return 'Informe o CNAE principal.'
  if (input.nfeCnae && !/^\d{7}$/.test(input.nfeCnae.replace(/\D/g, ''))) {
    return 'CNAE deve ter 7 dígitos.'
  }

  return null
}

export function nfeFieldsToDb(input: RestaurantNfeInput, existingTokenEncrypted?: string | null) {
  const enabled = Boolean(input.nfeEnabled)
  const status = input.nfeStatus ?? (enabled ? 'pending' : 'disabled')
  const now = new Date().toISOString()

  const patch: Record<string, unknown> = {
    nfe_enabled: enabled,
    nfe_status: status,
    nfe_environment: input.nfeEnvironment ?? 'homologacao',
    nfe_provider: input.nfeProvider || null,
    nfe_provider_company_id: input.nfeProviderCompanyId?.trim() || null,
    nfe_state_registration: input.nfeStateRegistration?.trim().toUpperCase() || null,
    nfe_municipal_registration: input.nfeMunicipalRegistration?.trim() || null,
    nfe_tax_regime: input.nfeTaxRegime || null,
    nfe_cnae: input.nfeCnae?.replace(/\D/g, '') || null,
    nfe_invoice_series: input.nfeInvoiceSeries?.trim() || '1',
    nfe_next_invoice_number: input.nfeNextInvoiceNumber
      ? Number(input.nfeNextInvoiceNumber)
      : null,
    nfe_auto_emit: Boolean(input.nfeAutoEmit),
    nfe_split_food_drinks: input.nfeSplitFoodDrinks !== false,
    nfe_notes: input.nfeNotes?.trim() || null,
  }

  const token = input.nfeProviderToken?.trim()
  if (token) {
    patch.nfe_provider_token_encrypted = encryptSecret(token)
  }

  if (enabled || status === 'pending' || status === 'active') {
    patch.nfe_configured_at = now
  }

  if (!token && !existingTokenEncrypted && status === 'active') {
    // token required for active — validation should catch before save
  }

  return patch
}

export const NFE_STATUS_LABEL: Record<NfeStatus, string> = {
  disabled: 'Desativado',
  pending: 'Configuração pendente',
  active: 'Ativo',
  error: 'Erro',
}
