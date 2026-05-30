import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { DEV_BYPASS, mockTables, mockOrders } from '@/lib/dev-mock'

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  confirmed: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  preparing: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  ready:     'bg-primary-container/20 text-primary border border-primary/20',
  delivered: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
}

const STATUS_LABEL: Record<string, string> = {
  pending:   'Aguardando',
  confirmed: 'Confirmado',
  preparing: 'Preparo',
  ready:     'Pronto',
  delivered: 'Servido',
}

export default async function DashboardPage() {
  if (DEV_BYPASS) {
    const occupied = mockTables.filter((t) => t.status === 'occupied').length
    return (
      <OverviewView
        stats={{ occupied, total: mockTables.length, openOrders: mockOrders.length, revenue: 0 }}
        tables={mockTables as any}
        orders={mockOrders as any}
      />
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: restaurant } = await supabase.from('restaurants').select('id').eq('owner_id', user.id).single()
  if (!restaurant) redirect('/login')

  const [tablesRes, ordersRes, paymentsRes, recentRes] = await Promise.all([
    supabase.from('tables').select('id, number, status').eq('restaurant_id', restaurant.id).order('number'),
    supabase.from('orders').select('id').eq('restaurant_id', restaurant.id).in('status', ['pending', 'confirmed', 'preparing', 'ready']),
    supabase.from('payments').select('amount').eq('restaurant_id', restaurant.id).eq('status', 'paid').gte('created_at', new Date(new Date().setHours(0,0,0,0)).toISOString()),
    supabase.from('orders').select('id, status, created_at, items:order_items(unit_price, quantity)').eq('restaurant_id', restaurant.id).not('status', 'in', '("cancelled")').order('created_at', { ascending: false }).limit(5),
  ])

  const tables = tablesRes.data ?? []
  const occupied = tables.filter((t) => t.status === 'occupied').length
  const revenue = (paymentsRes.data ?? []).reduce((a, p) => a + p.amount, 0)

  return (
    <OverviewView
      stats={{ occupied, total: tables.length, openOrders: (ordersRes.data ?? []).length, revenue }}
      tables={tables}
      orders={recentRes.data ?? []}
    />
  )
}

function OverviewView({ stats, tables, orders }: {
  stats: { occupied: number; total: number; openOrders: number; revenue: number }
  tables: any[]
  orders: any[]
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
          <div className="tonal-layer-1 ghost-border rounded-xl p-6">
            {tables.length === 0 ? (
              <p className="text-center text-on-surface-variant text-sm py-8 font-mono">Nenhuma mesa cadastrada</p>
            ) : (
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-3">
                {tables.map((t) => {
                  const occupied = t.status === 'occupied'
                  const reserved = t.status === 'reserved'
                  return (
                    <div
                      key={t.id}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center border transition-colors cursor-pointer ${
                        occupied
                          ? 'bg-primary-container border-primary/20 shadow-lg'
                          : reserved
                          ? 'bg-surface-container-highest/50 border-outline-variant opacity-60'
                          : 'border-outline-variant hover:border-primary'
                      }`}
                    >
                      <span className={`text-xs font-bold font-mono ${occupied ? 'text-on-primary-container' : 'text-on-surface-variant'}`}>
                        T-{t.number.padStart(2, '0')}
                      </span>
                      {occupied && <span className="material-symbols-outlined text-on-primary-container text-sm">person</span>}
                      {reserved && <span className="material-symbols-outlined text-on-surface-variant text-sm">event_busy</span>}
                    </div>
                  )
                })}
              </div>
            )}
            <div className="mt-6 flex justify-center">
              <div className="px-8 py-3 bg-surface-container-highest/30 border border-outline-variant border-dashed rounded-xl flex items-center gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-sm">countertops</span>
                <span className="text-xs font-mono">Área do Balcão e Cozinha</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent orders */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>Pedidos Recentes</h3>
            <Link href="/dashboard/orders" className="text-xs font-mono text-primary hover:underline">Ver todos</Link>
          </div>
          <div className="tonal-layer-1 ghost-border rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-high">
                <tr>
                  {['ID', 'Mesa', 'Total', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm font-mono text-on-surface-variant">Nenhum pedido</td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const total = (order.items ?? []).reduce((a: number, i: any) => a + i.unit_price * i.quantity, 0)
                    const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.pending
                    const label = STATUS_LABEL[order.status] ?? order.status
                    const time = new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <tr key={order.id} className="hover:bg-surface-container-highest transition-colors cursor-pointer">
                        <td className="px-4 py-4">
                          <span className="text-sm font-mono text-on-surface">#{order.id.slice(-4).toUpperCase()}</span>
                          <p className="text-[10px] font-mono text-on-surface-variant">{time}</p>
                        </td>
                        <td className="px-4 py-4 text-sm font-bold font-mono text-primary">—</td>
                        <td className="px-4 py-4 text-sm font-mono text-on-surface">{formatCurrency(total)}</td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${badge}`}>{label}</span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Kitchen activity */}
          <div className="tonal-layer-1 ghost-border rounded-xl p-stack-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-error-container/20 flex items-center justify-center text-error">
                <span className="material-symbols-outlined">local_fire_department</span>
              </div>
              <div>
                <p className="text-sm font-mono text-on-surface">Atividade na Cozinha</p>
                <p className="text-[11px] font-mono text-on-surface-variant">{orders.filter((o) => o.status === 'preparing').length} pedidos em preparo</p>
              </div>
            </div>
            <Link href="/dashboard/orders" className="px-4 py-1.5 border border-outline-variant rounded text-[11px] font-mono hover:bg-surface-container-highest transition-colors">Ver Fila</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
