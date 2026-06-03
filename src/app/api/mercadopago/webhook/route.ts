import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getMercadoPagoPayment,
  isMercadoPagoPaymentApproved,
  isMercadoPagoPaymentRefunded,
} from '@/lib/mercadopago'
import { confirmPaymentRecord } from '@/lib/confirm-payment'
import { loadRestaurantGateway } from '@/lib/restaurant-gateway'

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

    if (isMercadoPagoPaymentApproved(mpPayment.status) && internalPayment.status !== 'paid') {
      const { confirmationCode } = await confirmPaymentRecord(supabase, {
        ...internalPayment,
        amount: Number(internalPayment.amount),
      })
      console.log(`[MP Webhook] Pagamento confirmado: ${internalPayment.id} → ${confirmationCode}`)
    }

    if (isMercadoPagoPaymentRefunded(mpPayment.status)) {
      await supabase.from('payments').update({ status: 'refunded' }).eq('id', internalPayment.id)
    }

    if (mpPayment.status === 'rejected' || mpPayment.status === 'cancelled') {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', internalPayment.id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Mercado Pago Webhook Error]', err)
    return NextResponse.json({ ok: true })
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
