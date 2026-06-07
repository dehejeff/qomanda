import { NextRequest, NextResponse, after } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getMercadoPagoPayment,
  isMercadoPagoPaymentApproved,
  isMercadoPagoPaymentRefunded,
} from '@/lib/mercadopago'
import { confirmPaymentRecord, type PaymentConfirmRow } from '@/lib/confirm-payment'
import { loadRestaurantGateway } from '@/lib/restaurant-gateway'
import { claimWebhookEvent, finishWebhookEvent } from '@/lib/webhook-idempotency'
import { captureError } from '@/lib/observability'

/**
 * POST /api/mercadopago/webhook
 *
 * Configure em Mercado Pago → Suas integrações → Webhooks:
 *   URL: https://SEU_DOMINIO/api/mercadopago/webhook
 *   Eventos: Pagamentos
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as {
      type?: string
      action?: string
      data?: { id?: string | number }
    } | null

    const paymentId =
      body?.data?.id
      ?? req.nextUrl.searchParams.get('data.id')
      ?? req.nextUrl.searchParams.get('id')

    if (!paymentId) {
      return NextResponse.json({ ok: true })
    }

    const gatewayPaymentId = String(paymentId)
    const supabase = createAdminClient()

    const { data: internalPayment } = await supabase
      .from('payments')
      .select('id, status, session_id, customer_id, restaurant_id, amount, service_fee_included, method')
      .eq('asaas_payment_id', gatewayPaymentId)
      .maybeSingle()

    if (!internalPayment) {
      return NextResponse.json({ ok: true })
    }

    const gateway = await loadRestaurantGateway(supabase, internalPayment.restaurant_id)
    if (!gateway.apiKey || gateway.provider !== 'mercado_pago') {
      return NextResponse.json({ ok: true })
    }

    const mpPayment = await getMercadoPagoPayment(
      { accessToken: gateway.apiKey, environment: gateway.environment },
      gatewayPaymentId,
    )

    // Idempotência: dedupe por (pagamento + status atual). Transições reais
    // (pending→approved) processam; entregas repetidas do mesmo estado, não.
    const claim = await claimWebhookEvent(supabase, {
      provider: 'mercado_pago',
      eventId: `${gatewayPaymentId}:${mpPayment.status}`,
      eventType: body?.action ?? body?.type ?? 'payment',
      payload: { body, mpStatus: mpPayment.status },
    })
    if (!claim.proceed) {
      return NextResponse.json({ ok: true, duplicate: true })
    }

    const eventRowId = claim.eventRowId
    const mpStatus = mpPayment.status

    // Processa o trabalho pesado (NF-e, WhatsApp, comissão) APÓS responder 200,
    // na mesma invocação — não segura a resposta ao Mercado Pago.
    after(async () => {
      try {
        await processMercadoPagoEvent(supabase, internalPayment as PaymentConfirmRow, mpStatus)
        await finishWebhookEvent(supabase, eventRowId, 'processed')
      } catch (procErr) {
        console.error('[MP Webhook] erro no processamento diferido', procErr)
        await captureError(procErr, { scope: 'webhook:mercado_pago' })
        try {
          await finishWebhookEvent(supabase, eventRowId, 'error', procErr instanceof Error ? procErr.message : String(procErr))
        } catch { /* ignore */ }
      }
    })

    return NextResponse.json({ ok: true, queued: true })
  } catch (err) {
    console.error('[Mercado Pago Webhook Error]', err)
    await captureError(err, { scope: 'webhook:mercado_pago' })
    return NextResponse.json({ ok: true })
  }
}

/** Aplica a transição de status do pagamento (roda em `after`, fora da resposta). */
async function processMercadoPagoEvent(
  supabase: SupabaseClient,
  internalPayment: PaymentConfirmRow,
  mpStatus: string,
) {
  if (isMercadoPagoPaymentApproved(mpStatus) && internalPayment.status !== 'paid') {
    const { confirmationCode } = await confirmPaymentRecord(supabase, {
      ...internalPayment,
      amount: Number(internalPayment.amount),
    })
    console.log(`[MP Webhook] Pagamento confirmado: ${internalPayment.id} → ${confirmationCode}`)
  }

  if (isMercadoPagoPaymentRefunded(mpStatus)) {
    await supabase.from('payments').update({ status: 'refunded' }).eq('id', internalPayment.id)
  }

  if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
    await supabase.from('payments').update({ status: 'failed' }).eq('id', internalPayment.id)
  }
}

export async function GET(req: NextRequest) {
  // IPN legado: ?topic=payment&id=123
  const topic = req.nextUrl.searchParams.get('topic')
  const id = req.nextUrl.searchParams.get('id')
  if (topic === 'payment' && id) {
    const fakeReq = new NextRequest(req.url, {
      method: 'POST',
      body: JSON.stringify({ type: 'payment', data: { id } }),
    })
    return POST(fakeReq)
  }
  return NextResponse.json({ ok: true })
}
