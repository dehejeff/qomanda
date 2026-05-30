'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DEV_BYPASS } from '@/lib/dev-mock'

const NAV_ITEMS = [
  { href: '/dashboard',        icon: 'dashboard',        label: 'Overview' },
  { href: '/dashboard/orders', icon: 'receipt_long',     label: 'Pedidos' },
  { href: '/dashboard/menu',   icon: 'restaurant_menu',  label: 'Cardápio' },
  { href: '/dashboard/tables', icon: 'table_restaurant', label: 'Mesas' },
]

export function DashboardSidebar({ restaurantName }: { restaurantName: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    if (DEV_BYPASS) { router.push('/'); return }
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-[260px] bg-surface-container border-r border-outline-variant p-4 gap-base z-50">
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center text-on-primary-container flex-shrink-0">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>restaurant</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-primary leading-tight" style={{ fontFamily: 'Geist, sans-serif' }}>Qomanda</h1>
            <p className="text-[11px] text-on-surface-variant opacity-70 font-mono truncate max-w-[140px]">{restaurantName}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-grow">
          {NAV_ITEMS.map(({ href, icon, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                  active
                    ? 'bg-primary-container text-on-primary-container'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {icon}
                </span>
                <span className="text-sm font-medium font-mono">{label}</span>
              </Link>
            )
          })}

          <div className="mt-auto pt-4 border-t border-outline-variant">
            <Link
              href="/dashboard/settings"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                pathname === '/dashboard/settings'
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">settings</span>
              <span className="text-sm font-medium font-mono">Settings</span>
            </Link>
          </div>
        </nav>

        {/* New Order button */}
        <button className="mt-4 w-full py-3 bg-primary text-on-primary font-bold rounded-lg flex items-center justify-center gap-2 hover:brightness-110 transition-all text-sm font-mono">
          <span className="material-symbols-outlined text-[20px]">add</span>
          New Order
        </button>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-container border-t border-outline-variant flex">
        {NAV_ITEMS.map(({ href, icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium font-mono transition-colors ${
                active ? 'text-primary-container' : 'text-on-surface-variant'
              }`}
            >
              <span
                className="material-symbols-outlined text-[22px]"
                style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {icon}
              </span>
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
