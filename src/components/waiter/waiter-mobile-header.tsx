'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { KiComandaLogo } from '@/components/kicomanda-logo'
import { useWaiterApp } from './waiter-app-shell'
import type { RestaurantRole } from '@/lib/restaurant-auth'

const ROLE_LABEL: Record<RestaurantRole, string> = {
  owner: 'Garçom', waiter: 'Garçom', manager: 'Garçom', kitchen: 'Cozinha',
  caixa: 'Caixa', recepcionista: 'Recepção',
}

export function WaiterMobileHeader({ restaurantName }: { restaurantName: string }) {
  const router = useRouter()
  const { role } = useWaiterApp()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut({ scope: 'local' })
    router.push('/login?perfil=garcom')
  }

  return (
    <header
      className="sticky top-0 z-40 px-5 h-16 flex items-center justify-between"
      style={{
        background: 'rgba(13,17,23,0.92)',
        borderBottom: '1px solid rgba(88,66,55,0.35)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <KiComandaLogo size={28} />
        <div className="min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#8B949E' }}>
            {ROLE_LABEL[role]}
          </p>
          <p className="text-sm font-bold truncate" style={{ color: '#FFFFFF' }}>
            {restaurantName}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        className="shrink-0 p-2 rounded-xl active:scale-95 transition-transform"
        style={{ color: '#f87171', background: 'rgba(248,113,113,0.08)' }}
        aria-label="Sair"
      >
        <span className="material-symbols-outlined text-[22px]">logout</span>
      </button>
    </header>
  )
}
