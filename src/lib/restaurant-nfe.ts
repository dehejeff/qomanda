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

export type NfeNoteType = 'nfce' | 'nfse'

export const NFE_NOTE_TYPES: { id: NfeNoteType; label: string; hint: string }[] = [
  { id: 'nfce', label: 'NFC-e (consumidor)', hint: 'Consumo no local — modelo 65. Padrão de bar/restaurante.' },
  { id: 'nfse', label: 'NFS-e (serviço)', hint: 'Nota de serviço — varia por município.' },
]

export type RestaurantNfeInput = {
  nfeEnabled?: boolean
  nfeStatus?: NfeStatus
  nfeProvider?: NfeProvider | ''
  nfeNoteType?: NfeNoteType | ''
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
  nfe_note_type: NfeNoteType | null
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
  nfe_enabled, nfe_status, nfe_provider, nfe_note_type, nfe_environment,
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
    nfe_note_type: (row.nfe_note_type as NfeNoteType | null) ?? null,
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

/** Preenche defaults do formulário (ex.: MEI visível no select mas ainda vazio no state). */
export function normalizeRestaurantNfeInput(
  input: RestaurantNfeInput,
  documentType?: 'cpf' | 'cnpj' | null,
): RestaurantNfeInput {
  const next = { ...input }
  if (documentType === 'cpf' && !next.nfeTaxRegime) {
    next.nfeTaxRegime = 'mei'
  }
  return next
}

export function validateRestaurantNfe(input: RestaurantNfeInput, documentType?: 'cpf' | 'cnpj' | null): string | null {
  const normalized = normalizeRestaurantNfeInput(input, documentType)
  const enabled = normalized.nfeEnabled ?? normalized.nfeStatus !== 'disabled'
  if (!enabled && normalized.nfeStatus !== 'pending') return null

  if (documentType === 'cpf' && (normalized.nfeStatus === 'active' || normalized.nfeStatus === 'pending')) {
    // MEI/autônomo — regime padrão mei; IE/CNAE opcionais em pendente
    if (!normalized.nfeProvider) return 'Selecione o emissor de notas.'
    if (normalized.nfeStatus === 'active' && normalized.nfeCnae) {
      const digits = normalized.nfeCnae.replace(/\D/g, '')
      if (digits && !/^\d{7}$/.test(digits)) return 'CNAE deve ter 7 dígitos.'
    }
    return null
  }

  if (!normalized.nfeProvider) return 'Selecione o provedor de NF-e.'
  if (!normalized.nfeTaxRegime) return 'Selecione o regime tributário.'
  if (!normalized.nfeStateRegistration?.trim()) return 'Informe a Inscrição Estadual (ou ISENTO).'
  if (!normalized.nfeCnae?.trim()) return 'Informe o CNAE principal.'
  if (normalized.nfeCnae && !/^\d{7}$/.test(normalized.nfeCnae.replace(/\D/g, ''))) {
    return 'CNAE deve ter 7 dígitos.'
  }

  return null
}

export function nfeFieldsToDb(input: RestaurantNfeInput, existingTokenEncrypted?: string | null, documentType?: 'cpf' | 'cnpj' | null) {
  const normalized = normalizeRestaurantNfeInput(input, documentType)
  const enabled = Boolean(normalized.nfeEnabled)
  const status = normalized.nfeStatus ?? (enabled ? 'pending' : 'disabled')
  const now = new Date().toISOString()

  const patch: Record<string, unknown> = {
    nfe_enabled: enabled,
    nfe_status: status,
    nfe_environment: normalized.nfeEnvironment ?? 'homologacao',
    nfe_provider: normalized.nfeProvider || null,
    nfe_note_type: normalized.nfeNoteType || null,
    nfe_provider_company_id: normalized.nfeProviderCompanyId?.trim() || null,
    nfe_state_registration: normalized.nfeStateRegistration?.trim().toUpperCase() || null,
    nfe_municipal_registration: normalized.nfeMunicipalRegistration?.trim() || null,
    nfe_tax_regime: normalized.nfeTaxRegime || null,
    nfe_cnae: normalized.nfeCnae?.replace(/\D/g, '') || null,
    nfe_invoice_series: normalized.nfeInvoiceSeries?.trim() || '1',
    nfe_next_invoice_number: normalized.nfeNextInvoiceNumber
      ? Number(normalized.nfeNextInvoiceNumber)
      : null,
    nfe_auto_emit: Boolean(normalized.nfeAutoEmit),
    nfe_split_food_drinks: normalized.nfeSplitFoodDrinks !== false,
    nfe_notes: normalized.nfeNotes?.trim() || null,
  }

  const token = normalized.nfeProviderToken?.trim()
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
