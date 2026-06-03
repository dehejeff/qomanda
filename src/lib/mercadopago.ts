/**
 * Qomanda — Mercado Pago API Client (conta do restaurante)
 * Documentação: https://www.mercadopago.com.br/developers/pt/reference
 */

const MP_API = 'https://api.mercadopago.com'

export type MercadoPagoContext = {
  accessToken: string
  environment: 'sandbox' | 'production'
}

export type MercadoPagoUser = {
  id: number
  nickname: string
  email?: string
  public_key?: string
}

export type MercadoPagoPaymentStatus =
  | 'pending'
  | 'approved'
  | 'authorized'
  | 'in_process'
  | 'in_mediation'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back'

export type MercadoPagoPayment = {
  id: number
  status: MercadoPagoPaymentStatus
  status_detail?: string
  transaction_amount: number
  external_reference?: string
  point_of_interaction?: {
    transaction_data?: {
      qr_code_base64?: string
      qr_code?: string
      ticket_url?: string
    }
  }
}

async function requestWithContext<T>(
  ctx: MercadoPagoContext,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${MP_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${ctx.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      data?.message
      ?? data?.error
      ?? data?.cause?.[0]?.description
      ?? 'Erro na API Mercado Pago'
    throw new Error(typeof msg === 'string' ? msg : 'Erro na API Mercado Pago')
  }
  return data as T
}

/** Valida credenciais e retorna dados da conta (inclui public_key para tokenização no checkout). */
export async function testMercadoPagoConnection(ctx: MercadoPagoContext): Promise<{
  userId: number
  nickname: string
  publicKey: string | null
  environment: string
}> {
  const user = await requestWithContext<MercadoPagoUser>(ctx, '/users/me')
  return {
    userId: user.id,
    nickname: user.nickname,
    publicKey: user.public_key ?? null,
    environment: ctx.environment,
  }
}

export async function getMercadoPagoPublicKey(ctx: MercadoPagoContext): Promise<string | null> {
  const user = await requestWithContext<MercadoPagoUser>(ctx, '/users/me')
  return user.public_key ?? null
}

export function isMercadoPagoPaymentApproved(status: MercadoPagoPaymentStatus | string): boolean {
  return status === 'approved' || status === 'authorized'
}

export function isMercadoPagoPaymentRefunded(status: MercadoPagoPaymentStatus | string): boolean {
  return status === 'refunded' || status === 'charged_back'
}

export async function getMercadoPagoPayment(
  ctx: MercadoPagoContext,
  paymentId: string | number,
): Promise<MercadoPagoPayment> {
  return requestWithContext<MercadoPagoPayment>(ctx, `/v1/payments/${paymentId}`)
}

export async function createMercadoPagoPixPayment(
  ctx: MercadoPagoContext,
  input: {
    amount: number
    description: string
    externalReference: string
    payerEmail: string
  },
): Promise<MercadoPagoPayment> {
  return requestWithContext<MercadoPagoPayment>(ctx, '/v1/payments', {
    method: 'POST',
    body: JSON.stringify({
      transaction_amount: input.amount,
      description: input.description,
      payment_method_id: 'pix',
      external_reference: input.externalReference,
      payer: { email: input.payerEmail },
    }),
  })
}

export async function createMercadoPagoCardPayment(
  ctx: MercadoPagoContext,
  input: {
    amount: number
    description: string
    externalReference: string
    payerEmail: string
    cardToken: string
    installments?: number
    paymentMethodId?: string
  },
): Promise<MercadoPagoPayment> {
  return requestWithContext<MercadoPagoPayment>(ctx, '/v1/payments', {
    method: 'POST',
    body: JSON.stringify({
      transaction_amount: input.amount,
      token: input.cardToken,
      description: input.description,
      installments: input.installments ?? 1,
      payment_method_id: input.paymentMethodId,
      external_reference: input.externalReference,
      payer: { email: input.payerEmail },
    }),
  })
}

export function extractMercadoPagoPixData(payment: MercadoPagoPayment): {
  qrCodeBase64: string | null
  copyPaste: string | null
} {
  const tx = payment.point_of_interaction?.transaction_data
  return {
    qrCodeBase64: tx?.qr_code_base64 ?? null,
    copyPaste: tx?.qr_code ?? null,
  }
}
