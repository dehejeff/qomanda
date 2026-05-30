'use client'

import { usePathname } from 'next/navigation'

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

  return (
    <header className="fixed top-0 right-0 w-full md:w-[calc(100%-260px)] h-16 flex justify-between items-center px-8 glass-effect z-40 border-b border-outline-variant">
      {/* Search */}
      <div className="flex items-center gap-4 flex-grow max-w-xl">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">search</span>
          <input
            className="w-full bg-surface-container-low border border-outline-variant rounded-full py-2 pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary-container transition-all font-mono"
            placeholder="Buscar pedidos, mesas…"
            type="text"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 text-on-surface-variant">
          <button className="hover:text-primary transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="hover:text-primary transition-colors">
            <span className="material-symbols-outlined">help</span>
          </button>
          <span className="h-4 w-px bg-outline-variant" />
          <div className="flex items-center gap-2 pl-2 border-l border-outline-variant">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-on-surface font-mono">{restaurantName}</p>
              <p className="text-[10px] uppercase tracking-wider text-primary font-bold font-mono">Gerente</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-sm font-black flex-shrink-0">
              {userInitials}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
