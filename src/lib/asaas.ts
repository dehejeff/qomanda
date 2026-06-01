/**
 * Qomanda — Asaas API Client (conta master — configurável no portal interno)
 * Documentação: https://docs.asaas.com
 */

import { asaasBaseUrl, getAsaasConfig } from '@/lib/asaas-config'

async function request<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const config = await getAsaasConfig()
  if (!config.apiKey) {
    throw new Error('Gateway de pagamento não configurado.')
  }

  const res = await fetch(`${asaasBaseUrl(config.environment)}${path}`, {
    ...options,
    headers: {
      access_token: config.apiKey,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  const data = await res.json()

  if (!res.ok) {
    const msg = data?.errors?.[0]?.description ?? data?.message ?? 'Erro na API Asaas'
    throw new Error(msg)
  }

  return data as T
}

/** Testa credenciais sem usar cache — útil no portal interno. */
export async function testAsaasConnection(): Promise<{ balance: number; environment: string }> {
  const config = await getAsaasConfig()
  if (!config.apiKey) throw new Error('API key não configurada.')

  const res = await fetch(`${asaasBaseUrl(config.environment)}/finance/balance`, {
    headers: { access_token: config.apiKey },
  })
  const data = await res.json()
  if (!res.ok) {
    const msg = data?.errors?.[0]?.description ?? data?.message ?? 'Falha na conexão.'
    throw new Error(msg)
  }
  return {
    balance: Number(data.balance ?? 0),
    environment: config.environment,
  }
}

// ── Tipos ────────────────────────────────────────────────────

export type AsaasBillingType = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO'
export type AsaasPaymentStatus =
  | 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE'
  | 'REFUNDED' | 'RECEIVED_IN_CASH' | 'REFUND_REQUESTED'
  | 'CHARGEBACK_REQUESTED' | 'CHARGEBACK_DISPUTE' | 'AWAITING_CHARGEBACK_REVERSAL'
  | 'DUNNING_REQUESTED' | 'DUNNING_RECEIVED' | 'AWAITING_RISK_ANALYSIS'

export interface AsaasCustomer {
  id: string
  name: string
  cpfCnpj: string
  mobilePhone?: string
  email?: string
}

export interface AsaasPayment {
  id: string
  customer: string
  billingType: AsaasBillingType
  value: number
  netValue: number
  status: AsaasPaymentStatus
  dueDate: string
  description?: string
  externalReference?: string
  invoiceUrl?: string
}

export interface AsaasPixQrCode {
  encodedImage: string   // base64 da imagem do QR Code
  payload: string        // copia-e-cola PIX
  expirationDate: string
}

export interface AsaasCreditCard {
  holderName: string
  number: string      // 16 dígitos
  expiryMonth: string // '01'..'12'
  expiryYear: string  // '2028'
  ccv: string
}

export interface AsaasCreditCardHolderInfo {
  name: string
  email: string
  cpfCnpj: string     // CPF do titular do cartão
  postalCode?: string
  addressNumber?: string
  phone?: string
  mobilePhone?: string
}

export interface AsaasCreditCardTokenResponse {
  creditCardNumber: string
  creditCardBrand: string
  creditCardToken: string
}

/** Entrada do split do marketplace: parte enviada à subconta do restaurante. */
export interface AsaasSplitEntry {
  walletId: string
  fixedValue: number
}

export interface AsaasSubAccount {
  id: string
  walletId: string
  apiKey?: string
  accountNumber?: { agency: string; account: string; accountDigit: string }
}

// ── Customers ────────────────────────────────────────────────

/**
 * Busca um cliente pelo CPF/CNPJ. Retorna null se não encontrado.
 */
export async function findCustomerByCpf(cpfCnpj: string): Promise<AsaasCustomer | null> {
  const data = await request<{ data: AsaasCustomer[] }>(
    `/customers?cpfCnpj=${cpfCnpj.replace(/\D/g, '')}`,
  )
  return data.data?.[0] ?? null
}

/**
 * Cria um cliente no Asaas.
 */
export async function createCustomer(params: {
  name: string
  cpfCnpj: string
  mobilePhone?: string
  email?: string
  externalReference?: string
}): Promise<AsaasCustomer> {
  return request<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/**
 * Encontra ou cria um cliente pelo CPF.
 */
export async function upsertCustomer(params: {
  name: string
  cpfCnpj: string
  mobilePhone?: string
  externalReference?: string
}): Promise<AsaasCustomer> {
  const existing = await findCustomerByCpf(params.cpfCnpj)
  if (existing) return existing
  return createCustomer(params)
}

// ── Payments ─────────────────────────────────────────────────

/**
 * Cria uma cobrança PIX.
 */
export async function createPixPayment(params: {
  customerId: string
  value: number
  description?: string
  externalReference?: string
  dueDate?: string // YYYY-MM-DD, default = hoje
  split?: AsaasSplitEntry[]
}): Promise<AsaasPayment> {
  const dueDate = params.dueDate ?? new Date().toISOString().slice(0, 10)
  return request<AsaasPayment>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: params.customerId,
      billingType: 'PIX',
      value: params.value,
      dueDate,
      description: params.description ?? 'Qomanda — Pagamento de mesa',
      externalReference: params.externalReference,
      ...(params.split && params.split.length > 0 ? { split: params.split } : {}),
    }),
  })
}

