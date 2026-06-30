'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type FreeTable = { id: string; number: string; capacity: number | null }

interface Props {
  entryId: string
  featureName: string
  partySize: number
  freeTables: FreeTable[]
  onClose: () => void
  onReserved: () => void
}

/**
 * Aponta quais mesas livres formam o grupo (grupo grande = várias mesas próximas).
 * Soma a capacidade das mesas escolhidas e reserva todas para a entrada da fila.
 */
export function ReserveTablesModal({ entryId, featureName, partySize, freeTables, onClose, onReserved }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const chosen = freeTables.filter(t => selected.has(t.id))
  const seats = chosen.reduce((s, t) => s + (t.capacity ?? 0), 0)
  const enough = seats >= partySize
  const missing = Math.max(0, partySize - seats)

  async function reserve() {
    if (selected.size === 0 || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/dashboard/waitlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'allocate', entryId, tableIds: [...selected] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`${selected.size} mesa${selected.size !== 1 ? 's' : ''} reservada${selected.size !== 1 ? 's' : ''}.`)
      onReserved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reservar mesas.')
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl"
        style={{ background: '#161B22', color: '#FFFFFF', fontFamily: 'Geist, sans-serif', border: '1px solid rgba(88,66,55,0.4)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(88,66,55,0.4)' }}>
          <div>
            <h2 className="text-base font-black">Apontar mesas</h2>
            <p className="text-[11px] font-mono" style={{ color: '#8B949E' }}>{featureName} · grupo de {partySize}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#8B949E' }} aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {freeTables.length === 0 ? (
            <p className="text-sm font-mono" style={{ color: '#8B949E' }}>
              Nenhuma mesa livre dessa seção agora. O grupo segue na fila — reserve quando liberar.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {freeTables.map(t => {
                  const on = selected.has(t.id)
                  return (
                    <button key={t.id} type="button" onClick={() => toggle(t.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors"
                      style={{
                        background: on ? 'rgba(52,211,153,0.15)' : 'transparent',
                        color: on ? '#34d399' : '#8B949E',
                        borderColor: on ? '#34d399' : '#30363D',
                      }}>
                      Mesa {t.number}{t.capacity != null ? ` · ${t.capacity}p` : ''}
                    </button>
                  )
                })}
              </div>

              <div className="rounded-lg px-3 py-2.5 text-xs font-mono"
                style={{ background: enough ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)', border: `1px solid ${enough ? 'rgba(52,211,153,0.3)' : 'rgba(251,191,36,0.3)'}`, color: enough ? '#34d399' : '#fbbf24' }}>
                {seats} lugar{seats !== 1 ? 'es' : ''} selecionado{seats !== 1 ? 's' : ''} de {partySize}
                {enough ? ' ✓' : ` · faltam ${missing}`}
              </div>

              <button type="button" onClick={reserve} disabled={busy || selected.size === 0}
                className="w-full h-11 rounded-lg text-sm font-bold font-mono disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: '#00E676', color: '#003319' }}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Reservar ${selected.size || ''} mesa${selected.size !== 1 ? 's' : ''}`.trim()}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
