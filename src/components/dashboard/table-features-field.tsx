'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { TableFeature } from '@/app/api/dashboard/table-features/route'

type Props =
  | {
      mode: 'select'
      selectedIds: string[]
      onChange: (ids: string[]) => void
    }
  | {
      mode: 'persist'
      tableId: string
    }

const inputClass = 'h-9 px-2.5 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-sm outline-none'

/**
 * Campo de características da mesa: lista as tags do restaurante como chips
 * (liga/desliga) e permite criar uma nova tag inline.
 * - mode 'select': controlado (para o modal de criar mesa).
 * - mode 'persist': salva direto na mesa via API (para editar mesa existente).
 */
export function TableFeaturesField(props: Props) {
  const [features, setFeatures] = useState<TableFeature[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('')
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/table-features')
      if (!res.ok) return
      const data = await res.json()
      setFeatures((data.features ?? []) as TableFeature[])
      if (props.mode === 'persist') {
        const ids = (data.assignments ?? [])
          .filter((a: { table_id: string }) => a.table_id === props.tableId)
          .map((a: { feature_id: string }) => a.feature_id)
        setSelected(new Set(ids))
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode, props.mode === 'persist' ? props.tableId : ''])

  useEffect(() => { load() }, [load])

  // Em modo select, espelha o controlado.
  useEffect(() => {
    if (props.mode === 'select') setSelected(new Set(props.selectedIds))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode === 'select' ? props.selectedIds.join(',') : ''])

  async function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
    if (props.mode === 'select') {
      props.onChange([...next])
    } else {
      setBusy(true)
      try {
        await fetch('/api/dashboard/table-features', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableId: props.tableId, featureIds: [...next] }),
        })
      } finally { setBusy(false) }
    }
  }

  async function createFeature() {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/dashboard/table-features', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), emoji: newEmoji.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setFeatures(prev => [...prev, data.feature])
      setNewName(''); setNewEmoji('')
      // já marca a nova como selecionada
      await toggle(data.feature.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar característica.')
    } finally { setAdding(false) }
  }

  return (
    <div className="space-y-2">
      <span className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
        Características {busy && <span className="opacity-60">· salvando…</span>}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {features.map(f => {
          const on = selected.has(f.id)
          return (
            <button key={f.id} type="button" onClick={() => toggle(f.id)}
              className="px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors"
              style={{
                background: on ? 'rgba(249,115,22,0.15)' : 'transparent',
                color: on ? '#f97316' : '#a78b7d',
                borderColor: on ? '#f97316' : '#334155',
              }}>
              {f.emoji} {f.name}
            </button>
          )
        })}
        {features.length === 0 && (
          <span className="text-xs text-on-surface-variant">Nenhuma ainda — crie abaixo.</span>
        )}
      </div>
      <div className="flex gap-2">
        <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="🌊" maxLength={4}
          className={`${inputClass} w-12 text-center`} />
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nova característica (ex.: Vista praia)"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createFeature() } }}
          className={`${inputClass} flex-1`} />
        <button type="button" onClick={createFeature} disabled={adding || !newName.trim()}
          className="px-3 rounded-lg bg-surface-container-high border border-outline-variant text-on-surface text-xs font-mono disabled:opacity-50">
          + Add
        </button>
      </div>
    </div>
  )
}
