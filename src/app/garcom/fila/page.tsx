'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type Feature = { id: string; name: string; emoji: string | null }
type QueueEntry = {
  id: string; featureId: string; name: string; whatsapp: string | null
  partySize: number; status: 'waiting' | 'notified'; source: string
  expiresAt: string | null; notifiedTableNumber: string | null
}
type FreeTable = { id: string; number: string }

export default function WaiterWaitlistPage() {
  const [features, setFeatures] = useState<Feature[]>([])
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [freeByFeature, setFreeByFeature] = useState<Record<string, FreeTable[]>>({})
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [walkInFeature, setWalkInFeature] = useState('')
  const [walkInName, setWalkInName] = useState('')
  const [walkInParty, setWalkInParty] = useState('2')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/waitlist')
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      setFeatures(data.features ?? [])
      setQueue(data.queue ?? [])
      setFreeByFeature(data.freeByFeature ?? {})
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const poll = setInterval(load, 5000)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => { clearInterval(poll); clearInterval(tick) }
  }, [load])

  async function act(body: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await fetch('/api/dashboard/waitlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro.')
    } finally { setBusy(false) }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin" style={{ color: '#f97316' }} /></div>
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black" style={{ letterSpacing: '-0.02em' }}>Fila de espera</h1>
        <p className="text-sm mt-1 font-mono" style={{ color: '#a78b7d' }}>Chame o próximo quando uma mesa com a característica liberar.</p>
      </div>

      {features.length === 0 && (
        <div className="rounded-2xl py-10 text-center" style={{ background: '#171f33', border: '1px solid rgba(88,66,55,0.4)' }}>
          <p className="text-sm font-mono" style={{ color: '#a78b7d' }}>
            Nenhuma característica cadastrada. Cadastre em Mesas → Características.
          </p>
        </div>
      )}

      {features.map(f => {
        const entries = queue.filter(e => e.featureId === f.id)
        const free = freeByFeature[f.id] ?? []
        return (
          <div key={f.id} className="rounded-2xl p-4" style={{ background: '#171f33', border: '1px solid rgba(88,66,55,0.4)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-bold">{f.emoji} {f.name}</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono" style={{ color: free.length > 0 ? '#34d399' : '#584237' }}>
                  {free.length} livre{free.length !== 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  disabled={busy || free.length === 0 || !entries.some(e => e.status === 'waiting')}
                  onClick={() => act({ action: 'callNext', featureId: f.id, tableId: free[0]?.id })}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono disabled:opacity-40"
                  style={{ background: '#f97316', color: '#582200' }}>
                  Chamar próximo
                </button>
              </div>
            </div>

            {entries.length === 0 ? (
              <p className="text-xs font-mono" style={{ color: '#584237' }}>Ninguém na fila.</p>
            ) : (
              <ul className="space-y-2">
                {entries.map((e, i) => {
                  const ready = e.status === 'notified'
                  const secs = ready && e.expiresAt ? Math.max(0, Math.floor((new Date(e.expiresAt).getTime() - now) / 1000)) : 0
                  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
                  const ss = String(secs % 60).padStart(2, '0')
                  return (
                    <li key={e.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                      style={{ background: ready ? 'rgba(52,211,153,0.08)' : 'rgba(0,0,0,0.2)', border: `1px solid ${ready ? 'rgba(52,211,153,0.3)' : 'transparent'}` }}>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {!ready && <span className="font-mono" style={{ color: '#a78b7d' }}>{i + 1}º </span>}
                          {e.name} <span className="text-[11px] font-mono" style={{ color: '#a78b7d' }}>· {e.partySize}p</span>
                          {e.source === 'staff' && <span className="text-[9px] font-mono ml-1" style={{ color: '#584237' }}>(portaria)</span>}
                        </p>
                        {ready && (
                          <p className="text-[11px] font-mono mt-0.5" style={{ color: '#34d399' }}>
                            Chamado · Mesa {e.notifiedTableNumber ?? '—'} · {mm}:{ss}
                          </p>
                        )}
                      </div>
                      {ready ? (
                        <div className="flex gap-1.5 shrink-0">
                          <button type="button" disabled={busy} onClick={() => act({ action: 'seat', entryId: e.id })}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                            Sentou
                          </button>
                          <button type="button" disabled={busy} onClick={() => act({ action: 'noShow', entryId: e.id })}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-mono" style={{ background: 'transparent', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                            Não veio
                          </button>
                        </div>
                      ) : (
                        <button type="button" disabled={busy} onClick={() => act({ action: 'cancel', entryId: e.id })}
                          className="text-[11px] font-mono shrink-0" style={{ color: '#584237' }}>Remover</button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}

      {/* Walk-in (portaria) */}
      {features.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: '#171f33', border: '1px solid rgba(88,66,55,0.4)' }}>
          <p className="text-sm font-bold mb-2">Adicionar na portaria</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {features.map(f => (
              <button key={f.id} type="button" onClick={() => setWalkInFeature(f.id)}
                className="px-2.5 py-1 rounded-lg text-xs font-mono"
                style={{ background: walkInFeature === f.id ? '#f97316' : 'transparent', color: walkInFeature === f.id ? '#582200' : '#a78b7d', border: `1px solid ${walkInFeature === f.id ? '#f97316' : '#334155'}` }}>
                {f.emoji} {f.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={walkInName} onChange={e => setWalkInName(e.target.value)} placeholder="Nome do cliente"
              className="flex-1 h-10 px-3 rounded-lg text-sm outline-none" style={{ background: '#0b1326', border: '1px solid #334155', color: '#dae2fd' }} />
            <input type="number" min={1} max={20} value={walkInParty} onChange={e => setWalkInParty(e.target.value)}
              className="w-16 h-10 px-2 rounded-lg text-sm text-center outline-none" style={{ background: '#0b1326', border: '1px solid #334155', color: '#dae2fd' }} />
            <button type="button" disabled={busy || !walkInFeature || !walkInName.trim()}
              onClick={async () => { await act({ action: 'addWalkIn', featureId: walkInFeature, name: walkInName.trim(), partySize: Number(walkInParty) }); setWalkInName('') }}
              className="px-4 rounded-lg text-sm font-bold font-mono disabled:opacity-40" style={{ background: '#f97316', color: '#582200' }}>
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
