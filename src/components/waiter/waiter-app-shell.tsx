'use client'

import { createContext, useContext } from 'react'
import type { RestaurantRole } from '@/lib/restaurant-auth'
import { WaiterMobileHeader } from './waiter-mobile-header'
import { WaiterBottomNav } from './waiter-bottom-nav'
import { WaiterCallsBanner } from './waiter-calls-banner'

type WaiterAppContext = {
  role: RestaurantRole
  restaurantName: string
}

const Ctx = createContext<WaiterAppContext | null>(null)

export function useWaiterApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWaiterApp must be used within WaiterAppShell')
  return ctx
}

export function WaiterAppShell({
  role,
  restaurantName,
  children,
}: {
  role: RestaurantRole
  restaurantName: string
  children: React.ReactNode
}) {
  const showPayments = role !== 'kitchen'

  return (
    <Ctx.Provider value={{ role, restaurantName }}>
      <div
        className="min-h-screen max-w-lg mx-auto relative"
        style={{ background: '#0b1326', color: '#dae2fd', fontFamily: 'Geist, sans-serif' }}
      >
        <div
          className="pointer-events-none fixed top-[-8%] right-[-20%] w-[280px] h-[280px] rounded-full"
          style={{ background: 'rgba(249,115,22,0.06)', filter: 'blur(80px)' }}
        />
        <WaiterMobileHeader restaurantName={restaurantName} />
        <main className="relative z-10 px-5 pt-4 pb-28">
          {showPayments && <WaiterCallsBanner />}
          {children}
        </main>
        <WaiterBottomNav showPayments={showPayments} />
      </div>
    </Ctx.Provider>
  )
}
