type ItemPayStatus = 'cancelled' | 'paid' | 'partial' | 'pending'

export function ItemStatusIcon({ status }: { status: ItemPayStatus }) {
  if (status === 'cancelled') {
    return (
      <span
        className="material-symbols-outlined text-[13px] shrink-0 leading-none"
        style={{ color: '#f87171', opacity: 0.8 }}
        title="Cancelado"
        aria-label="Cancelado"
      >
        close
      </span>
    )
  }
  if (status === 'paid') {
    return (
      <span
        className="material-symbols-outlined text-[13px] shrink-0 leading-none"
        style={{ color: '#34d399', fontVariationSettings: "'FILL' 1" }}
        title="Pago"
        aria-label="Pago"
      >
        check_circle
      </span>
    )
  }
  if (status === 'partial') {
    return (
      <span
        className="material-symbols-outlined text-[13px] shrink-0 leading-none"
        style={{ color: '#f59e0b' }}
        title="Parcialmente pago"
        aria-label="Parcialmente pago"
      >
        contrast
      </span>
    )
  }
  return (
    <span
      className="material-symbols-outlined text-[13px] shrink-0 leading-none"
      style={{ color: '#584237' }}
      title="Pendente"
      aria-label="Pendente"
    >
      radio_button_unchecked
    </span>
  )
}

export type { ItemPayStatus }
