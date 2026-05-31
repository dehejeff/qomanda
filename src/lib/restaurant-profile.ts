export type RestaurantDocumentType = 'cpf' | 'cnpj'

export type RestaurantCompanyType = 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION'

export const BUSINESS_TYPES = [
  { id: 'restaurante', label: 'Restaurante' },
  { id: 'bar', label: 'Bar' },
  { id: 'pizzaria', label: 'Pizzaria' },
  { id: 'cafeteria', label: 'Cafeteria' },
  { id: 'hamburgueria', label: 'Hamburgueria' },
  { id: 'lanchonete', label: 'Lanchonete' },
  { id: 'pub', label: 'Pub' },
  { id: 'outro', label: 'Outro' },
] as const

export const COMPANY_TYPES: { id: RestaurantCompanyType; label: string }[] = [
  { id: 'MEI', label: 'MEI' },
  { id: 'LIMITED', label: 'LTDA / Sociedade limitada' },
  { id: 'INDIVIDUAL', label: 'Empresário individual' },
  { id: 'ASSOCIATION', label: 'Associação / outro' },
]

export const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

export type RestaurantBusinessInput = {
  businessType?: string
  legalName?: string
  documentType?: RestaurantDocumentType
  documentNumber?: string
  companyType?: RestaurantCompanyType | ''
  ownerCpf?: string
  contactEmail?: string
  phone?: string
  addressPostalCode?: string
  addressStreet?: string
  addressNumber?: string
  addressComplement?: string
  addressNeighborhood?: string
  addressCity?: string
  addressState?: string
  estimatedMonthlyRevenue?: number | string
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

export function formatAddressLine(input: RestaurantBusinessInput): string {
  const parts = [
    [input.addressStreet, input.addressNumber].filter(Boolean).join(', '),
    input.addressComplement,
    [input.addressNeighborhood, input.addressCity].filter(Boolean).join(' — '),
    input.addressState,
    input.addressPostalCode ? `CEP ${formatCep(input.addressPostalCode)}` : '',
  ].filter(Boolean)
  return parts.join(' · ')
}

export function formatCep(value: string) {
  const d = digitsOnly(value)
  if (d.length !== 8) return value
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export function formatDocument(value: string, type?: RestaurantDocumentType | null) {
  const d = digitsOnly(value)
  if (type === 'cnpj' && d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  }
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  }
  return value
}

export function validateRestaurantBusiness(input: RestaurantBusinessInput): string | null {
  const phone = digitsOnly(input.phone ?? '')
  if (phone.length < 10) return 'Informe telefone com DDD.'

  const docType = input.documentType
  const doc = digitsOnly(input.documentNumber ?? '')
  if (!docType) return 'Selecione CPF ou CNPJ.'
  if (docType === 'cpf' && doc.length !== 11) return 'CPF inválido.'
  if (docType === 'cnpj' && doc.length !== 14) return 'CNPJ inválido.'
  if (docType === 'cnpj') {
    const ownerCpf = digitsOnly(input.ownerCpf ?? '')
    if (ownerCpf.length !== 11) return 'Informe o CPF do responsável legal.'
    if (!input.companyType) return 'Selecione o tipo jurídico.'
  }

  if (!input.legalName?.trim()) return 'Informe a razão social ou nome do titular.'

  const cep = digitsOnly(input.addressPostalCode ?? '')
  if (cep.length !== 8) return 'CEP inválido.'
  if (!input.addressStreet?.trim()) return 'Informe o logradouro.'
  if (!input.addressNumber?.trim()) return 'Informe o número.'
  if (!input.addressNeighborhood?.trim()) return 'Informe o bairro.'
  if (!input.addressCity?.trim()) return 'Informe a cidade.'
  if (!input.addressState || input.addressState.length !== 2) return 'Selecione o estado (UF).'

  const revenue = Number(input.estimatedMonthlyRevenue)
  if (!Number.isFinite(revenue) || revenue <= 0) return 'Informe o faturamento mensal estimado.'

  if (input.contactEmail?.trim() && !input.contactEmail.includes('@')) {
    return 'E-mail comercial inválido.'
  }

  return null
}

export function businessFieldsToDb(input: RestaurantBusinessInput) {
  const docType = input.documentType!
  const doc = digitsOnly(input.documentNumber ?? '')

  return {
    business_type: input.businessType?.trim() || null,
    legal_name: input.legalName?.trim() || null,
    document_type: docType,
    document_number: doc,
    company_type: docType === 'cnpj' ? (input.companyType || null) : (input.companyType || 'MEI'),
    owner_cpf: docType === 'cnpj' ? digitsOnly(input.ownerCpf ?? '') : null,
    contact_email: input.contactEmail?.trim().toLowerCase() || null,
    phone: digitsOnly(input.phone ?? ''),
    address_postal_code: digitsOnly(input.addressPostalCode ?? ''),
    address_street: input.addressStreet?.trim() || null,
    address_number: input.addressNumber?.trim() || null,
    address_complement: input.addressComplement?.trim() || null,
    address_neighborhood: input.addressNeighborhood?.trim() || null,
    address_city: input.addressCity?.trim() || null,
    address_state: input.addressState?.trim().toUpperCase() || null,
    estimated_monthly_revenue: Number(input.estimatedMonthlyRevenue),
    address: formatAddressLine(input),
    payout_holder_name: input.legalName?.trim() || null,
    payout_document: doc,
  }
}

export type RestaurantBusinessProfile = {
  business_type: string | null
  legal_name: string | null
  document_type: RestaurantDocumentType | null
  document_number: string | null
  company_type: RestaurantCompanyType | null
  owner_cpf: string | null
  contact_email: string | null
  address_postal_code: string | null
  address_street: string | null
  address_number: string | null
  address_complement: string | null
  address_neighborhood: string | null
  address_city: string | null
  address_state: string | null
  estimated_monthly_revenue: number | null
}

export function profileFromRow(row: Record<string, unknown>): RestaurantBusinessProfile {
  return {
    business_type: (row.business_type as string | null) ?? null,
    legal_name: (row.legal_name as string | null) ?? null,
    document_type: (row.document_type as RestaurantDocumentType | null) ?? null,
    document_number: (row.document_number as string | null) ?? null,
    company_type: (row.company_type as RestaurantCompanyType | null) ?? null,
    owner_cpf: (row.owner_cpf as string | null) ?? null,
    contact_email: (row.contact_email as string | null) ?? null,
    address_postal_code: (row.address_postal_code as string | null) ?? null,
    address_street: (row.address_street as string | null) ?? null,
    address_number: (row.address_number as string | null) ?? null,
    address_complement: (row.address_complement as string | null) ?? null,
    address_neighborhood: (row.address_neighborhood as string | null) ?? null,
    address_city: (row.address_city as string | null) ?? null,
    address_state: (row.address_state as string | null) ?? null,
    estimated_monthly_revenue: row.estimated_monthly_revenue != null ? Number(row.estimated_monthly_revenue) : null,
  }
}

export const BUSINESS_PROFILE_SELECT = `
  business_type, legal_name, document_type, document_number, company_type, owner_cpf,
  contact_email, address_postal_code, address_street, address_number, address_complement,
  address_neighborhood, address_city, address_state, estimated_monthly_revenue
`
