'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { QomandaLogo } from '@/components/qomanda-logo'

const NAV_ITEMS = [
  { href: '/internal',          icon: 'dashboard',   label: 'Overview' },
  { href: '/internal/clients',  icon: 'storefront',  label: 'Clientes' },
  { href: '/internal/clients/new', icon: 'person_add', label: 'Novo cliente' },
  { href: '/internal/billing',  icon: 'receipt_long', label: 'Cobrança' },
  { href: '/internal/support',  icon: 'support_agent', label: 'Suporte' },
  { href: '/internal/gateway',  icon: 'account_balance', label: 'Gateway Pay' },
  { href: '/internal/health',   icon: 'monitor_heart', label: 'Saúde' },
]

export function InternalSidebar({ staffEmail }: { staffEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/internal/login')
  }

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-[260px] bg-surface-container border-r border-outline-variant p-4 z-50">
      <div className="flex flex-col gap-1 px-2 mb-8">
        <div className="flex items-center gap-2.5">
          <QomandaLogo size={32} />
          <div>
            <h1 className="text-lg font-black text-on-surface leading-tight">Qomanda</h1>
            <p className="text-[10px] font-mono uppercase tracking-widest text-primary">Portal interno</p>
          </div>
        </div>
        <p className="text-[11px] text-on-surface-variant opacity-60 font-mono truncate pl-1">{staffEmail}</p>
      </div>

      <nav className="flex flex-col gap-1 flex-grow">
        {NAV_ITEMS.map(({ href, icon, label }) => {
          const active = (() => {
            if (href === '/internal') return pathname === '/internal'
            if (href === '/internal/clients/new') return pathname === href
            if (href === '/internal/clients') {
              return pathname === href || (pathname.startsWith('/internal/clients/') && pathname !== '/internal/clients/new')
            }
            if (href === '/internal/gateway') return pathname === href || pathname.startsWith('/internal/gateway/')
            if (href === '/internal/support') return pathname === href || pathname.startsWith('/internal/support/')
            return pathname === href
          })()
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                active
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]" style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {icon}
              </span>
              <span className="text-sm font-medium font-mono">{label}</span>
            </Link>
          )
        })}

        <div className="mt-auto pt-4 border-t border-outline-variant">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">logout</span>
            <span className="text-sm font-medium font-mono">Sair</span>
          </button>
        </div>
      </nav>
    </aside>
  )
}
