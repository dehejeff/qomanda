'use client'

export type InternalFormTab = {
  id: string
  label: string
}

type Props = {
  tabs: InternalFormTab[]
  active: string
  onChange: (id: string) => void
}

export function InternalFormTabs({ tabs, active, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1 p-1 rounded-xl w-full sm:w-fit bg-surface-container-low border border-outline-variant">
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-mono transition-all whitespace-nowrap ${
            active === t.id
              ? 'bg-primary-container text-on-primary-container font-bold'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
