'use client'

import { useState } from 'react'
import { toast } from 'sonner'

interface Props {
  tableId: string
  /** Capacidade atual (null = sem restrição) */
  initial?: number | null
  /** Notifica o pai sobre o novo valor salvo */
  onSaved?: (capacity: number | null) => void
}

/**
 * Campo de capacidade da mesa (nº de pessoas) para editar uma mesa existente.
 * Salva via PATCH /api/dashboard/tables ao sair do campo (onBlur).
 */
export function TableCapacityField({ tableId, initial, onSaved }: Props) {
  const [value, setValue] = useState(initial != null ? String(initial) : '')
  const [busy, setBusy] = useState(false)

  async function save() {
    const capacity = value.trim() ? Number(value) : null
    if (capacity === (initial ?? null)) return // nada mudou
    setBusy(true)
    try {
      const res = await fetch('/api/dashboard/tables', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, capacity }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erro ao salvar capacidade.')
      }
      onSaved?.(capacity)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar capacidade.')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-2">
      <span className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
        Capacidade (pessoas) {busy && <span className="opacity-60">· salvando…</span>}
      </span>
      <input
        value={value}
        onChange={e => setValue(e.target.value.replace(/\D/g, ''))}
        onBlur={save}
        inputMode="numeric"
        placeholder="Sem limite"
        className="h-9 px-2.5 w-28 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-sm outline-none"
      />
    </div>
  )
}
