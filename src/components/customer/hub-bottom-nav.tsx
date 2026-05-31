'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Props = {
  active?: 'home' | 'scan' | 'receipts' | 'profile'
}

export function HubBottomNav({ active }: Props) {
  const pathname = usePathname()
  const current = active ?? (
    pathname === '/scan' ? 'scan'
    : pathname.startsWith('/hub') ? 'home'
    : 'home'
  )

  const itemStyle = (id: string) => ({
    color: current === id ? '#ffb690' : '#e0c0b1',
  })

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center h-20 px-2 max-w-lg mx-auto"
      style={{ background: '#171f33', borderTop: '1px solid rgba(88,66,55,0.4)' }}
    >
      <Link href="/hub" className="flex flex-col items-center gap-0.5 p-2 rounded-xl min-w-[64px]" style={itemStyle('home')}>
        <span className="material-symbols-outlined text-[22px]"
          style={current === 'home' ? { fontVariationSettings: "'FILL' 1", color: '#f97316' } : undefined}>
          home
        </span>
        <span className="text-[10px] font-mono">Início</span>
      </Link>

      <Link href="/scan" className="flex flex-col items-center gap-0.5 rounded-full px-5 py-2 -mt-4"
        style={{ background: '#f97316', color: '#582200', boxShadow: '0 4px 20px rgba(249,115,22,0.35)' }}>
        <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>qr_code_scanner</span>
        <span className="text-[10px] font-mono font-bold">Escanear</span>
      </Link>

      <Link href="/hub#receipts" className="flex flex-col items-center gap-0.5 p-2 rounded-xl min-w-[64px]" style={itemStyle('receipts')}>
        <span className="material-symbols-outlined text-[22px]"
          style={current === 'receipts' ? { fontVariationSettings: "'FILL' 1", color: '#f97316' } : undefined}>
          receipt_long
        </span>
        <span className="text-[10px] font-mono">Recibos</span>
      </Link>

      <Link href="/hub#profile" className="flex flex-col items-center gap-0.5 p-2 rounded-xl min-w-[64px]" style={itemStyle('profile')}>
        <span className="material-symbols-outlined text-[22px]"
          style={current === 'profile' ? { fontVariationSettings: "'FILL' 1", color: '#f97316' } : undefined}>
          person
        </span>
        <span className="text-[10px] font-mono">Perfil</span>
      </Link>
    </nav>
  )
}
