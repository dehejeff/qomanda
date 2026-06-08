'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'
import type { RestaurantTable } from '@/types'
import { TableFeaturesField } from '@/components/dashboard/table-features-field'

interface Props {
  onClose: () => void
  onCreated: (table: RestaurantTable) => void
  onLimitReached: (data: { planName?: string; maxTables?: number }) => void
}

export function TableCreateModal({ onClose, onCreated, onLimitReached }: Props) {
  const [number, setNumber] = useState('')
  const [capacity, setCapacity] = useState('')
  const [featureIds, setFeatureIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    setCreating(true)
    try {
      const res = await fetch('/api/dashboard/tables', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'table',
          number: number.trim() || undefined,
          capacity: capacity.trim() ? Number(capacity) : null,
        }),
      })
      const data = await res.json()
      if (res.status === 403 && data.code === 'TABLE_LIMIT_REACHED') {
        onLimitReached(data); onClose(); return
      }
      if (!res.ok) { toast.error(data.error ?? 'Erro ao criar mesa.'); return }

      const table = data.table as RestaurantTable
      if (featureIds.length > 0) {
        await fetch('/api/dashboard/table-features', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableId: table.id, featureIds }),
        }).catch(() => {})
      }
      onCreated(table)
      toast.success(`Mesa ${table.number} criada!`)
      onClose()
    } catch {
      toast.error('Erro ao criar mesa.')
    } finally { setCreating(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-container border border-outline-variant rounded-t-2xl sm:rounded-xl w-full sm:max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <h2 className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>Nova mesa</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface"><X className="h-5 w-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1.5 block">
              Número / nome <span className="opacity-50 normal-case">(opcional — automático se vazio)</span>
            </label>
            <input value={number} onChange={e => setNumber(e.target.value)} placeholder="Ex.: 7"
              className="w-full h-11 px-3 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-sm outline-none" />
          </div>

          <div>
            <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1.5 block">
              Capacidade <span className="opacity-50 normal-case">(nº de pessoas — opcional)</span>
            </label>
            <input value={capacity} onChange={e => setCapacity(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric" placeholder="Ex.: 4"
              className="w-full h-11 px-3 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-sm outline-none" />
          </div>

          <TableFeaturesField mode="select" selectedIds={featureIds} onChange={setFeatureIds} />

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface font-mono text-sm rounded-lg hover:bg-surface-variant transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={handleCreate} disabled={creating}
              className="flex-1 py-2.5 bg-primary-container text-on-primary-container font-bold font-mono text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar mesa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
