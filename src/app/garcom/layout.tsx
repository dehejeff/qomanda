import { redirect } from 'next/navigation'
import { getRestaurantAccess } from '@/lib/restaurant-auth'
import { WaiterAppShell } from '@/components/waiter/waiter-app-shell'

// kitchen usa /cozinha (KDS), não o app do garçom
const ALLOWED = new Set(['owner', 'waiter', 'manager', 'caixa', 'recepcionista'])

export default async function GarcomLayout({ children }: { children: React.ReactNode }) {
  const access = await getRestaurantAccess()
  if (!access || !ALLOWED.has(access.role)) {
    redirect('/login?perfil=garcom')
  }

  return (
    <WaiterAppShell role={access.role} restaurantName={access.restaurantName}>
      {children}
    </WaiterAppShell>
  )
}
