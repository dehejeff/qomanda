'use client'

import type { Order } from '@/types'
import { formatCurrency } from '@/lib/utils'

type Props = {
  order: Order | null
  loading?: boolean
  onClose: () => void
  onConfirm: () => void
}

function orderTotal(order: Order) {
  return (order.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0)
}

export function CancelOrderModal({ order, loading, onClose, onConfirm }: Props) {
  if (!order) return null

  const total = orderTotal(order)
  const itemCount = (order.items ?? []).reduce((s, i) => s + i.quantity, 0)

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(6,14,32,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm rounded-2xl p-6 flex flex-col gap-5 max-h-[85vh] overflow-y-auto"
        style={{
          background: '#161B22',
          border: '1px solid rgba(88,66,55,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="material-symbols-outlined text-[22px]"
              style={{ color: '#f87171' }}
            >
              cancel
            </span>
            <div>
              <p className="text-base font-bold" style={{ fontFamily: 'Geist, sans-serif', color: '#FFFFFF' }}>
                Cancelar pedido?
              </p>
              <p className="text-xs" style={{ color: '#8B949E' }}>
                Só é possível antes da confirmação da cozinha
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-full transition-colors disabled:opacity-50"
            style={{ color: '#30363D' }}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div
          className="rounded-xl px-4 py-3 space-y-2"
          style={{ background: '#21262D', border: '1px solid rgba(88,66,55,0.35)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono" style={{ color: '#8B949E' }}>
              #{order.id.slice(-6).toUpperCase()}
            </span>
            <span className="text-xs font-mono" style={{ color: '#00E676' }}>
              {formatCurrency(total)}
            </span>
          </div>
          <p className="text-sm" style={{ color: '#FFFFFF' }}>
            {itemCount} {itemCount === 1 ? 'item' : 'itens'} ·{' '}
            {(order.items ?? []).map((i) => i.menu_item?.name).filter(Boolean).slice(0, 2).join(', ')}
            {(order.items ?? []).length > 2 ? '…' : ''}
          </p>
        </div>

        <p className="text-xs font-mono leading-relaxed" style={{ color: '#8B949E' }}>
          Esta ação não pode ser desfeita. O pedido será removido da fila do restaurante.
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-12 rounded-xl text-sm font-mono transition-all active:scale-95 disabled:opacity-50"
            style={{ background: 'transparent', border: '1px solid #30363D', color: '#8B949E' }}
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-12 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
            style={{ background: '#f87171', color: '#450a0a' }}
          >
            {loading ? 'Cancelando...' : 'Sim, cancelar'}
          </button>
        </div>
      </div>
    </div>
  )
}
