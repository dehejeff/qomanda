import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/orders/cancel
 * Permite ao cliente cancelar pedido ainda não confirmado pela cozinha (status pending).
 */
export async function POST(req: NextRequest) {
  let body: { orderId?: string; customerId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { orderId, customerId } = body
  if (!orderId || !customerId) {
    return NextResponse.json({ error: 'orderId e customerId são obrigatórios.' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    const { data: order } = await supabase
      .from('orders')
      .select('id, customer_id, status')
      .eq('id', orderId)
      .single()

    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    }

    if (order.customer_id !== customerId) {
      return NextResponse.json({ error: 'Pedido não pertence a este cliente.' }, { status: 403 })
    }

    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: 'Só é possível cancelar pedidos aguardando confirmação.' },
        { status: 409 },
      )
    }

    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', orderId)

    if (error) {
      return NextResponse.json({ error: 'Erro ao cancelar pedido.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
