'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Props = {
  slug: string
  sessionId: string
}

const NAV_ITEMS = [
  { id: 'home',     segment: 'home',     icon: 'home',                  label: 'Início'    },
  { id: 'menu',     segment: 'menu',     icon: 'restaurant_menu',       label: 'Cardápio'  },
  { id: 'orders',   segment: 'orders',   icon: 'list_alt',              label: 'Pedidos'   },
  { id: 'checkout', segment: 'checkout', icon: 'account_balance_wallet', label: 'Pagamento' },
  { id: 'profile',  segment: 'profile',  icon: 'person',                label: 'Perfil'    },
] as const

export function CustomerBottomNav({ slug, sessionId }: Props) {
  const pathname = usePathname()

  function href(segment: string) {
    return `/${slug}/${segment}?session=${sessionId}`
  }

  function isActive(segment: string) {
    return pathname.endsWith(`/${segment}`) || pathname.includes(`/${segment}?`)
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center h-20 px-2"
      style={{ background: '#131b2e', borderTop: '1px solid rgba(88,66,55,0.35)' }}
    >
      {NAV_ITEMS.map(({ id, segment, icon, label }) => {
        const active = isActive(segment)
        return (
          <Link
            key={id}
            href={href(segment)}
            className={`flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90 ${
              active
                ? 'bg-primary-container text-on-primary-container rounded-xl px-3 py-1.5'
                : 'text-on-surface-variant p-2 rounded-xl'
            }`}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {icon}
            </span>
            <span className="text-[10px] font-mono">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
