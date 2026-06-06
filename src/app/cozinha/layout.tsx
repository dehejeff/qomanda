import { redirect } from 'next/navigation'
import { getRestaurantAccess } from '@/lib/restaurant-auth'

// Apenas cozinha, gerentes e donos — garçom usa /garcom
const ALLOWED = new Set(['owner', 'manager', 'kitchen'])

/** KDS — tela de cozinha em tela cheia (sem shell de dashboard/garçom). */
export default async function CozinhaLayout({ children }: { children: React.ReactNode }) {
  const access = await getRestaurantAccess()
  if (!access || !ALLOWED.has(access.role)) {
    redirect('/login?perfil=garcom')
  }
  return (
    <div className="min-h-screen" style={{ background: '#0b1326', color: '#dae2fd' }}>
      {children}
    </div>
  )
}
