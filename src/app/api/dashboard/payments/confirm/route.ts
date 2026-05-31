import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { confirmPaymentRecord } from '@/lib/confirm-payment'
import { normalizePaymentAmount } from '@/lib/payment-db'

/**
 * POST /api/dashboard/payments/confirm
 * Restaurante confirma recebimento (ex.: dinheiro na mesa).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Faça login no painel.' }, { status: 401 })
    }

    const body = await req.json() as { paymentId?: string; receivedAmount?: number }
    const { paymentId, receivedAmount: rawReceived } = body

    if (!paymentId) {
      return NextResponse.json({ error: 'Pagamento inválido.' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: payment } = await admin
      .from('payments')
      .select('id, session_id, customer_id, restaurant_id, amount, service_fee_included, status, method')
      .eq('id', paymentId)
      .maybeSingle()

    if (!payment) {
      return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 })
    }

    if (payment.status === 'paid') {
      return NextResponse.json({ error: 'Pagamento já confirmado.' }, { status: 409 })
    }

    if (payment.status !== 'pending' && payment.status !== 'processing') {
      return NextResponse.json({ error: 'Este pagamento não pode ser confirmado.' }, { status: 400 })
    }

    const { data: restaurant } = await admin
      .from('restaurants')
      .select('id')
      .eq('id', payment.restaurant_id)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!restaurant) {
      return NextResponse.json({ error: 'Sem permissão para confirmar este pagamento.' }, { status: 403 })
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
    console.error('[Confirm Payment Error]', err)
    return NextResponse.json({ error: 'Erro ao confirmar pagamento.' }, { status: 500 })
  }
}
