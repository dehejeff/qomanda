import { getServerUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEV_BYPASS, mockRestaurant } from '@/lib/dev-mock'
import type { User } from '@supabase/supabase-js'

export type RestaurantRole = 'owner' | 'waiter' | 'kitchen' | 'manager'

export type OperationalMode = 'dine_in' | 'counter' | 'both'

export type RestaurantAccess = {
  user: User
  restaurantId: string
  restaurantName: string
  role: RestaurantRole
  isOwner: boolean
  operationalMode: OperationalMode
  restaurantModel: string | null
}

export class RestaurantAuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function getRestaurantAccess(): Promise<RestaurantAccess | null> {
  try {
    return await requireRestaurantAccess(['owner', 'waiter', 'kitchen', 'manager'])
  } catch {
    return null
  }
}

export async function requireRestaurantAccess(
  allowedRoles: RestaurantRole[],
): Promise<RestaurantAccess> {
  const { user } = await getServerUser()

  // Usuário real autenticado → SEMPRE resolve o restaurante real (mesmo em DEV_BYPASS).
  // Isso evita gravar em 'mock-restaurant-id' inexistente quando há login de verdade.
  if (user?.email) {
    const admin = createAdminClient()

    const { data: owned } = await admin
      .from('restaurants')
      .select('id, name, operational_mode, restaurant_model')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (owned) {
      const role: RestaurantRole = 'owner'
      if (!allowedRoles.includes(role)) {
        throw new RestaurantAuthError('Sem permissão para esta área.', 403)
      }
      return {
        user,
        restaurantId: owned.id,
        restaurantName: owned.name,
        role,
        isOwner: true,
        operationalMode: (owned.operational_mode as OperationalMode) ?? 'both',
        restaurantModel: owned.restaurant_model ?? null,
      }
    }

    const { data: member } = await admin
      .from('restaurant_members')
      .select('restaurant_id, role, user_id, restaurants ( name, operational_mode, restaurant_model )')
      .eq('email', user.email.toLowerCase())
      .eq('active', true)
      .maybeSingle()

    if (member) {
      const role = member.role as RestaurantRole
      if (!allowedRoles.includes(role)) {
        throw new RestaurantAuthError('Sem permissão para esta área.', 403)
      }
      if (!member.user_id) {
        await admin
          .from('restaurant_members')
          .update({ user_id: user.id })
          .eq('email', user.email.toLowerCase())
          .eq('restaurant_id', member.restaurant_id)
      }
      const rest = (Array.isArray(member.restaurants) ? member.restaurants[0] : member.restaurants) as
        { name?: string; operational_mode?: string; restaurant_model?: string } | null
      return {
        user,
        restaurantId: member.restaurant_id,
        restaurantName: rest?.name ?? 'Restaurante',
        role,
        isOwner: false,
        operationalMode: (rest?.operational_mode as OperationalMode) ?? 'both',
        restaurantModel: rest?.restaurant_model ?? null,
      }
    }

    // Logado mas sem restaurante vinculado: em DEV_BYPASS cai no mock abaixo; senão erro.
    if (!DEV_BYPASS) throw new RestaurantAuthError('Restaurante não encontrado.', 403)
  }

  // Sem login real → mock apenas para desenvolvimento local sem Supabase.
  if (DEV_BYPASS) {
    return {
      user: { id: 'dev-owner', email: 'dev@qomanda.local' } as User,
      restaurantId: mockRestaurant.id,
      restaurantName: mockRestaurant.name,
      role: 'owner',
      isOwner: true,
      operationalMode: 'both',
      restaurantModel: 'salao_balcao',
    }
  }

  throw new RestaurantAuthError('Não autenticado.', 401)
}

export async function requireOwnerAccess(): Promise<RestaurantAccess> {
  return requireRestaurantAccess(['owner', 'manager'])
}

export async function requireWaiterAccess(): Promise<RestaurantAccess> {
  return requireRestaurantAccess(['owner', 'waiter', 'manager'])
}
