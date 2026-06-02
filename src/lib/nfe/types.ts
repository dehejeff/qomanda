export type NfeNoteType = 'nfce' | 'nfse'
export type NfeEnvironment = 'homologacao' | 'producao'

export type NfeEmitItem = {
  description: string
  quantity: number
  unitPrice: number
}

export type NfeEmitInput = {
  noteType: NfeNoteType
  environment: NfeEnvironment
  /** Ref idempotente (id do pagamento) — provedor deduplica por ref. */
  ref: string
  amount: number
  items: NfeEmitItem[]
  customer?: { name?: string | null; document?: string | null }
  restaurant: {
    token: string | null
    cnpj: string | null
    companyId?: string | null
    series?: string | null
    cnae?: string | null
  }
}

export type NfeEmitStatus = 'issued' | 'processing' | 'error' | 'simulated'

export type NfeEmitResult = {
  status: NfeEmitStatus
  providerRef?: string
  number?: string
  accessKey?: string
  danfeUrl?: string
  xmlUrl?: string
  error?: string
}

export interface NfeProviderAdapter {
  readonly id: string
  emit(input: NfeEmitInput): Promise<NfeEmitResult>
}
