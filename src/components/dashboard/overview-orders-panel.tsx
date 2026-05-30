'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  confirmed: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  preparing: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  ready:     'bg-primary-container/20 text-primary border border-primary/20',
  delivered: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border border-red-500/20',
}

const STATUS_LABEL: Record<string, string> = {
  pending:   'Aguardando',
  confirmed: 'Confirmado',
  preparing: 'Preparo',
  ready:     'Pronto',
  delivered: 'Servido',
  cancelled: 'Cancelado',
}

const STATUS_FILTERS = [
  { value: 'all',       label: 'Todos' },
  { value: 'pending',   label: 'Aguardando' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'preparing', label: 'Preparo' },
  { value: 'ready',     label: 'Pronto' },
  { value: 'delivered', label: 'Servido' },
  { value: 'cancelled', label: 'Cancelado' },
] as const

type StatusFilter = (typeof STATUS_FILTERS)[number]['value']

export type OverviewOrder = {
  id: string
  status: string
  created_at: string
  items?: { unit_price: number; quantity: number }[]
  session?: { table?: { number?: string } | null } | null
  customer?: { first_name?: string; last_name?: string } | null
}

function tableNumber(order: OverviewOrder) {
  return order.session?.table?.number ?? '—'
}

function customerName(order: OverviewOrder) {
  const c = order.customer
  if (!c?.first_name) return '—'
  return [c.first_name, c.last_name].filter(Boolean).join(' ')
}

function orderTotal(order: OverviewOrder) {
  return (order.items ?? []).reduce((a, i) => a + i.unit_price * i.quantity, 0)
}

export function OverviewOrdersPanel({ orders }: { orders: OverviewOrder[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const filteredOrders = useMemo(
    () => (statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter)),
    [orders, statusFilter],
  )

  const preparingCount = orders.filter((o) => o.status === 'preparing').length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>
          Pedidos
        </h3>
        <Link href="/dashboard/orders" className="text-xs font-mono text-primary hover:underline">
          Gerenciar
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(({ value, label }) => {
          const active = statusFilter === value
          const count = value === 'all'
            ? orders.length
            : orders.filter((o) => o.status === value).length
          return (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors ${
                active
                  ? 'bg-primary-container text-on-primary-container border border-primary/30'
                  : 'bg-surface-container-high text-on-surface-variant border border-outline-variant hover:border-primary/40'
              }`}
            >
              {label}
              <span className={`ml-1.5 ${active ? 'text-on-primary-container/80' : 'text-on-surface-variant/70'}`}>
                ({count})
              </span>
            </button>
          )
        })}
      </div>

      <div className="tonal-layer-1 ghost-border rounded-xl overflow-hidden flex flex-col">
        <div className="overflow-y-auto max-h-[420px]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-high sticky top-0 z-10">
              <tr>
                {['ID', 'Cliente', 'Mesa', 'Total', 'Status'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-[10px] font-mono text-on-surface-variant uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm font-mono text-on-surface-variant">
                    {orders.length === 0 ? 'Nenhum pedido' : 'Nenhum pedido com este status'}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const total = orderTotal(order)
                  const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.pending
                  const label = STATUS_LABEL[order.status] ?? order.status
                  const time = new Date(order.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  const mesa = tableNumber(order)
                  const name = customerName(order)

                  return (
                    <tr key={order.id} className="hover:bg-surface-container-highest transition-colors">
                      <td className="px-4 py-4">
                        <span className="text-sm font-mono text-on-surface">
                          #{order.id.slice(-4).toUpperCase()}
                        </span>
                        <p className="text-[10px] font-mono text-on-surface-variant">{time}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-on-surface max-w-[120px] truncate" title={name}>
                        {name}
                      </td>
                      <td className="px-4 py-4 text-sm font-bold font-mono text-primary">{mesa}</td>
                      <td className="px-4 py-4 text-sm font-mono text-on-surface">{formatCurrency(total)}</td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${badge}`}>
                          {label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tonal-layer-1 ghost-border rounded-xl p-stack-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-error-container/20 flex items-center justify-center text-error">
            <span className="material-symbols-outlined">local_fire_department</span>
          </div>
          <div>
            <p className="text-sm font-mono text-on-surface">Atividade na Cozinha</p>
            <p className="text-[11px] font-mono text-on-surface-variant">
              {preparingCount} {preparingCount === 1 ? 'pedido em preparo' : 'pedidos em preparo'}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/orders"
          className="px-4 py-1.5 border border-outline-variant rounded text-[11px] font-mono hover:bg-surface-container-highest transition-colors"
        >
          Ver Fila
        </Link>
      </div>
    </div>
  )
}
