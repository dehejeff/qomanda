import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPaymentConfirmed, type AsaasPaymentStatus } from '@/lib/asaas'
import { generateConfirmationCode } from '@/lib/utils'
import { syncCloseRequestOnPayment } from '@/lib/sync-payment-close-request'

/**
 * POST /api/asaas/webhook
 *
 * Configura no Asaas Dashboard → Configurações → Notificações (Webhook):
 *   URL: https://SEU_DOMINIO.vercel.app/api/asaas/webhook
 *   Eventos: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_REFUNDED
 *
 * O Asaas não usa assinatura criptográfica por padrão (ao contrário do Stripe).
 * Valide pelo token configurado na variável ASAAS_WEBHOOK_TOKEN.
 */
export async function POST(req: NextRequest) {
  try {
    // Validação básica do token (opcional mas recomendada)
    const token = req.headers.get('asaas-access-token')
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN

    if (expectedToken && token !== expectedToken) {
      console.warn('[Asaas Webhook] Token inválido')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { event, payment } = body

    console.log(`[Asaas Webhook] Evento: ${event} | Payment: ${payment?.id}`)

    if (!event || !payment?.id) {
      return NextResponse.json({ ok: true }) // Ignora eventos malformados
    }

    const supabase = createAdminClient()

    // Busca o pagamento interno pelo asaas_payment_id
    const { data: internalPayment } = await supabase
      .from('payments')
      .select('id, status, session_id, customer_id, amount')
      .eq('asaas_payment_id', payment.id)
      .maybeSingle()

    if (!internalPayment) {
      // Pagamento não encontrado — pode ser de outro sistema ou webhook duplicado
      return NextResponse.json({ ok: true })
    }

    const asaasStatus: AsaasPaymentStatus = payment.status

    if (isPaymentConfirmed(asaasStatus) && internalPayment.status !== 'paid') {
      // Pagamento confirmado — gera código de validação e atualiza o registro
      const confirmationCode = generateConfirmationCode()

      await supabase
        .from('payments')
        .update({
          status:            'paid',
          confirmation_code: confirmationCode,
          paid_at:           new Date().toISOString(),
        })
        .eq('id', internalPayment.id)

      await syncCloseRequestOnPayment(
        supabase,
        internalPayment.session_id,
        internalPayment.customer_id,
        internalPayment.id,
        Number(internalPayment.amount),
      )

      console.log(`[Asaas Webhook] Pagamento confirmado: ${internalPayment.id} → código ${confirmationCode}`)
    }

    if (asaasStatus === 'REFUNDED' || asaasStatus === 'REFUND_REQUESTED') {
      await supabase
        .from('payments')
        .update({ status: 'refunded' })
        .eq('id', internalPayment.id)
    }

    if (asaasStatus === 'OVERDUE') {
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', internalPayment.id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Asaas Webhook Error]', err)
    // Retorna 200 para evitar que o Asaas reenvie o webhook em loop
    return NextResponse.json({ ok: true })
  }
}
