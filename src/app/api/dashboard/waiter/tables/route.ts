import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRestaurantAccess, RestaurantAuthError } from '@/lib/restaurant-auth'

export async function GET() {
  try {
    // Leitura do status das mesas — inclui recepcionista (vê disponibilidade p/ a fila).
    const access = await requireRestaurantAccess(['owner', 'waiter', 'manager', 'caixa', 'recepcionista'])
    const admin = createAdminClient()

    const { data: sessions } = await admin
      .from('sessions')
      .select('table_id, status')
      .eq('restaurant_id', access.restaurantId)
      .eq('status', 'closing')

    const closingIds = new Set((sessions ?? []).map(s => s.table_id))

    const { data: tables } = await admin
      .from('tables')
      .select('id, number, status')
      .eq('restaurant_id', access.restaurantId)
      .neq('number', 'BALCAO')
      .order('number')

    const rows = (tables ?? []).map(t => ({
      id: t.id,
      number: t.number,
      status: closingIds.has(t.id) ? 'closing' : t.status,
    }))

    return NextResponse.json({ tables: rows })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Erro ao carregar mesas.' }, { status: 500 })
  }
}
