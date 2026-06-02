'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Circle, Loader2 } from 'lucide-react'
import type { OnboardingState } from '@/lib/restaurant-onboarding'

export function RestaurantOnboardingPanel() {
  const [state, setState] = useState<OnboardingState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/onboarding')
      .then(r => r.json())
      .then(data => { setState(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-on-surface-variant" />
      </div>
    )
  }

  if (!state || state.completed) return null

  const required = state.items.filter(i => !i.optional)

  return (
    <section className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-primary">Primeiros passos</p>
          <h2 className="text-lg font-bold text-on-surface mt-0.5">
            {state.modelName ? `Modelo ${state.modelName}` : 'Configure seu restaurante'}
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Falta pouco — depois do gateway você já pode atender clientes.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black font-mono text-primary">{state.progressPercent}%</p>
          <p className="text-[10px] font-mono text-on-surface-variant">concluído</p>
        </div>
      </div>

      <div className="h-2 rounded-full bg-surface-container overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${state.progressPercent}%` }}
        />
      </div>

      <ul className="space-y-2">
        {required.map(item => (
          <li key={item.id}>
            {item.href && !item.done ? (
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-surface-container hover:bg-surface-container-high transition-colors"
              >
                <Circle className="h-4 w-4 shrink-0 text-on-surface-variant" />
                <span className="text-sm text-on-surface">{item.label}</span>
                <span className="ml-auto text-[10px] font-mono text-primary">Fazer →</span>
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-surface-container/50">
                {item.done
                  ? <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  : <Circle className="h-4 w-4 shrink-0 text-on-surface-variant" />}
                <span className={`text-sm ${item.done ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>
                  {item.label}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>

      {state.primaryLinks.length > 0 && state.progressPercent >= 75 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {state.primaryLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              target={link.href.startsWith('/') && !link.href.startsWith('/dashboard') ? '_blank' : undefined}
              className="text-xs font-mono px-3 py-1.5 rounded-lg border border-outline-variant hover:border-primary transition-colors"
            >
              {link.label} →
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
