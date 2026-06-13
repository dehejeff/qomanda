import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRestaurantAccess, RestaurantAuthError } from '@/lib/restaurant-auth'
import { cancelOrderByStaff, cancelOrderItemByStaff } from '@/lib/staff-order-cancel'

const STAFF = ['owner', 'manager', 'waiter', 'caixa'] as const

/**
 * POST /api/dashboard/orders/cancel
 * Remove item ou pedido inteiro da conta (qualidade / acordo). Sai do checkout.
 * Body: { orderItemId?: string; orderId?: string; quantity?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const access = await requireRestaurantAccess([...STAFF])
    const body = await req.json() as { orderItemId?: string; orderId?: string; quantity?: number }
    const admin = createAdminClient()

    if (body.orderItemId) {
      const result = await cancelOrderItemByStaff(
        admin,
        access.restaurantId,
        body.orderItemId,
        body.quantity ?? 1,
      )
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
      return NextResponse.json({ ok: true, scope: 'item' })
    }

    if (body.orderId) {
      const result = await cancelOrderByStaff(admin, access.restaurantId, body.orderId)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
      return NextResponse.json({ ok: true, scope: 'order' })
    }

    return NextResponse.json({ error: 'Informe orderItemId ou orderId.' }, { status: 400 })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[dashboard orders cancel]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
