import { NextRequest, NextResponse, after } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPaymentConfirmed, type AsaasPaymentStatus } from '@/lib/asaas'
import { getAsaasConfig } from '@/lib/asaas-config'
import { confirmPaymentRecord } from '@/lib/confirm-payment'
import { claimWebhookEvent, finishWebhookEvent } from '@/lib/webhook-idempotency'
import { captureError } from '@/lib/observability'

/**
 * POST /api/asaas/webhook
 *
 * Configura no Asaas Dashboard → Configurações → Notificações (Webhook):
 *   URL: https://SEU_DOMINIO.vercel.app/api/asaas/webhook
 *   Eventos: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_REFUNDED
 *
 * O Asaas não usa assinatura criptográfica por padrão (ao contrário do Stripe).
 * Valide pelo token configurado na variável ASAAS_WEBHOOK_TOKEN.
 *
 * Fluxo: valida → reivindica idempotência → **responde 200 rápido** → processa
 * o trabalho pesado (NF-e, WhatsApp, comissão) em `after()`, na mesma invocação,
 * sem segurar a resposta ao gateway (evita timeout/retry do Asaas).
 */
export async function POST(req: NextRequest) {
  try {
    // Validação básica do token (opcional mas recomendada)
    const token = req.headers.get('asaas-access-token')
    const config = await getAsaasConfig()
    const expectedToken = config.webhookToken

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

    // Idempotência: dedupe por (pagamento + status). Entregas repetidas do mesmo
    // estado são ignoradas; transições (pending→received) ainda processam.
    const eventId = String(body.id ?? `${event}:${payment.id}:${payment.status}`)
    const claim = await claimWebhookEvent(supabase, {
      provider: 'asaas',
      eventId,
      eventType: event,
      payload: body,
    })
    if (!claim.proceed) {
      return NextResponse.json({ ok: true, duplicate: true })
    }
    const eventRowId = claim.eventRowId

    // Processa o trabalho pesado APÓS responder 200 (mesma invocação na Vercel).
    after(async () => {
      try {
        await processAsaasEvent(supabase, payment, eventRowId)
      } catch (err) {
        console.error('[Asaas Webhook] erro no processamento diferido', err)
        await captureError(err, { scope: 'webhook:asaas' })
        try {
          await finishWebhookEvent(supabase, eventRowId, 'error', err instanceof Error ? err.message : String(err))
        } catch { /* ignore */ }
      }
    })

    return NextResponse.json({ ok: true, queued: true })
  } catch (err) {
    console.error('[Asaas Webhook Error]', err)
    await captureError(err, { scope: 'webhook:asaas' })
    // Retorna 200 para evitar que o Asaas reenvie o webhook em loop
    return NextResponse.json({ ok: true })
  }
}

/** Processamento idempotente do evento (roda em `after`, fora do caminho da resposta). */
async function processAsaasEvent(
  supabase: SupabaseClient,
  payment: { id: string; status: AsaasPaymentStatus },
  eventRowId: string | null,
) {
  // Busca o pagamento interno pelo asaas_payment_id
  const { data: internalPayment } = await supabase
    .from('payments')
    .select('id, status, session_id, customer_id, restaurant_id, amount, service_fee_included')
    .eq('asaas_payment_id', payment.id)
    .maybeSingle()

  if (!internalPayment) {
    // Pode ser uma cobrança de MENSALIDADE (fatura SaaS KiComanda → restaurante)
    const { data: invoice } = await supabase
      .from('billing_invoices')
      .select('id, status')
      .eq('asaas_payment_id', payment.id)
      .maybeSingle()

    if (invoice) {
      const st: AsaasPaymentStatus = payment.status
      if (isPaymentConfirmed(st) && invoice.status !== 'paid') {
        await supabase.from('billing_invoices')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', invoice.id)
        console.log(`[Asaas Webhook] Mensalidade paga: fatura ${invoice.id}`)
        // Emite a NF-e de serviço (KiComanda → restaurante) — degradável/idempotente.
        const { emitServiceNfeForInvoice } = await import('@/lib/nfe/emit-service-nfe')
        await emitServiceNfeForInvoice(supabase, invoice.id, { requirePaid: true })
      } else if (st === 'OVERDUE') {
        await supabase.from('billing_invoices').update({ status: 'overdue' }).eq('id', invoice.id)
      } else if (st === 'REFUNDED' || st === 'REFUND_REQUESTED') {
        await supabase.from('billing_invoices').update({ status: 'cancelled' }).eq('id', invoice.id)
      }
    }
    await finishWebhookEvent(supabase, eventRowId, 'processed')
    return
  }

  const asaasStatus: AsaasPaymentStatus = payment.status

  if (isPaymentConfirmed(asaasStatus) && internalPayment.status !== 'paid') {
    const { confirmationCode } = await confirmPaymentRecord(supabase, {
      ...internalPayment,
      method: 'pix',
      amount: Number(internalPayment.amount),
    })
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

  await finishWebhookEvent(supabase, eventRowId, 'processed')
}
