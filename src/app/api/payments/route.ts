import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe, formatAmountForStripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const { session_id, amount, method } = await req.json()

    if (!session_id || !amount || !method) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: session } = await supabase
      .from('sessions')
      .select('restaurant_id')
      .eq('id', session_id)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        session_id,
        restaurant_id: session.restaurant_id,
        amount,
        method,
        status: 'processing',
      })
      .select()
      .single()

    if (paymentError || !payment) {
      return NextResponse.json({ error: 'Erro ao criar pagamento' }, { status: 500 })
    }

    if (method === 'credit') {
      const paymentIntent = await getStripe().paymentIntents.create({
        amount: formatAmountForStripe(amount),
        currency: 'brl',
        metadata: { payment_id: payment.id, session_id },
      })

      await supabase
        .from('payments')
        .update({ stripe_payment_intent_id: paymentIntent.id })
        .eq('id', payment.id)

      return NextResponse.json({
        payment_id: payment.id,
        client_secret: paymentIntent.client_secret,
      })
    }

    return NextResponse.json({ payment_id: payment.id })
  } catch (err) {
    console.error('[payments]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
