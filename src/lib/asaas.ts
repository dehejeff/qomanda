/**
 * Qomanda — Asaas API Client
 * Documentação: https://docs.asaas.com
 *
 * Variáveis de ambiente necessárias:
 *   ASAAS_API_KEY       — chave de API (começa com $)
 *   ASAAS_ENVIRONMENT   — 'sandbox' | 'production'
 */

const BASE_URL =
  process.env.ASAAS_ENVIRONMENT === 'production'
    ? 'https://www.asaas.com/api/v3'
    : 'https://sandbox.asaas.com/api/v3'

function apiKey() {
  const key = process.env.ASAAS_API_KEY
  if (!key) throw new Error('ASAAS_API_KEY não configurada.')
  return key
}

async function request<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      access_token: apiKey(),
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
