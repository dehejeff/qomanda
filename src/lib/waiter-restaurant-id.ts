import type { SupabaseClient } from '@supabase/supabase-js'

/** Resolve restaurant_id for owner or team member (garçom, cozinha, etc.). */
export async function resolveWaiterRestaurantId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (restaurant?.id) return restaurant.id

  if (!user.email) return null

  const { data: member } = await supabase
    .from('restaurant_members')
    .select('restaurant_id')
    .eq('email', user.email.toLowerCase())
    .eq('active', true)
    .maybeSingle()

  return member?.restaurant_id ?? null
}
