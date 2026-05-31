import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createPixPayment,
  createCreditCardPayment,
  createCreditCardPaymentWithToken,
  tokenizeCreditCard,
  getPixQrCode,
  isPaymentConfirmed,
  type AsaasCreditCard,
  type AsaasCreditCardHolderInfo,
} from '@/lib/asaas'
import { buildHolderInfoFromCustomer, resolveAsaasCustomerId } from '@/lib/asaas-customer'
import {
  clientIp,
  getPaymentMethodToken,
  savePaymentMethod,
} from '@/lib/payment-methods'
import { generateConfirmationCode } from '@/lib/utils'
import { isPaymentBypassEnabled } from '@/lib/payment-bypass'
import { syncCloseRequestOnPayment } from '@/lib/sync-payment-close-request'
import {
  normalizePaymentAmount,
  paymentInsertErrorMessage,
  resolvePaymentCustomerId,
} from '@/lib/payment-db'
import { closeSessionIfSettled } from '@/lib/close-session-if-settled'
import { notifyPaymentCoverage } from '@/lib/notify-payment-coverage'
import { grantEarnedLoyaltyOffers } from '@/lib/grant-loyalty-offers'
import { computeAsaasSplit } from '@/lib/asaas-split'
import {
  applySessionRenewal,
  authenticateCustomerSession,
} from '@/lib/customer-session'

export type AsaasPaymentRequest = {
  sessionId: string
  amount: number
  method: 'pix' | 'credit' | 'debit'
  splitType?: 'food' | 'alcohol' | 'combined'
  customerId?: string | null
  /** true = inclui 10% de taxa de serviço; false = cliente recusou a taxa */
  serviceFeeIncluded?: boolean
  installmentCount?: number
  // Crédito — cartão novo ou salvo
  creditCard?: AsaasCreditCard
  creditCardHolderInfo?: AsaasCreditCardHolderInfo
  paymentMethodId?: string
  saveCard?: boolean
}

