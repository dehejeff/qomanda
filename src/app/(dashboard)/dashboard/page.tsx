import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { DEV_BYPASS, mockTables, mockOrders, mockRestaurant } from '@/lib/dev-mock'
import { sortTablesByNumber } from '@/lib/sort-tables'
import { OverviewOrdersPanel } from '@/components/dashboard/overview-orders-panel'
import { OverviewFloorMap } from '@/components/dashboard/overview-floor-map'

export default async function DashboardPage() {
  if (DEV_BYPASS) {
    const occupied = mockTables.filter((t) => t.status === 'occupied').length
    return (
      <OverviewView
        stats={{ occupied, total: mockTables.length, openOrders: mockOrders.length, revenue: 0 }}
        tables={sortTablesByNumber(mockTables) as any}
        orders={mockOrders as any}
        restaurantSlug={mockRestaurant.slug}
        restaurantId={mockRestaurant.id}
      />
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: restaurant } = await supabase.from('restaurants').select('id, slug').eq('owner_id', user.id).single()
  if (!restaurant) redirect('/login')

  const [tablesRes, ordersRes, paymentsRes, recentRes] = await Promise.all([
    supabase.from('tables').select('id, number, status, restaurant_id, qr_code_url, created_at').eq('restaurant_id', restaurant.id).order('number'),
    supabase.from('orders').select('id').eq('restaurant_id', restaurant.id).in('status', ['pending', 'confirmed', 'preparing', 'ready']),
    supabase.from('payments').select('amount').eq('restaurant_id', restaurant.id).eq('status', 'paid').gte('created_at', new Date(new Date().setHours(0,0,0,0)).toISOString()),
    supabase
      .from('orders')
      .select('id, status, created_at, items:order_items(unit_price, quantity), session:sessions(table:tables(number)), customer:customers(first_name, last_name)')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
      .limit(1000),
  ])

  const tables = sortTablesByNumber(tablesRes.data ?? [])
  const occupied = tables.filter((t) => t.status === 'occupied').length
  const revenue = (paymentsRes.data ?? []).reduce((a, p) => a + p.amount, 0)

  return (
    <OverviewView
      stats={{ occupied, total: tables.length, openOrders: (ordersRes.data ?? []).length, revenue }}
      tables={tables}
      orders={recentRes.data ?? []}
      restaurantSlug={restaurant.slug}
      restaurantId={restaurant.id}
    />
  )
}

function OverviewView({ stats, tables, orders, restaurantSlug, restaurantId }: {
  stats: { occupied: number; total: number; openOrders: number; revenue: number }
  tables: any[]
  orders: any[]
  restaurantSlug: string
  restaurantId: string
}) {
  const capacityPct = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0

  return (
    <div className="space-y-stack-lg">
      {/* Page header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}>Overview</h2>
          <p className="text-sm text-on-surface-variant mt-1">Performance em tempo real do salão.</p>
        </div>
        <div className="flex items-center gap-2 bg-surface-container-low px-4 py-2 border border-outline-variant rounded-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-mono text-on-surface">Live System</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-card-gap">
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

      {/* Floor map + recent orders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Floor map */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>Mapa de Mesas</h3>
            <div className="flex gap-4">
              {[
                { label: 'Livre',     cls: 'border border-outline-variant' },
                { label: 'Ocupada',   cls: 'bg-primary-container' },
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
        </div>

        {/* Orders */}
        <div className="lg:col-span-5">
          <OverviewOrdersPanel orders={orders} />
        </div>
      </div>
    </div>
  )
}
