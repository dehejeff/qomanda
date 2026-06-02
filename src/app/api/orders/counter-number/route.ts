import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { nextCounterDisplayNumber } from '@/lib/counter-orders'

/** Atribui número de balcão ao pedido (chamado após insert do cliente). */
export async function POST(req: NextRequest) {
  try {
    const { orderId, sessionId } = await req.json() as { orderId?: string; sessionId?: string }
    if (!orderId || !sessionId) {
      return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: session } = await admin
      .from('sessions')
      .select('restaurant_id, service_mode')
      .eq('id', sessionId)
      .single()

    if (!session || session.service_mode !== 'counter') {
      return NextResponse.json({ displayNumber: null })
    }

    const displayNumber = await nextCounterDisplayNumber(admin, session.restaurant_id)

    await admin.from('orders').update({
      display_number: displayNumber,
      order_channel: 'counter',
    }).eq('id', orderId)

    return NextResponse.json({ displayNumber })
  } catch (err) {
    console.error('[Order counter number]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