/**
 * Cria uma cobrança no cartão de crédito.
 * O Asaas processa e retorna o status imediatamente.
 */
export async function createCreditCardPayment(params: {
  customerId: string
  value: number
  installmentCount?: number
  description?: string
  externalReference?: string
  creditCard: AsaasCreditCard
  creditCardHolderInfo: AsaasCreditCardHolderInfo
  dueDate?: string
  split?: AsaasSplitEntry[]
}): Promise<AsaasPayment> {
  const dueDate = params.dueDate ?? new Date().toISOString().slice(0, 10)
  const installmentCount = params.installmentCount ?? 1
  const installmentValue = Number((params.value / installmentCount).toFixed(2))

  return request<AsaasPayment>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: params.customerId,
      billingType: 'CREDIT_CARD',
      value: params.value,
      dueDate,
      installmentCount: installmentCount > 1 ? installmentCount : undefined,
      installmentValue: installmentCount > 1 ? installmentValue : undefined,
      description: params.description ?? 'Qomanda — Pagamento de mesa',
      externalReference: params.externalReference,
      creditCard: {
        holderName: params.creditCard.holderName,
        number: params.creditCard.number.replace(/\s/g, ''),
        expiryMonth: params.creditCard.expiryMonth,
        expiryYear: params.creditCard.expiryYear,
        ccv: params.creditCard.ccv,
      },
      creditCardHolderInfo: params.creditCardHolderInfo,
      ...(params.split && params.split.length > 0 ? { split: params.split } : {}),
    }),
  })
}

/**
 * Tokeniza um cartão de crédito no Asaas (sem cobrança).
 */
export async function tokenizeCreditCard(params: {
  customerId: string
  creditCard: AsaasCreditCard
  creditCardHolderInfo: AsaasCreditCardHolderInfo
  remoteIp: string
}): Promise<AsaasCreditCardTokenResponse> {
  return request<AsaasCreditCardTokenResponse>('/creditCard/tokenize', {
    method: 'POST',
    body: JSON.stringify({
      customer: params.customerId,
      creditCard: {
        holderName: params.creditCard.holderName,
        number: params.creditCard.number.replace(/\s/g, ''),
        expiryMonth: params.creditCard.expiryMonth,
        expiryYear: params.creditCard.expiryYear,
        ccv: params.creditCard.ccv,
      },
      creditCardHolderInfo: params.creditCardHolderInfo,
      remoteIp: params.remoteIp,
    }),
  })
}

/**
 * Cobra no cartão usando token previamente salvo.
 */
