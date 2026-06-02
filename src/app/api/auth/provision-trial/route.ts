import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureRestaurantBilling } from '@/lib/internal-clients'
import { seedDefaultTablesForModel, type RestaurantModelId } from '@/lib/restaurant-models'

/**
 * POST /api/auth/provision-trial
 * Provisionou plano + trial de 14 dias para o restaurante do usuário autenticado.
 * Chamado logo após o cadastro.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const admin = createAdminClient()
    const { data: restaurant } = await admin
      .from('restaurants')
      .select('id, restaurant_model')
      .eq('owner_id', user.id)
      .single()

    if (!restaurant) return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 })

    await ensureRestaurantBilling(admin, restaurant.id, 'starter')

    if (restaurant.restaurant_model) {
      await seedDefaultTablesForModel(admin, restaurant.id, restaurant.restaurant_model as RestaurantModelId)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Provision trial]', err)
    return NextResponse.json({ error: 'Erro ao provisionar trial.' }, { status: 500 })
  }
}
