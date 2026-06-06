import { getRestaurantAccess } from '@/lib/restaurant-auth'
import { KitchenDisplay } from '@/components/kitchen/kitchen-display'

export default async function CozinhaPage() {
  const access = await getRestaurantAccess()
  return (
    <KitchenDisplay
      restaurantName={access?.restaurantName ?? 'Cozinha'}
      role={access?.role ?? 'kitchen'}
    />
  )
}