export type AsaasPaymentResponse = {
  paymentId: string       // ID interno (Supabase payments table)
  asaasPaymentId: string  // ID no Asaas
  confirmationCode: string
  // PIX
  pixQrCodeImage?: string  // base64 da imagem
  pixPayload?: string      // copia-e-cola
  pixExpiration?: string
  // Status
  status: 'pending' | 'paid'
  /** true quando este pagamento quitou a mesa e a sessão foi fechada */
  sessionClosed?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const body: AsaasPaymentRequest = await req.json()
    const { sessionId, amount: rawAmount, method, splitType = 'combined', installmentCount = 1, customerId: bodyCustomerId, serviceFeeIncluded = true, paymentMethodId, saveCard = false } = body

    const amount = normalizePaymentAmount(rawAmount)
    if (!sessionId || !amount || !method) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes ou valor inválido.' }, { status: 400 })
    }

    // Pagar com cartão salvo exige sessão autenticada por senha (prova de identidade).
    let sessionRenewal: string | undefined
    if (paymentMethodId) {
      if (!bodyCustomerId) {
        return NextResponse.json(
          { error: 'Sessão não autenticada. Faça login com sua senha de 6 dígitos para usar o cartão salvo.' },
          { status: 401 },
        )
      }
      const auth = authenticateCustomerSession(req, bodyCustomerId)
      if (!auth.ok) {
        return NextResponse.json(
          { error: 'Sessão não autenticada. Faça login com sua senha de 6 dígitos para usar o cartão salvo.' },
          { status: 401 },
        )
      }
      sessionRenewal = auth.renewedToken
    }

    const paymentOk = (body: AsaasPaymentResponse) =>
      applySessionRenewal(NextResponse.json(body), sessionRenewal)

    const supabase = createAdminClient()

    // ── Busca sessão e restaurante ─────────────────────────
    const { data: session } = await supabase
      .from('sessions')
      .select('customer_id, restaurant_id, restaurant:restaurants(name, asaas_wallet_id, platform_fee_percent, platform_fee_fixed)')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Sessão inválida.' }, { status: 404 })
    }

    const payerCustomerId = await resolvePaymentCustomerId(
      supabase,
      bodyCustomerId ?? session.customer_id,
    )

    // ── Modo teste: confirma pagamento sem gateway ────────
    if (await isPaymentBypassEnabled()) {
      const confirmationCode = generateConfirmationCode()
      const methodDb = method === 'debit' ? 'debit' : method === 'credit' ? 'credit' : 'pix'

      const { data: payment, error: pmtError } = await supabase
        .from('payments')
        .insert({
          session_id:    sessionId,
          restaurant_id: session.restaurant_id,
          customer_id:   payerCustomerId,
          amount,
          method:        methodDb,
          split_type:    splitType,
          service_fee_included: serviceFeeIncluded,
          status:        'paid',
          confirmation_code: confirmationCode,
          paid_at:       new Date().toISOString(),
          asaas_payment_id: `mock_${crypto.randomUUID()}`,
        })
        .select('id')
        .single()

      if (pmtError || !payment) {
        console.error('[Payment bypass insert]', pmtError)
        return NextResponse.json({ error: paymentInsertErrorMessage(pmtError) }, { status: 500 })
      }

      await syncCloseRequestOnPayment(supabase, sessionId, payerCustomerId, payment.id, amount)
      await notifyPaymentCoverage(
        supabase,
        sessionId,
        payerCustomerId,
        {
          customer_id: payerCustomerId,
          amount,
          service_fee_included: serviceFeeIncluded,
          paid_at: new Date().toISOString(),
        },
        payment.id,
      )
      const settlement = await closeSessionIfSettled(supabase, sessionId)
      await grantEarnedLoyaltyOffers(supabase, payerCustomerId, session.restaurant_id)

      return paymentOk({
        paymentId: payment.id,
        asaasPaymentId: `mock_${payment.id}`,
        confirmationCode,
        status: 'paid',
        sessionClosed: settlement.closed,
      })
    }

    const restaurantData = (session.restaurant as any) ?? {}
    const restaurantName = restaurantData.name ?? 'Restaurante'

    // Split do marketplace: parte do restaurante vai para a subconta dele (walletId).
    // A taxa da Qomanda fica na conta master. Sem walletId, cobra sem repasse (fallback).
    const split = computeAsaasSplit(amount, {
      walletId: restaurantData.asaas_wallet_id ?? null,
      feePercent: Number(restaurantData.platform_fee_percent ?? 0),
      feeFixed: Number(restaurantData.platform_fee_fixed ?? 0),
    }).split

    // ── Cliente Asaas (pagador) ────────────────────────────
    let asaasCustomerId: string
    let payerCustomerRow: Awaited<ReturnType<typeof resolveAsaasCustomerId>>['customer'] | null = null

    if (payerCustomerId) {
      const resolved = await resolveAsaasCustomerId(supabase, payerCustomerId)
      asaasCustomerId = resolved.asaasCustomerId
      payerCustomerRow = resolved.customer
    } else if (session.customer_id) {
      const resolved = await resolveAsaasCustomerId(supabase, session.customer_id)
      asaasCustomerId = resolved.asaasCustomerId
      payerCustomerRow = resolved.customer
    } else {
      return NextResponse.json({ error: 'Cliente não identificado para pagamento.' }, { status: 400 })
    }

    // ── Cria o registro interno de pagamento ──────────────
    const { data: payment, error: pmtError } = await supabase
      .from('payments')
      .insert({
        session_id:    sessionId,
        restaurant_id: session.restaurant_id,
        customer_id:   payerCustomerId,
        amount,
        method:        method === 'debit' ? 'debit' : method === 'credit' ? 'credit' : 'pix',
        split_type:    splitType,
        service_fee_included: serviceFeeIncluded,
        status:        'pending',
      })
      .select('id')
      .single()

    if (pmtError || !payment) {
      console.error('[Payment insert]', pmtError)
      return NextResponse.json({ error: paymentInsertErrorMessage(pmtError) }, { status: 500 })
    }

    const description = `${restaurantName} — Sessão ${sessionId.slice(-6).toUpperCase()}`

    // ── PIX ────────────────────────────────────────────────
    if (method === 'pix' || method === 'debit') {
      const asaasPayment = await createPixPayment({
        customerId: asaasCustomerId,
        value: amount,
        description,
        externalReference: payment.id,
        split,
      })

      // Busca QR Code
      const qrCode = await getPixQrCode(asaasPayment.id)

      // Atualiza o registro com o ID do Asaas
      await supabase
        .from('payments')
        .update({ asaas_payment_id: asaasPayment.id })
        .eq('id', payment.id)

      return NextResponse.json({
        paymentId:      payment.id,
        asaasPaymentId: asaasPayment.id,
        confirmationCode: '',   // gerado quando confirmado pelo webhook
        pixQrCodeImage: qrCode.encodedImage,
        pixPayload:     qrCode.payload,
        pixExpiration:  qrCode.expirationDate,
        status: 'pending',
      } satisfies AsaasPaymentResponse)
    }

    // ── Cartão de Crédito ──────────────────────────────────
    if (method === 'credit') {
      let asaasPayment

      if (paymentMethodId && payerCustomerId) {
        const token = await getPaymentMethodToken(supabase, payerCustomerId, paymentMethodId)
        if (!token) {
          return NextResponse.json({ error: 'Cartão salvo não encontrado.' }, { status: 404 })
        }

        asaasPayment = await createCreditCardPaymentWithToken({
          customerId: asaasCustomerId,
          value: amount,
          creditCardToken: token,
          installmentCount,
          description,
          externalReference: payment.id,
          split,
        })
      } else {
        if (!body.creditCard) {
          return NextResponse.json({ error: 'Dados do cartão são obrigatórios.' }, { status: 400 })
        }

        const baseHolder = payerCustomerRow
          ? buildHolderInfoFromCustomer(payerCustomerRow)
          : { name: body.creditCard.holderName, email: '', cpfCnpj: '00000000000', phone: '', mobilePhone: '' }

        const holderInfo: AsaasCreditCardHolderInfo = {
          name: body.creditCardHolderInfo?.name ?? body.creditCard.holderName ?? baseHolder.name,
          email: body.creditCardHolderInfo?.email || baseHolder.email,
          cpfCnpj: body.creditCardHolderInfo?.cpfCnpj || baseHolder.cpfCnpj,
          phone: body.creditCardHolderInfo?.phone ?? baseHolder.phone,
          mobilePhone: baseHolder.mobilePhone || baseHolder.phone,
          postalCode: body.creditCardHolderInfo?.postalCode,
          addressNumber: body.creditCardHolderInfo?.addressNumber,
        }

        asaasPayment = await createCreditCardPayment({
          customerId: asaasCustomerId,
          value: amount,
          installmentCount,
          description,
          externalReference: payment.id,
          creditCard: body.creditCard,
          creditCardHolderInfo: holderInfo,
          split,
        })

        if (saveCard && payerCustomerId) {
          try {
            const tokenized = await tokenizeCreditCard({
              customerId: asaasCustomerId,
              creditCard: body.creditCard,
              creditCardHolderInfo: holderInfo,
              remoteIp: clientIp(req),
            })
            await savePaymentMethod(supabase, {
              customerId: payerCustomerId,
              creditCardToken: tokenized.creditCardToken,
              brand: tokenized.creditCardBrand,
              lastFour: tokenized.creditCardNumber,
              holderName: body.creditCard.holderName,
            })
          } catch (saveErr) {
            console.warn('[Payment] Falha ao salvar cartão:', saveErr)
          }
        }
      }

      const confirmed = isPaymentConfirmed(asaasPayment.status)
      const confirmationCode = confirmed ? generateConfirmationCode() : ''

      await supabase
        .from('payments')
        .update({
          asaas_payment_id: asaasPayment.id,
          status:           confirmed ? 'paid' : 'processing',
          confirmation_code: confirmed ? confirmationCode : null,
          paid_at:          confirmed ? new Date().toISOString() : null,
        })
        .eq('id', payment.id)

      if (confirmed) {
        const paidAt = new Date().toISOString()
        await syncCloseRequestOnPayment(supabase, sessionId, payerCustomerId, payment.id, amount)
        await notifyPaymentCoverage(
          supabase,
          sessionId,
          payerCustomerId,
          {
            customer_id: payerCustomerId,
            amount,
            service_fee_included: serviceFeeIncluded,
            paid_at: paidAt,
          },
          payment.id,
        )
      }

      const settlement = confirmed
        ? await closeSessionIfSettled(supabase, sessionId)
        : { closed: false }

      if (confirmed) {
        await grantEarnedLoyaltyOffers(supabase, payerCustomerId, session.restaurant_id)
      }

      return paymentOk({
        paymentId:        payment.id,
        asaasPaymentId:   asaasPayment.id,
        confirmationCode,
        status:           confirmed ? 'paid' : 'pending',
        sessionClosed:    settlement.closed,
      })
    }

    return NextResponse.json({ error: 'Método de pagamento inválido.' }, { status: 400 })
  } catch (err: unknown) {
    console.error('[Asaas Payments Error]', err)
    const msg = err instanceof Error ? err.message : 'Erro interno.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * GET /api/asaas/payments?asaasId=pay_xxx
 * Consulta o status atual de um pagamento.
 */
export async function GET(req: NextRequest) {
  const asaasPaymentId = req.nextUrl.searchParams.get('asaasId')
  const internalId     = req.nextUrl.searchParams.get('id')

  if (!asaasPaymentId && !internalId) {
    return NextResponse.json({ error: 'id ou asaasId obrigatório.' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    const query = supabase.from('payments').select('id, asaas_payment_id, status, confirmation_code')
    const { data: payment } = asaasPaymentId
      ? await query.eq('asaas_payment_id', asaasPaymentId).single()
      : await query.eq('id', internalId).single()

    if (!payment) {
      return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 })
    }

    return NextResponse.json(payment)
  } catch (err) {
    console.error('[Asaas GET Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
