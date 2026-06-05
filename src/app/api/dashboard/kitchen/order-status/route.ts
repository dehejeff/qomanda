import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRestaurantAccess, RestaurantAuthError } from '@/lib/restaurant-auth'

const VALID = new Set(['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'])

/**
 * POST /api/dashboard/kitchen/order-status  { orderId, status }
 * Avança o status do pedido pela cozinha/garçom. Autoriza por papel (inclui
 * 'kitchen') e usa admin client — a RLS de orders só permite o dono no UPDATE,
 * então a mudança de status pela equipe precisa passar por aqui.
 */
export async function POST(req: NextRequest) {
  try {
    const access = await requireRestaurantAccess(['owner', 'manager', 'waiter', 'kitchen'])
    const { orderId, status } = await req.json() as { orderId?: string; status?: string }

    if (!orderId || !status || !VALID.has(status)) {
      return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: order } = await admin
      .from('orders')
      .select('id, restaurant_id')
      .eq('id', orderId)
      .maybeSingle()

    if (!order || order.restaurant_id !== access.restaurantId) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    }

    const { error } = await admin.from('orders').update({ status }).eq('id', orderId)
    if (error) {
      return NextResponse.json({ error: 'Erro ao atualizar status.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, status })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[kitchen order-status]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
