import { NextResponse } from 'next/server'
import { requireWaiterAccess, RestaurantAuthError } from '@/lib/restaurant-auth'

/** Contexto do garçom autenticado (restaurant_id via service role — evita RLS em restaurant_members). */
export async function GET() {
  try {
    const access = await requireWaiterAccess()
    return NextResponse.json({
      restaurantId: access.restaurantId,
      restaurantName: access.restaurantName,
      role: access.role,
    })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Erro ao carregar contexto.' }, { status: 500 })
  }
}
