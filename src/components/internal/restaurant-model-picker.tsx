'use client'

import { RESTAURANT_MODELS, type RestaurantModelId } from '@/lib/restaurant-models'

type Props = {
  value: RestaurantModelId | null
  onChange: (id: RestaurantModelId) => void
}

/** Seleção do modelo operacional do restaurante (salão / balcão / etc). */
export function RestaurantModelPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {RESTAURANT_MODELS.map(m => {
        const active = value === m.id
        const disabled = m.status === 'coming_soon'
        return (
          <button
            key={m.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(m.id)}
            className={`text-left rounded-xl p-4 border transition-colors ${
              active
                ? 'border-primary bg-primary/10'
                : 'border-outline-variant hover:border-primary/40'
            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`material-symbols-outlined text-[22px] shrink-0 ${active ? 'text-primary' : 'text-on-surface-variant'}`}
                style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {m.icon}
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${active ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                  {m.name}
                  {disabled && <span className="ml-2 text-[10px] font-mono uppercase text-on-surface-variant/60">em breve</span>}
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5">{m.tagline}</p>
                <p className="text-[10px] font-mono text-on-surface-variant/60 mt-1.5">{m.examples}</p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
