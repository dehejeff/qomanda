'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useWaiterPendingCount } from './use-waiter-pending-count'
import { useWaiterLoyaltyCount } from './use-waiter-loyalty-count'

type Tab = 'pedidos' | 'pagamentos' | 'pedir' | 'beneficios' | 'mesas'

function resolveTab(pathname: string): Tab {
  if (pathname.startsWith('/garcom/pagamentos')) return 'pagamentos'
  if (pathname.startsWith('/garcom/pedidos')) return 'pedidos'   // deve vir antes de /pedido
  if (pathname.startsWith('/garcom/pedido')) return 'pedir'
  if (pathname.startsWith('/garcom/beneficios')) return 'beneficios'
  if (pathname.startsWith('/garcom/mesas')) return 'mesas'
  return 'pedidos'
}

export function WaiterBottomNav({ showPayments = true }: { showPayments?: boolean }) {
  const pathname = usePathname()
  const current = resolveTab(pathname)
  const pendingCount = useWaiterPendingCount()
  const loyaltyCount = useWaiterLoyaltyCount()

  const itemStyle = (id: Tab) => ({
    color: current === id ? '#ffb690' : '#e0c0b1',
  })

  const iconStyle = (id: Tab) =>
    current === id ? { fontVariationSettings: "'FILL' 1", color: '#f97316' } as const : undefined

  const navItem = (id: Tab, href: string, icon: string, label: string, badge?: number) => (
    <Link
      key={id}
      href={href}
      className="relative flex flex-col items-center gap-0.5 p-1.5 rounded-xl min-w-[56px] flex-1 active:scale-95 transition-transform"
      style={itemStyle(id)}
    >
      <span className="material-symbols-outlined text-[22px]" style={iconStyle(id)}>{icon}</span>
      <span className="text-[9px] font-mono font-bold leading-tight text-center">{label}</span>
      {badge != null && badge > 0 && (
        <span
          className="absolute top-0 right-1 min-w-[16px] h-[16px] px-0.5 rounded-full flex items-center justify-center text-[8px] font-bold font-mono"
          style={{ background: '#f97316', color: '#582200' }}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  )

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center h-[72px] px-1 max-w-lg mx-auto"
      style={{ background: '#171f33', borderTop: '1px solid rgba(88,66,55,0.4)' }}
    >
      {navItem('pedidos', '/garcom/pedidos', 'receipt_long', 'Pedidos', pendingCount > 0 ? pendingCount : undefined)}
      {showPayments && navItem('pagamentos', '/garcom/pagamentos', 'payments', 'Pagamentos', pendingCount > 0 && current !== 'pagamentos' ? pendingCount : undefined)}
      {showPayments && navItem('pedir', '/garcom/pedido', 'restaurant_menu', 'Pedir')}
      {navItem('beneficios', '/garcom/beneficios', 'redeem', 'Benefícios', loyaltyCount > 0 ? loyaltyCount : undefined)}
      {navItem('mesas', '/garcom/mesas', 'table_restaurant', 'Mesas')}
    </nav>
  )
}
