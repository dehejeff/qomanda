import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
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

  // Caixa só acessa /dashboard/caixa — redireciona para lá se tentar outra rota
  if (access.role === 'caixa') {
    const pathname = (await headers()).get('x-pathname') ?? ''
    if (!pathname.startsWith('/dashboard/caixa')) {
      redirect('/dashboard/caixa')
    }
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
