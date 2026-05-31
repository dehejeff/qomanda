type PayDisplay = 'cancelled' | 'paid' | 'partial' | 'pending'

export function PayBadge({ display }: { display: PayDisplay }) {
  if (display === 'cancelled') {
    return <span className="text-[10px] font-mono text-on-surface-variant">—</span>
  }
  if (display === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase whitespace-nowrap bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        Pago
      </span>
    )
  }
  if (display === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase whitespace-nowrap bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <span className="material-symbols-outlined text-[12px]">hourglass_top</span>
        Parcial
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase whitespace-nowrap bg-red-500/10 text-red-400 border border-red-500/20">
      <span className="material-symbols-outlined text-[12px]">pending</span>
      Pendente
    </span>
  )
}

export type { PayDisplay }
