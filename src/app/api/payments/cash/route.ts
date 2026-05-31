import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  normalizePaymentAmount,
  paymentInsertErrorMessage,
  resolvePaymentCustomerId,
} from '@/lib/payment-db'

export type CashPaymentRequest = {
  sessionId: string
  amount: number
  splitType?: 'food' | 'alcohol' | 'combined'
  customerId?: string | null
  serviceFeeIncluded?: boolean
}

export type CashPaymentResponse = {
  paymentId: string
  status: 'pending'
  amount: number
}

/**
 * POST /api/payments/cash
 * Cliente informa que pagará em dinheiro — aguarda confirmação do restaurante.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as CashPaymentRequest
    const {
      sessionId,
      amount: rawAmount,
      splitType = 'combined',
      customerId: bodyCustomerId,
      serviceFeeIncluded = true,
    } = body

    const amount = normalizePaymentAmount(rawAmount)
    if (!sessionId || !amount) {
      return NextResponse.json({ error: 'Sessão ou valor inválido.' }, { status: 400 })
    }

    if (splitType !== 'combined') {
      return NextResponse.json({
        error: 'Pagamento em dinheiro só está disponível para a conta completa (sem split alimentação/bebida).',
      }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: session } = await supabase
      .from('sessions')
      .select('customer_id, restaurant_id, status')
      .eq('id', sessionId)
      .single()

    if (!session || session.status === 'closed') {
      return NextResponse.json({ error: 'Sessão inválida ou encerrada.' }, { status: 404 })
    }

    const payerCustomerId = await resolvePaymentCustomerId(
      supabase,
      bodyCustomerId ?? session.customer_id,
    )

    if (!payerCustomerId) {
      return NextResponse.json({ error: 'Cliente não identificado. Faça check-in novamente.' }, { status: 400 })
    }

    // Substitui solicitação em dinheiro pendente anterior do mesmo cliente nesta sessão
    await supabase
      .from('payments')
      .update({ status: 'failed' })
      .eq('session_id', sessionId)
      .eq('customer_id', payerCustomerId)
      .eq('method', 'cash')
      .eq('status', 'pending')

    const { data: payment, error: pmtError } = await supabase
      .from('payments')
      .insert({
        session_id: sessionId,
        restaurant_id: session.restaurant_id,
        customer_id: payerCustomerId,
        amount,
        method: 'cash',
        split_type: splitType,
        service_fee_included: serviceFeeIncluded,
        status: 'pending',
      })
      .select('id, amount')
      .single()

    if (pmtError || !payment) {
      console.error('[Cash payment insert]', pmtError)
      return NextResponse.json({ error: paymentInsertErrorMessage(pmtError) }, { status: 500 })
    }

    return NextResponse.json({
      paymentId: payment.id,
      status: 'pending',
      amount: Number(payment.amount),
    } satisfies CashPaymentResponse)
  } catch (err) {
    console.error('[Cash Payment Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/**
 * DELETE /api/payments/cash?paymentId=...&customerId=...
 * Cliente cancela solicitação de pagamento em dinheiro ainda pendente.
 */
export async function DELETE(req: NextRequest) {
  try {
    const paymentId = req.nextUrl.searchParams.get('paymentId')
    const customerId = req.nextUrl.searchParams.get('customerId')

    if (!paymentId || !customerId) {
      return NextResponse.json({ error: 'Pagamento inválido.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: payment } = await supabase
      .from('payments')
      .select('id, customer_id, method, status')
      .eq('id', paymentId)
      .maybeSingle()

    if (!payment) {
      return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 })
    }

    if (payment.customer_id !== customerId) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    if (payment.method !== 'cash' || payment.status !== 'pending') {
      return NextResponse.json({ error: 'Este pagamento não pode ser cancelado.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('payments')
      .update({ status: 'failed' })
      .eq('id', paymentId)
      .eq('status', 'pending')

    if (error) {
      return NextResponse.json({ error: 'Erro ao cancelar.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Cash Payment Cancel Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
