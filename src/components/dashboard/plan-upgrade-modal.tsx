'use client'

import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

type UpgradePlan = {
  id: string
  name: string
  maxTables: number | null
  monthlyFee: number
}

type Props = {
  open: boolean
  onClose: () => void
  planName: string
  maxTables: number
  currentCount: number
  onUpgraded: () => void | Promise<void>
}

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function PlanUpgradeModal({
  open,
  onClose,
  planName,
  maxTables,
  currentCount,
  onUpgraded,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)
  const [upgrades, setUpgrades] = useState<UpgradePlan[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/dashboard/plans')
      .then(r => r.json())
      .then(data => {
        const list = (data.upgrades ?? []) as UpgradePlan[]
        setUpgrades(list)
        setSelectedId(list[0]?.id ?? null)
      })
      .catch(() => toast.error('Erro ao carregar planos.'))
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  const selected = upgrades.find(p => p.id === selectedId)

  async function confirmUpgrade() {
    if (!selectedId) return
    setUpgrading(true)
    try {
      const res = await fetch('/api/dashboard/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao atualizar plano.')
      toast.success(data.message ?? 'Plano atualizado!')
      await onUpgraded()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar plano.')
    } finally {
      setUpgrading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg bg-surface-container border border-outline-variant rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-outline-variant">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-primary">Limite do plano</p>
            <h2 className="text-lg font-bold text-on-surface mt-1">Upgrade para mais mesas</h2>
            <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
              Seu plano <strong className="text-on-surface">{planName}</strong> permite até{' '}
              <strong className="text-on-surface">{maxTables} mesas</strong> e você já tem{' '}
              <strong className="text-on-surface">{currentCount}</strong>.
              Escolha um plano superior para adicionar mesas.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : upgrades.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-4">
              Nenhum plano de upgrade disponível. Entre em contato com a Qomanda.
            </p>
          ) : (
            <div className="space-y-2">
              {upgrades.map(plan => {
                const active = selectedId === plan.id
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedId(plan.id)}
                    className={`w-full text-left rounded-xl p-4 border transition-colors ${
                      active ? 'border-primary bg-primary/10' : 'border-outline-variant hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-on-surface">{plan.name}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          Até {plan.maxTables ?? '∞'} mesas · {brl(plan.monthlyFee)}/mês
                        </p>
                      </div>
                      {active && (
                        <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          check_circle
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {selected && (
            <p className="text-xs text-on-surface-variant rounded-lg border border-dashed border-outline-variant px-3 py-2 leading-relaxed">
              A mensalidade deste mês será calculada proporcionalmente: dias no plano antigo + dias no plano novo.
              O upgrade é registrado automaticamente para a fatura.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 px-6 py-4 border-t border-outline-variant bg-surface-dim/50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-w-[120px] h-10 rounded-lg border border-outline-variant text-sm font-mono text-on-surface-variant hover:text-on-surface"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!selectedId || upgrading || loading}
            onClick={confirmUpgrade}
            className="flex-[2] min-w-[160px] h-10 rounded-lg bg-primary-container text-on-primary-container text-sm font-mono font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {upgrading && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar upgrade
          </button>
        </div>
      </div>
    </div>
  )
}
