'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DEV_BYPASS } from '@/lib/dev-mock'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':          'Overview',
  '/dashboard/orders':   'Pedidos',
  '/dashboard/menu':     'Cardápio',
  '/dashboard/tables':   'Mesas',
  '/dashboard/settings': 'Settings',
}

export function DashboardHeader({
  restaurantName,
  userInitials,
}: {
  restaurantName: string
  userInitials: string
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    if (DEV_BYPASS) { router.push('/'); return }
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login?perfil=admin')
  }

  return (
    <header className="fixed top-0 right-0 w-full md:w-[calc(100%-260px)] h-16 flex justify-between items-center px-4 md:px-8 glass-effect z-40 border-b border-outline-variant">
      <div className="flex items-center gap-4 flex-grow max-w-xl min-w-0">
        <p className="md:hidden text-sm font-semibold text-on-surface truncate font-mono">
          {PAGE_TITLES[pathname] ?? 'Painel'}
        </p>
        <div className="relative w-full hidden md:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">search</span>
          <input
            className="w-full bg-surface-container-low border border-outline-variant rounded-full py-2 pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary-container transition-all font-mono"
            placeholder="Buscar pedidos, mesas…"
            type="text"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6 shrink-0">
        <div className="hidden sm:flex items-center gap-4 text-on-surface-variant">
          <button type="button" className="hover:text-primary transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button type="button" className="hover:text-primary transition-colors">
            <span className="material-symbols-outlined">help</span>
          </button>
        </div>
        <span className="hidden sm:block h-4 w-px bg-outline-variant" />
        <div className="flex items-center gap-2 md:gap-3">
          <div className="text-right hidden lg:block">
            <p className="text-sm font-medium text-on-surface font-mono">{restaurantName}</p>
            <p className="text-[10px] uppercase tracking-wider text-primary font-bold font-mono">Gerente</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-sm font-black flex-shrink-0">
            {userInitials}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Sair do painel"
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span className="hidden md:inline text-xs font-mono font-medium">Sair</span>
          </button>
        </div>
      </div>
    </header>
  )
}