export async function createCreditCardPaymentWithToken(params: {
  customerId: string
  value: number
  creditCardToken: string
  installmentCount?: number
  description?: string
  externalReference?: string
  dueDate?: string
  split?: AsaasSplitEntry[]
}): Promise<AsaasPayment> {
  const dueDate = params.dueDate ?? new Date().toISOString().slice(0, 10)
  const installmentCount = params.installmentCount ?? 1
  const installmentValue = Number((params.value / installmentCount).toFixed(2))

  return request<AsaasPayment>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: params.customerId,
      billingType: 'CREDIT_CARD',
      value: params.value,
      dueDate,
      installmentCount: installmentCount > 1 ? installmentCount : undefined,
      installmentValue: installmentCount > 1 ? installmentValue : undefined,
      description: params.description ?? 'Qomanda — Pagamento de mesa',
      externalReference: params.externalReference,
      creditCardToken: params.creditCardToken,
      ...(params.split && params.split.length > 0 ? { split: params.split } : {}),
    }),
  })
}

/**
 * Busca o QR Code PIX de uma cobrança.
 */
export async function getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return request<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`)
}

/**
 * Consulta o status de um pagamento.
 */
export async function getPaymentStatus(paymentId: string): Promise<AsaasPayment> {
  return request<AsaasPayment>(`/payments/${paymentId}`)
}

/**
 * Status que indicam pagamento confirmado.
 */
export function isPaymentConfirmed(status: AsaasPaymentStatus): boolean {
  return ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(status)
}

// ── Subcontas (marketplace) ──────────────────────────────────

/** Status retornado pelo Asaas para uma subconta. */
export interface AsaasSubAccountInfo {
  id: string
  name: string
  email: string
  walletId?: string
  /** Aprovação geral da subconta no Asaas. */
  generalApproval?: 'AWAITING' | 'APPROVED' | 'REJECTED' | 'PARTIALLY_APPROVED'
  commercialInfoApproval?: 'AWAITING' | 'APPROVED' | 'REJECTED'
  bankAccountInfoApproval?: 'AWAITING' | 'APPROVED' | 'REJECTED'
  documentationApproval?: 'AWAITING' | 'APPROVED' | 'REJECTED'
}

/**
 * Consulta os dados e o status de aprovação de uma subconta.
 * Doc: https://docs.asaas.com/reference/buscar-subconta
 */
export async function getSubAccountInfo(accountId: string): Promise<AsaasSubAccountInfo> {
  return request<AsaasSubAccountInfo>(`/accounts/${accountId}`)
}

/**
 * Cria uma subconta Asaas para um restaurante (onboarding do marketplace).
 * Retorna o walletId (destino do split) e a apiKey da subconta.
 * Doc: https://docs.asaas.com/reference/criar-subconta
 */
export async function createSubAccount(params: {
  name: string
  email: string
  cpfCnpj: string
  mobilePhone: string
  incomeValue: number            // faturamento/renda mensal estimada
  address: string
  addressNumber: string
  province: string               // bairro
  postalCode: string
  companyType?: 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION'
  externalReference?: string
  /** Obrigatório quando cpfCnpj é CPF (Pessoa Física). Formato YYYY-MM-DD. */
  birthDate?: string
}): Promise<AsaasSubAccount> {
  return request<AsaasSubAccount>('/accounts', {
    method: 'POST',
    body: JSON.stringify({
      name: params.name,
      email: params.email,
      cpfCnpj: params.cpfCnpj.replace(/\D/g, ''),
      mobilePhone: params.mobilePhone.replace(/\D/g, ''),
      incomeValue: params.incomeValue,
      address: params.address,
      addressNumber: params.addressNumber,
      province: params.province,
      postalCode: params.postalCode.replace(/\D/g, ''),
      companyType: params.companyType,
      externalReference: params.externalReference,
      ...(params.birthDate ? { birthDate: params.birthDate } : {}),
    }),
  })
}
