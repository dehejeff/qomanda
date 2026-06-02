'use client'

import { useCallback, useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { fetchDashboardOverview, type DashboardOverviewData } from '@/lib/dashboard-fetch'
import { useRestaurantRealtime } from '@/lib/use-restaurant-realtime'
import { OverviewOrdersPanel } from '@/components/dashboard/overview-orders-panel'
import { OverviewFloorMap } from '@/components/dashboard/overview-floor-map'
import { OverviewCounterPanel } from '@/components/dashboard/overview-counter-panel'
import { RestaurantOnboardingPanel } from '@/components/dashboard/restaurant-onboarding-panel'

type Props = {
  restaurantId: string
  restaurantSlug: string
  operationalMode?: 'dine_in' | 'counter' | 'both'
  initial: DashboardOverviewData
}

export function OverviewLiveDashboard({ restaurantId, restaurantSlug, operationalMode = 'both', initial }: Props) {
  const [stats, setStats] = useState(initial.stats)
  const [tables, setTables] = useState(initial.tables)
  const [orders, setOrders] = useState(initial.orders)

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const data = await fetchDashboardOverview(supabase, restaurantId)
    setStats(data.stats)
    setTables(data.tables)
    setOrders(data.orders)
  }, [restaurantId])

  useRestaurantRealtime(restaurantId, refresh)

  const capacityPct = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0
  const isCounter = operationalMode === 'counter'
  const showFloor = operationalMode === 'dine_in' || operationalMode === 'both'
  const subtitle = isCounter
    ? 'Performance em tempo real do balcão.'
    : operationalMode === 'both'
      ? 'Performance em tempo real do salão e balcão.'
      : 'Performance em tempo real do salão.'

  return (
    <div className="space-y-stack-lg">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}>Overview</h2>
          <p className="text-sm text-on-surface-variant mt-1">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 bg-surface-container-low px-4 py-2 border border-outline-variant rounded-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-mono text-on-surface">Live System</span>
        </div>
      </div>

      <RestaurantOnboardingPanel />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-card-gap">
        {isCounter ? (
          <div className="tonal-layer-1 ghost-border p-stack-lg rounded-xl flex flex-col gap-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="material-symbols-outlined text-6xl">receipt_long</span>
            </div>
            <span className="text-xs font-mono text-secondary uppercase tracking-widest">Pedidos Hoje</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>{orders.length}</span>
            </div>
            <p className="text-[10px] font-mono text-on-surface-variant mt-3">Pedidos de balcão criados hoje</p>
          </div>
        ) : (
          <div className="tonal-layer-1 ghost-border p-stack-lg rounded-xl flex flex-col gap-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="material-symbols-outlined text-6xl">table_bar</span>
            </div>
            <span className="text-xs font-mono text-secondary uppercase tracking-widest">Mesas Ocupadas</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>{stats.occupied}/{stats.total}</span>
            </div>
            <div className="mt-2 w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary-container h-full transition-all" style={{ width: `${capacityPct}%` }} />
            </div>
            <p className="text-[10px] font-mono text-on-surface-variant mt-1">{capacityPct}% de capacidade ocupada</p>
          </div>
        )}

        <div className="tonal-layer-1 ghost-border p-stack-lg rounded-xl flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <span className="material-symbols-outlined text-6xl">pending_actions</span>
          </div>
          <span className="text-xs font-mono text-secondary uppercase tracking-widest">Pedidos em Aberto</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>{stats.openOrders}</span>
          </div>
          <p className="text-[10px] font-mono text-on-surface-variant mt-3">Atualizado em tempo real</p>
        </div>

        <div className="tonal-layer-1 ghost-border p-stack-lg rounded-xl flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <span className="material-symbols-outlined text-6xl">payments</span>
          </div>
          <span className="text-xs font-mono text-secondary uppercase tracking-widest">Faturamento do Dia</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>{formatCurrency(stats.revenue)}</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-emerald-400">
            <span className="material-symbols-outlined text-sm">trending_up</span>
            <span className="text-xs font-mono">Hoje</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <div className="lg:col-span-7 flex flex-col gap-4">
          {showFloor ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>Mapa de Mesas</h3>
                <div className="flex gap-4">
                  {[
                    { label: 'Livre', cls: 'border border-outline-variant' },
                    { label: 'Ocupada', cls: 'bg-primary-container' },
                    { label: 'Reservada', cls: 'bg-surface-container-highest' },
                  ].map(({ label, cls }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-sm ${cls}`} />
                      <span className="text-[11px] font-mono text-on-surface-variant">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <OverviewFloorMap tables={tables} restaurantSlug={restaurantSlug} restaurantId={restaurantId} />
              {operationalMode === 'both' && <OverviewCounterPanel restaurantSlug={restaurantSlug} />}
            </>
          ) : (
            <OverviewCounterPanel restaurantSlug={restaurantSlug} />
          )}
        </div>

        <div className="lg:col-span-5">
          <OverviewOrdersPanel orders={orders} />
        </div>
      </div>
    </div>
  )
}
