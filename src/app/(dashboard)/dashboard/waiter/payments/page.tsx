'use client'

import { WaiterPendingPaymentsPanel } from '@/components/dashboard/waiter-pending-payments-panel'

export default function WaiterPaymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-on-surface">Pagamentos pendentes</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Confirme dinheiro e PIX manual quando o cliente pagar · atualiza em tempo real
        </p>
      </div>
      <WaiterPendingPaymentsPanel />
    </div>
  )
}
