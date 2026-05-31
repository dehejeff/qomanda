'use client'

import { PaymentReceiptCard } from '@/components/payment-receipt-card'
import type { PaymentReceiptRecord, ReceiptContext } from '@/lib/payment-receipt'

type Props = {
  payments: PaymentReceiptRecord[]
  context: ReceiptContext
  variant?: 'customer' | 'dashboard'
  compact?: boolean
  title?: string
}

export function PaymentReceiptList({
  payments,
  context,
  variant = 'customer',
  compact = false,
  title = 'Seus recibos',
}: Props) {
  if (payments.length === 0) return null

  const sorted = [...payments].sort(
    (a, b) => new Date(b.paid_at ?? b.created_at).getTime() - new Date(a.paid_at ?? a.created_at).getTime(),
  )

  if (variant === 'dashboard') {
    return (
      <div className="space-y-3">
        {title && (
          <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">{title}</p>
        )}
        <div className="grid gap-3">
          {sorted.map(p => (
            <PaymentReceiptCard key={p.id} payment={p} context={context} variant="dashboard" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {title && (
        <p className="text-[10px] font-mono uppercase tracking-widest px-1" style={{ color: '#a78b7d' }}>
          {title}
        </p>
      )}
      <div className="space-y-3">
        {sorted.map(p => (
          <PaymentReceiptCard key={p.id} payment={p} context={context} variant="customer" compact={compact} />
        ))}
      </div>
    </div>
  )
}
