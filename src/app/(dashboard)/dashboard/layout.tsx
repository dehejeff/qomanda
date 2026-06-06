import { redirect } from 'next/navigation'
import { getRestaurantAccess } from '@/lib/restaurant-auth'
import OwnerDashboardLayout from './owner-layout'

const WAITER_ROLES = new Set(['waiter', 'kitchen'])

export default async function DashboardInnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const access = await getRestaurantAccess()
  if (!access) redirect('/login?perfil=admin')

  if (WAITER_ROLES.has(access.role)) {
    redirect('/garcom/pedidos')
  }

  return (
    <OwnerDashboardLayout
      restaurantId={access.restaurantId}
      restaurantName={access.restaurantName}
      userInitials={access.restaurantName.charAt(0).toUpperCase()}
      operationalMode={access.operationalMode}
      role={access.role}
    >
      {children}
    </OwnerDashboardLayout>
  )
}
