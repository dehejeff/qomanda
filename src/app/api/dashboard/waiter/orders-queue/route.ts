import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireWaiterAccess, RestaurantAuthError } from '@/lib/restaurant-auth'

export async function GET() {
  try {
    const access = await requireWaiterAccess()
    const admin = createAdminClient()

    const { data } = await admin
      .from('orders')
      .select(`
        id, status, display_number, order_channel, created_at,
        customer:customers ( first_name, last_name ),
        session:sessions ( table:tables ( number ) ),
        items:order_items ( quantity, notes, menu_item:menu_items ( name ) )
      `)
      .eq('restaurant_id', access.restaurantId)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: true })
      .limit(50)

    return NextResponse.json({ orders: data ?? [] })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Erro ao carregar pedidos.' }, { status: 500 })
  }
}
