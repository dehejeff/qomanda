import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/customer/favorites  { customerId, restaurantId }
 * DELETE /api/customer/favorites?customer=UUID&restaurant=UUID
 */
export async function POST(req: NextRequest) {
  const { customerId, restaurantId } = await req.json()

  if (!customerId || !restaurantId) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }

    const { error } = await supabase
      .from('customer_favorites')
      .upsert(
        { customer_id: customerId, restaurant_id: restaurantId },
        { onConflict: 'customer_id,restaurant_id' },
      )

    if (error) {
      console.error('[Favorites POST]', error)
      return NextResponse.json({ error: 'Erro ao favoritar.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, isFavorite: true })
  } catch (err) {
    console.error('[Favorites POST Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const customerId   = req.nextUrl.searchParams.get('customer')
  const restaurantId = req.nextUrl.searchParams.get('restaurant')

  if (!customerId || !restaurantId) {
    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    await supabase
      .from('customer_favorites')
      .delete()
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)

    return NextResponse.json({ success: true, isFavorite: false })
  } catch (err) {
    console.error('[Favorites DELETE Error]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
