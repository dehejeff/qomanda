import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { confirmPaymentRecord } from '@/lib/confirm-payment'
import { normalizePaymentAmount } from '@/lib/payment-db'
import { requireWaiterAccess, RestaurantAuthError } from '@/lib/restaurant-auth'

function isManualConfirmMethod(method: string, asaasPaymentId: string | null | undefined): boolean {
  return method === 'cash' || (method === 'pix' && !asaasPaymentId)
}

/**
 * POST /api/dashboard/payments/confirm
 * Restaurante confirma recebimento (dinheiro ou PIX manual).
 * Owner, manager e garçom — garçom só confirma cash / PIX manual.
 */
export async function POST(req: NextRequest) {
  try {
    const access = await requireWaiterAccess()

    const body = await req.json() as { paymentId?: string; receivedAmount?: number }
    const { paymentId, receivedAmount: rawReceived } = body

    if (!paymentId) {
      return NextResponse.json({ error: 'Pagamento inválido.' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: payment } = await admin
      .from('payments')
      .select('id, session_id, customer_id, restaurant_id, amount, service_fee_included, status, method, asaas_payment_id')
      .eq('id', paymentId)
      .maybeSingle()

    if (!payment) {
      return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 })
    }

    if (payment.restaurant_id !== access.restaurantId) {
      return NextResponse.json({ error: 'Sem permissão para confirmar este pagamento.' }, { status: 403 })
    }

    if ((access.role === 'waiter' || access.role === 'caixa') && !isManualConfirmMethod(payment.method, payment.asaas_payment_id)) {
      return NextResponse.json({ error: 'Garçom e caixa só confirmam dinheiro ou PIX manual.' }, { status: 403 })
    }

    if (payment.status === 'paid') {
      return NextResponse.json({ error: 'Pagamento já confirmado.' }, { status: 409 })
    }

    if (payment.status !== 'pending' && payment.status !== 'processing') {
      return NextResponse.json({ error: 'Este pagamento não pode ser confirmado.' }, { status: 400 })
    }

    let finalAmount = Number(payment.amount)

    if (rawReceived != null) {
      const received = normalizePaymentAmount(rawReceived)
      if (!received) {
        return NextResponse.json({ error: 'Valor recebido inválido.' }, { status: 400 })
      }
      finalAmount = received

      if (Math.abs(received - Number(payment.amount)) > 0.001) {
        const { error: amountErr } = await admin
          .from('payments')
          .update({ amount: received })
          .eq('id', paymentId)
          .in('status', ['pending', 'processing'])

        if (amountErr) {
          return NextResponse.json({ error: 'Erro ao ajustar valor.' }, { status: 500 })
        }
      }
    }

    const result = await confirmPaymentRecord(admin, {
      ...payment,
      amount: finalAmount,
    })

    return NextResponse.json({
      ok: true,
      confirmationCode: result.confirmationCode,
      sessionClosed: result.sessionClosed,
    })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Confirm Payment Error]', err)
    return NextResponse.json({ error: 'Erro ao confirmar pagamento.' }, { status: 500 })
  }
}
