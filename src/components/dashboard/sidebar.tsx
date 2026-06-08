'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DEV_BYPASS } from '@/lib/dev-mock'
import { QomandaLogo } from '@/components/qomanda-logo'

type OperationalMode = 'dine_in' | 'counter' | 'both'

// `modes` = em quais tipos de restaurante o item aparece. Ausente = sempre.
const NAV_ITEMS: { href: string; icon: string; label: string; modes?: OperationalMode[] }[] = [
  { href: '/dashboard',           icon: 'dashboard',        label: 'Overview' },
  { href: '/dashboard/reports',   icon: 'analytics',        label: 'Analytics' },
  { href: '/dashboard/orders',    icon: 'receipt_long',     label: 'Pedidos' },
  { href: '/dashboard/caixa',     icon: 'point_of_sale',    label: 'Caixa' },
  { href: '/dashboard/customers',   icon: 'groups',           label: 'Clientes' },
  { href: '/dashboard/menu',        icon: 'restaurant_menu',  label: 'Cardápio' },
  // Mesas só faz sentido para salão (dine_in) e salão+balcão (both); balcão puro não tem mesas.
  { href: '/dashboard/tables',      icon: 'table_restaurant', label: 'Mesas', modes: ['dine_in', 'both'] },
  { href: '/dashboard/fila',        icon: 'deck',             label: 'Fila', modes: ['dine_in', 'both'] },
]

// Itens visíveis para o perfil caixa (acesso restrito)
const CAIXA_HREFS = new Set(['/dashboard/caixa'])

export function DashboardSidebar({
  restaurantName,
  operationalMode = 'both',
  role = 'owner',
}: {
  restaurantName: string
  operationalMode?: OperationalMode
  role?: string
}) {
  const pathname = usePathname()
  const router = useRouter()

  const isCaixa = role === 'caixa'
  const navItems = NAV_ITEMS.filter(item =>
    (!item.modes || item.modes.includes(operationalMode)) &&
    (!isCaixa || CAIXA_HREFS.has(item.href)),
  )

  async function handleLogout() {
    if (DEV_BYPASS) { router.push('/'); return }
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login?perfil=admin')
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-[260px] bg-surface-container border-r border-outline-variant p-4 gap-base z-50">
        {/* Logo */}
        <div className="flex flex-col gap-1 px-2 mb-8">
          <div className="flex items-center gap-2.5">
            <QomandaLogo size={32} />
            <h1 className="text-xl font-black text-on-surface leading-tight" style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}>Qomanda</h1>
          </div>
          <p className="text-[11px] text-on-surface-variant opacity-60 font-mono truncate pl-1">{restaurantName}</p>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-grow">
          {navItems.map(({ href, icon, label }) => {
            const active = href === '/dashboard'
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`)
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

          <div className="mt-auto pt-4 border-t border-outline-variant space-y-1">
            <Link
              href="/dashboard/support"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                pathname === '/dashboard/support' || pathname.startsWith('/dashboard/support/')
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">support_agent</span>
              <span className="text-sm font-medium font-mono">Suporte</span>
            </Link>
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
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 text-on-surface-variant hover:text-red-400 hover:bg-red-500/10"
            >
              <span className="material-symbols-outlined text-[22px]">logout</span>
              <span className="text-sm font-medium font-mono">Sair</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-container border-t border-outline-variant flex">
        {navItems.map(({ href, icon, label }) => {
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
