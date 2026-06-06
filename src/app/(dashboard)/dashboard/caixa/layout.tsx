import { redirect } from 'next/navigation'
import { requireRestaurantAccess } from '@/lib/restaurant-auth'

export default async function CaixaLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireRestaurantAccess(['owner', 'manager', 'caixa'])
  } catch {
    redirect('/login?perfil=admin')
  }
  return <>{children}</>
}
