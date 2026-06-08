'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { TableFeature } from '@/app/api/dashboard/table-features/route'

type TableLite = { id: string; number: string }

type Props = {
  tables: TableLite[]
}

const fieldClass = 'h-10 px-3 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-sm outline-none'

export function TableFeaturesPanel({ tables }: Props) {
  const [features, setFeatures] = useState<TableFeature[]>([])
  const [assign, setAssign] = useState<Record<string, Set<string>>>({}) // tableId → featureIds
  const [tolerance, setTolerance] = useState('10')
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/table-features')
      if (!res.ok) return
      const data = await res.json()
      setFeatures(data.features ?? [])
      setTolerance(String(data.toleranceMinutes ?? 10))
      const map: Record<string, Set<string>> = {}
      for (const a of (data.assignments ?? []) as { table_id: string; feature_id: string }[]) {
        ;(map[a.table_id] ??= new Set()).add(a.feature_id)
      }
      setAssign(map)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])

  async function addFeature() {
    if (!newName.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/dashboard/table-features', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), emoji: newEmoji.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setFeatures(prev => [...prev, data.feature])
      setNewName(''); setNewEmoji('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar característica.')
    } finally { setBusy(false) }
  }

  async function removeFeature(id: string) {
    setFeatures(prev => prev.filter(f => f.id !== id))
    setAssign(prev => {
      const next = { ...prev }
      for (const t of Object.keys(next)) { const s = new Set(next[t]); s.delete(id); next[t] = s }
      return next
    })
    await fetch(`/api/dashboard/table-features?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
  }

  async function toggleAssign(tableId: string, featureId: string) {
    const current = new Set(assign[tableId] ?? [])
    if (current.has(featureId)) current.delete(featureId); else current.add(featureId)
    setAssign(prev => ({ ...prev, [tableId]: current }))
    await fetch('/api/dashboard/table-features', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId, featureIds: [...current] }),
    }).catch(() => {})
  }

  async function saveTolerance() {
    const minutes = Math.max(1, Math.min(120, Math.round(Number(tolerance) || 10)))
    setTolerance(String(minutes))
    await fetch('/api/dashboard/table-features', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes }),
    }).catch(() => {})
  }

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-2.5 text-left">
          <span className="material-symbols-outlined text-[20px] text-primary">deck</span>
          <div>
            <p className="text-sm font-bold text-on-surface">Características das mesas &amp; fila de espera</p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Marque mesas com vista/varanda e deixe clientes entrarem na fila por elas.
            </p>
          </div>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-outline-variant pt-4">
          {/* Tolerância */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant">Tempo de tolerância para ocupar</span>
            <input type="number" min={1} max={120} value={tolerance}
              onChange={e => setTolerance(e.target.value)} onBlur={saveTolerance}
              className={`${fieldClass} w-20 text-center`} />
            <span className="text-xs text-on-surface-variant">minutos após ser chamado</span>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant">Características</span>
            <div className="flex flex-wrap gap-2">
              {features.map(f => (
                <span key={f.id} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-lg text-xs font-mono border border-outline-variant text-on-surface">
                  {f.emoji} {f.name}
                  <button type="button" onClick={() => removeFeature(f.id)} className="text-on-surface-variant hover:text-error">
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </span>
              ))}
              {features.length === 0 && <span className="text-xs text-on-surface-variant">Nenhuma ainda.</span>}
            </div>
            <div className="flex gap-2">
              <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="🌊" className={`${fieldClass} w-14 text-center`} maxLength={4} />
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Vista praia"
                onKeyDown={e => e.key === 'Enter' && addFeature()} className={`${fieldClass} flex-1`} />
              <button type="button" onClick={addFeature} disabled={busy || !newName.trim()}
                className="px-4 rounded-lg bg-primary-container text-on-primary-container font-bold text-sm disabled:opacity-50">
                Adicionar
              </button>
            </div>
          </div>

          {/* Atribuição por mesa */}
          {features.length > 0 && tables.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant">Quais mesas têm cada característica</span>
              <div className="space-y-2">
                {tables.map(t => (
                  <div key={t.id} className="flex items-center gap-3 flex-wrap rounded-lg bg-surface-container-low px-3 py-2">
                    <span className="text-sm font-mono font-bold text-on-surface w-16 shrink-0">
                      {t.number.toUpperCase() === 'BALCAO' ? 'Balcão' : `Mesa ${t.number}`}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {features.map(f => {
                        const on = assign[t.id]?.has(f.id) ?? false
                        return (
                          <button key={f.id} type="button" onClick={() => toggleAssign(t.id, f.id)}
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
