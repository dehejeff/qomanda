import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { generateConfirmationCode } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Sem assinatura' }, { status: 400 })
  }

  let event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Webhook inválido' }, { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object
    const paymentId = intent.metadata?.payment_id

    if (paymentId) {
      const supabase = await createClient()
      const code = generateConfirmationCode()
      await supabase
        .from('payments')
        .update({ status: 'paid', confirmation_code: code, paid_at: new Date().toISOString() })
        .eq('id', paymentId)
    }
  }

  return NextResponse.json({ received: true })
}
