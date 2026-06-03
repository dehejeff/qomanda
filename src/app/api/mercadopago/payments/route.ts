import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createMercadoPagoCardPayment,
  createMercadoPagoPixPayment,
  extractMercadoPagoPixData,
  getMercadoPagoPayment,
  isMercadoPagoPaymentApproved,
} from '@/lib/mercadopago'
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
import { applyCommissionToPayment } from '@/lib/payment-commission'
import { resolvePaymentGateway } from '@/lib/payment-gateway-resolve'
import { loadPublicPaymentConfig } from '@/lib/restaurant-payment-config'
import { resolvePayerEmail } from '@/lib/payment-payer'
import { generateConfirmationCode } from '@/lib/utils'

export type MercadoPagoPaymentRequest = {
  sessionId: string
  amount: number
  method: 'pix' | 'credit' | 'debit'
  splitType?: 'food' | 'alcohol' | 'combined'
  customerId?: string | null
  serviceFeeIncluded?: boolean
  installmentCount?: number
  /** Token gerado no browser via SDK Mercado Pago */
  cardToken?: string
  paymentMethodId?: string
}

export type MercadoPagoPaymentResponse = {
  paymentId: string
  gatewayPaymentId: string
  confirmationCode: string
  pixQrCodeImage?: string
  pixPayload?: string
  status: 'pending' | 'paid'
  sessionClosed?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const body: MercadoPagoPaymentRequest = await req.json()
    const {
      sessionId,
      amount: rawAmount,
      method,
      splitType = 'combined',
      customerId: bodyCustomerId,
      serviceFeeIncluded = true,
      installmentCount = 1,
      cardToken,
      paymentMethodId,
    } = body

    const amount = normalizePaymentAmount(rawAmount)
    if (!sessionId || !amount || !method) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes ou valor inválido.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: session } = await supabase
      .from('sessions')
      .select('customer_id, restaurant_id, restaurant:restaurants(id, name, plan_id, asaas_wallet_id, platform_fee_percent, platform_fee_fixed, marketplace_split_enabled)')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Sessão inválida.' }, { status: 404 })
    }

    const payerCustomerId = await resolvePaymentCustomerId(
      supabase,
      bodyCustomerId ?? session.customer_id,
    )

    const paymentOk = (payload: MercadoPagoPaymentResponse) => NextResponse.json(payload)

    if (await isPaymentBypassEnabled()) {
      const confirmationCode = generateConfirmationCode()
      const methodDb = method === 'debit' ? 'debit' : method === 'credit' ? 'credit' : 'pix'

      const { data: payment, error: pmtError } = await supabase
        .from('payments')
        .insert({
          session_id: sessionId,
          restaurant_id: session.restaurant_id,
          customer_id: payerCustomerId,
          amount,
          method: methodDb,
          split_type: splitType,
          service_fee_included: serviceFeeIncluded,
          status: 'paid',
          confirmation_code: confirmationCode,
          paid_at: new Date().toISOString(),
          asaas_payment_id: `mp_mock_${crypto.randomUUID()}`,
        })
        .select('id')
        .single()

      if (pmtError || !payment) {
        return NextResponse.json({ error: paymentInsertErrorMessage(pmtError) }, { status: 500 })
      }

      const restaurantData = (session.restaurant as { plan_id?: string | null } | null) ?? {}
      await applyCommissionToPayment(
        supabase,
        payment.id,
        session.restaurant_id,
        restaurantData.plan_id ?? null,
        amount,
        methodDb,
      )

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
        gatewayPaymentId: `mp_mock_${payment.id}`,
        confirmationCode,
        status: 'paid',
        sessionClosed: settlement.closed,
      })
    }

    const restaurantRaw = session.restaurant as Record<string, unknown> | Record<string, unknown>[] | null
    const restaurantData = (Array.isArray(restaurantRaw) ? restaurantRaw[0] : restaurantRaw) ?? {}
    const restaurantName = String(restaurantData.name ?? 'Restaurante')

    const { mercadoPago } = await resolvePaymentGateway(supabase, {
      id: String(restaurantData.id ?? session.restaurant_id),
      asaas_wallet_id: restaurantData.asaas_wallet_id as string | null,
      platform_fee_percent: restaurantData.platform_fee_percent as number | null,
      platform_fee_fixed: restaurantData.platform_fee_fixed as number | null,
      marketplace_split_enabled: restaurantData.marketplace_split_enabled as boolean | null,
    })

    const paymentConfig = await loadPublicPaymentConfig(supabase, session.restaurant_id)
    if (paymentConfig.provider !== 'mercado_pago') {
      return NextResponse.json({ error: 'Este restaurante não usa Mercado Pago.' }, { status: 400 })
    }

    if (!mercadoPago) {
      return NextResponse.json({
        error: 'Mercado Pago não configurado. Conecte o access token nas configurações.',
      }, { status: 400 })
    }

    const payerEmail = await resolvePayerEmail(supabase, payerCustomerId)

    const { data: payment, error: pmtError } = await supabase
      .from('payments')
      .insert({
        session_id: sessionId,
        restaurant_id: session.restaurant_id,
        customer_id: payerCustomerId,
        amount,
        method: method === 'debit' ? 'debit' : method === 'credit' ? 'credit' : 'pix',
        split_type: splitType,
        service_fee_included: serviceFeeIncluded,
        status: 'pending',
      })
      .select('id')
      .single()

    if (pmtError || !payment) {
      return NextResponse.json({ error: paymentInsertErrorMessage(pmtError) }, { status: 500 })
    }

    const description = `${restaurantName} — Sessão ${sessionId.slice(-6).toUpperCase()}`

    if (method === 'pix' || method === 'debit') {
      const mpPayment = await createMercadoPagoPixPayment(mercadoPago, {
        amount,
        description,
        externalReference: payment.id,
        payerEmail,
      })

      const pix = extractMercadoPagoPixData(mpPayment)
      const gatewayPaymentId = String(mpPayment.id)

      await supabase
        .from('payments')
        .update({ asaas_payment_id: gatewayPaymentId })
        .eq('id', payment.id)

      return paymentOk({
        paymentId: payment.id,
        gatewayPaymentId,
        confirmationCode: '',
        pixQrCodeImage: pix.qrCodeBase64 ?? undefined,
        pixPayload: pix.copyPaste ?? undefined,
        status: 'pending',
      })
    }

    if (method === 'credit') {
      if (!cardToken) {
        return NextResponse.json({ error: 'Token do cartão é obrigatório.' }, { status: 400 })
      }

      const mpPayment = await createMercadoPagoCardPayment(mercadoPago, {
        amount,
        description,
        externalReference: payment.id,
        payerEmail,
        cardToken,
        installments: installmentCount,
        paymentMethodId,
      })

      const confirmed = isMercadoPagoPaymentApproved(mpPayment.status)
      const confirmationCode = confirmed ? generateConfirmationCode() : ''
      const gatewayPaymentId = String(mpPayment.id)

      await supabase
        .from('payments')
        .update({
          asaas_payment_id: gatewayPaymentId,
          status: confirmed ? 'paid' : 'processing',
          confirmation_code: confirmed ? confirmationCode : null,
          paid_at: confirmed ? new Date().toISOString() : null,
        })
        .eq('id', payment.id)

      if (confirmed) {
        const paidAt = new Date().toISOString()
        await applyCommissionToPayment(
          supabase,
          payment.id,
          session.restaurant_id,
          (restaurantData.plan_id as string | null) ?? null,
          amount,
          'credit',
          new Date(paidAt),
        )
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
        paymentId: payment.id,
        gatewayPaymentId,
        confirmationCode,
        status: confirmed ? 'paid' : 'pending',
        sessionClosed: settlement.closed,
      })
    }

    return NextResponse.json({ error: 'Método de pagamento inválido.' }, { status: 400 })
  } catch (err: unknown) {
    console.error('[Mercado Pago Payments Error]', err)
    const msg = err instanceof Error ? err.message : 'Erro interno.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** GET /api/mercadopago/payments?id=... — consulta status (polling PIX). */
export async function GET(req: NextRequest) {
  const internalId = req.nextUrl.searchParams.get('id')
  if (!internalId) {
    return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    const { data: payment } = await supabase
      .from('payments')
      .select('id, asaas_payment_id, status, confirmation_code, restaurant_id, session_id, customer_id, amount, service_fee_included, method')
      .eq('id', internalId)
      .single()

    if (!payment) {
      return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 })
    }

    if (payment.status === 'paid') {
      return NextResponse.json(payment)
    }

    if (payment.asaas_payment_id) {
      const { mercadoPago } = await resolvePaymentGateway(supabase, { id: payment.restaurant_id })
      if (mercadoPago) {
        const mpPayment = await getMercadoPagoPayment(mercadoPago, payment.asaas_payment_id)
        if (isMercadoPagoPaymentApproved(mpPayment.status)) {
          const { confirmPaymentRecord } = await import('@/lib/confirm-payment')
          const { confirmationCode } = await confirmPaymentRecord(supabase, {
            id: payment.id,
            session_id: payment.session_id,
            customer_id: payment.customer_id,
            restaurant_id: payment.restaurant_id,
            amount: Number(payment.amount),
            service_fee_included: payment.service_fee_included,
            status: payment.status,
            method: payment.method,
          })
          return NextResponse.json({
            id: payment.id,
            asaas_payment_id: payment.asaas_payment_id,
            status: 'paid',
            confirmation_code: confirmationCode,
          })
        }
      }
    }

    return NextResponse.json(payment)
  } catch (err) {
    console.error('[Mercado Pago GET Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
