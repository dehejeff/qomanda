import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getRestaurantAccess } from '@/lib/restaurant-auth'
import { KiComandaLogo } from '@/components/kicomanda-logo'

const ALLOWED = new Set(['owner', 'waiter', 'kitchen', 'manager'])

export default async function WaiterLayout({ children }: { children: React.ReactNode }) {
  const access = await getRestaurantAccess()
  if (!access || !ALLOWED.has(access.role)) redirect('/login?perfil=garcom')

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-outline-variant bg-surface-container flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-3">
          <KiComandaLogo size={28} />
          <div>
            <p className="text-sm font-bold text-on-surface">Garçom</p>
            <p className="text-[10px] font-mono text-on-surface-variant truncate max-w-[200px]">{access.restaurantName}</p>
          </div>
        </div>
        <nav className="flex items-center gap-2 text-xs font-mono">
          <Link href="/dashboard/waiter" className="px-3 py-2 rounded-lg hover:bg-surface-container-highest text-on-surface-variant">Pedidos</Link>
          <Link href="/dashboard/waiter/payments" className="px-3 py-2 rounded-lg hover:bg-surface-container-highest text-on-surface-variant">Pagamentos</Link>
          <Link href="/dashboard/waiter/tables" className="px-3 py-2 rounded-lg hover:bg-surface-container-highest text-on-surface-variant">Mesas</Link>
          <Link href="/login?perfil=garcom" className="px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10">Sair</Link>
        </nav>
      </header>
      <main className="pt-20 px-4 md:px-8 pb-8 min-h-screen max-w-5xl mx-auto">
        {children}
      </main>
    </div>
  )
}
