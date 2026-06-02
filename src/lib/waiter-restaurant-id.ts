'use client'

import { createClient } from '@/lib/supabase/client'

let cachedRestaurantId: string | null = null
let cacheUserId: string | null = null

/** Resolve restaurant_id for owner or team member (garçom, cozinha, etc.). */
export async function resolveWaiterRestaurantId(
  supabase: ReturnType<typeof createClient>,
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  if (cacheUserId === user.id && cachedRestaurantId) {
    return cachedRestaurantId
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (restaurant?.id) {
    cachedRestaurantId = restaurant.id
    cacheUserId = user.id
    return restaurant.id
  }

  if (user.email) {
    const { data: member } = await supabase
      .from('restaurant_members')
      .select('restaurant_id')
      .eq('email', user.email.toLowerCase())
      .eq('active', true)
      .maybeSingle()

    if (member?.restaurant_id) {
      cachedRestaurantId = member.restaurant_id
      cacheUserId = user.id
      return member.restaurant_id
    }
  }

  try {
    const res = await fetch('/api/dashboard/waiter/me')
    if (res.ok) {
      const json = await res.json() as { restaurantId?: string }
      if (json.restaurantId) {
        cachedRestaurantId = json.restaurantId
        cacheUserId = user.id
        return json.restaurantId
      }
    }
  } catch {
    /* ignore */
  }

  return null
}
