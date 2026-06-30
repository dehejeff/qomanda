'use client'

function brl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function BarChart({
  data,
  valueKey = 'count',
  labelKey = 'label',
  formatValue,
  emptyLabel = 'Sem dados no período.',
  height = 'h-48',
}: {
  data: { [key: string]: string | number }[]
  valueKey?: string
  labelKey?: string
  formatValue?: (v: number) => string
  emptyLabel?: string
  height?: string
}) {
  const values = data.map(d => Number(d[valueKey] ?? 0))
  const max = Math.max(...values, 1)
  const hasData = values.some(v => v > 0)

  if (!hasData) {
    return (
      <div className={`${height} flex flex-col items-center justify-center text-center`}>
        <span className="material-symbols-outlined text-4xl text-on-surface-variant opacity-30 mb-2">bar_chart</span>
        <p className="text-xs font-mono text-on-surface-variant">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className={`flex items-stretch gap-1.5 ${height} overflow-x-auto`}>
      {data.map((d, i) => {
        const value = Number(d[valueKey] ?? 0)
        const heightPct = value > 0 ? Math.max((value / max) * 100, 6) : 0
        const label = String(d[labelKey] ?? d.date ?? i)
        return (
          <div key={`${label}-${i}`} className="flex-1 min-w-[28px] h-full flex flex-col items-center gap-1.5 group">
            <span className="text-[9px] font-mono text-on-surface-variant h-3 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {value > 0 ? (formatValue ? formatValue(value) : String(value)) : ''}
            </span>
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full bg-primary-container/45 group-hover:bg-primary-container rounded-t-md transition-all"
                style={{ height: `${heightPct}%` }}
                title={`${label}: ${formatValue ? formatValue(value) : value}`}
              />
            </div>
            <span className="text-[8px] font-mono text-on-surface-variant whitespace-nowrap truncate max-w-full px-0.5">
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function HorizontalBars({
  items,
  showValue,
}: {
  items: { label: string; count: number; value?: number }[]
  showValue?: (item: { label: string; count: number; value?: number }) => string
}) {
  const max = Math.max(...items.map(i => i.count), 1)
  const total = items.reduce((s, i) => s + i.count, 0) || 1

  if (!items.length) {
    return <p className="text-xs font-mono text-on-surface-variant py-6 text-center">Sem dados.</p>
  }

  return (
    <div className="space-y-3">
      {items.map(item => {
        const pct = (item.count / max) * 100
        const share = Math.round((item.count / total) * 100)
        return (
          <div key={item.label}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs text-on-surface truncate">{item.label}</span>
              <span className="text-[10px] font-mono text-on-surface-variant shrink-0">
                {item.count} · {share}%
                {showValue && item.value != null ? ` · ${showValue(item)}` : ''}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-dim overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-container transition-all"
                style={{ width: `${Math.max(pct, item.count > 0 ? 4 : 0)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DonutChart({
  items,
  centerLabel,
  centerValue,
}: {
  items: { label: string; count: number; color: string }[]
  centerLabel: string
  centerValue: string
}) {
  const total = items.reduce((s, i) => s + i.count, 0)
  if (!total) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-xs font-mono text-on-surface-variant">Sem dados</p>
      </div>
    )
  }

  let cursor = 0
  const gradient = items
    .filter(i => i.count > 0)
    .map(item => {
      const start = cursor
      cursor += (item.count / total) * 100
      return `${item.color} ${start}% ${cursor}%`
    })
    .join(', ')

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div
        className="relative w-36 h-36 rounded-full shrink-0"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div className="absolute inset-4 rounded-full bg-surface-container flex flex-col items-center justify-center">
          <p className="text-[10px] font-mono uppercase text-on-surface-variant">{centerLabel}</p>
          <p className="text-lg font-black text-on-surface">{centerValue}</p>
        </div>
      </div>
      <div className="space-y-2 flex-1 w-full">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
            <span className="text-on-surface flex-1">{item.label}</span>
            <span className="font-mono text-on-surface-variant">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  icon: string
  accent?: string
}) {
  return (
    <div className="bg-surface-container border border-outline-variant rounded-xl p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-[0.07] -translate-y-1/2 translate-x-1/2"
        style={{ background: accent ?? '#00E676' }} />
      <span className="material-symbols-outlined text-[20px] mb-2" style={{ color: accent ?? '#00E676' }}>{icon}</span>
      <p className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className="text-xl font-black text-on-surface mt-1 font-mono">{value}</p>
      {sub && <p className="text-[10px] text-on-surface-variant mt-1">{sub}</p>}
    </div>
  )
}

export { brl }
