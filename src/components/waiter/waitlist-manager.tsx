'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { WaitlistAddModal, type WaitlistAddPayload } from './waitlist-add-modal'
import { ReserveTablesModal } from './reserve-tables-modal'

type Feature = { id: string; name: string; emoji: string | null }
type FreeTable = { id: string; number: string; capacity: number | null }
type QueueEntry = {
  id: string; featureId: string; name: string; whatsapp: string | null
  secondaryName: string | null; whatsappSecondary: string | null
  partySize: number; status: 'waiting' | 'notified'; source: string
  expiresAt: string | null; notifiedTableNumber: string | null
  reservedTables: FreeTable[]
}
type ReserveTarget = { entryId: string; featureId: string; featureName: string; partySize: number }

/**
 * Primeiro par (cliente da fila, mesa livre) que dá para sentar agora:
 * percorre a fila em ordem e escolhe a menor mesa que comporta o grupo.
 * Mesa sem capacidade definida (null) cabe qualquer grupo, mas só é usada
 * em último caso (ordenada como "infinita").
 */
function nextSeatable(entries: QueueEntry[], free: FreeTable[]): { entry: QueueEntry; table: FreeTable } | null {
  for (const e of entries) {
    if (e.status !== 'waiting') continue
    const fit = free
      .filter(t => t.capacity == null || t.capacity >= e.partySize)
      .sort((a, b) => (a.capacity ?? Infinity) - (b.capacity ?? Infinity))[0]
    if (fit) return { entry: e, table: fit }
  }
  return null
}

/**
 * Gestão da fila de espera (equipe). Usado tanto no app do garçom/recepcionista
 * (`/garcom/fila`) quanto num modal na página Mesas do painel.
 * - `embedded`: esconde o título grande (o modal já tem o seu).
 */
export function WaitlistManager({ embedded = false }: { embedded?: boolean }) {
  const [features, setFeatures] = useState<Feature[]>([])
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [freeByFeature, setFreeByFeature] = useState<Record<string, FreeTable[]>>({})
  const [featureMaxCapacity, setFeatureMaxCapacity] = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [reserveFor, setReserveFor] = useState<ReserveTarget | null>(null)

  const featureLabel = (f: Feature) => `${f.emoji ?? ''} ${f.name}`.trim()

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/waitlist')
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      setFeatures(data.features ?? [])
      setQueue(data.queue ?? [])
      setFreeByFeature(data.freeByFeature ?? {})
      setFeatureMaxCapacity(data.featureMaxCapacity ?? {})
    } finally { setLoading(false) }
  }, [])

  /** Nº de mesas que um grupo precisa numa seção (1 se cabe numa só). */
  function tablesNeeded(featureId: string, partySize: number): number {
    const maxCap = featureMaxCapacity[featureId] ?? null
    return maxCap != null && partySize > maxCap ? Math.ceil(partySize / maxCap) : 1
  }

  /** Adiciona na fila; se grupo grande e houver mesas livres, abre "apontar mesas". */
  async function addToQueue(payload: WaitlistAddPayload) {
    setBusy(true)
    try {
      const res = await fetch('/api/dashboard/waitlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addWalkIn',
          featureId: payload.featureId,
          name: payload.name,
          partySize: payload.partySize,
          whatsapp: payload.whatsapp,
          secondaryName: payload.secondaryName,
          secondaryWhatsapp: payload.secondaryWhatsapp,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await load()
      const isBig = tablesNeeded(payload.featureId, payload.partySize) > 1
      const free = freeByFeature[payload.featureId] ?? []
      if (isBig && free.length > 0 && data.entryId) {
        const feat = features.find(f => f.id === payload.featureId)
        setReserveFor({ entryId: data.entryId, featureId: payload.featureId, featureName: feat ? featureLabel(feat) : 'Mesa', partySize: payload.partySize })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar.')
    } finally { setBusy(false) }
  }

  useEffect(() => {
    void load()
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const poll = setInterval(() => { void load() }, 5000)
    return () => {
      clearInterval(tick)
      clearInterval(poll)
    }
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

  const waiting = queue.filter(e => e.status === 'waiting' && e.featureId)
  const people = waiting.reduce((s, e) => s + (e.partySize || 0), 0)
  const reservas = queue.filter(e => !e.featureId) // reservas diretas (grid), sem seção

  return (
    <div className="space-y-5">
      <div>
        {!embedded && (
          <>
            <h1 className="text-2xl font-black" style={{ letterSpacing: '-0.02em' }}>Fila de espera</h1>
            <p className="text-sm mt-1 font-mono" style={{ color: '#a78b7d' }}>Chame o próximo quando uma mesa da seção liberar.</p>
          </>
        )}
        <p className="text-xs mt-2 font-mono" style={{ color: '#dae2fd' }}>
          <span style={{ color: '#f97316' }}>{waiting.length}</span> grupo{waiting.length !== 1 ? 's' : ''} esperando
          {' · '}<span style={{ color: '#f97316' }}>{people}</span> pessoa{people !== 1 ? 's' : ''}
        </p>
      </div>

      {features.length === 0 && (
        <div className="rounded-2xl py-10 text-center" style={{ background: '#171f33', border: '1px solid rgba(88,66,55,0.4)' }}>
          <p className="text-sm font-mono" style={{ color: '#a78b7d' }}>
            Nenhuma seção cadastrada. Cadastre em Mesas → ao criar ou editar uma mesa.
          </p>
        </div>
      )}

      {features.map(f => {
        const entries = queue.filter(e => e.featureId === f.id)
        const free = freeByFeature[f.id] ?? []
        const seatable = nextSeatable(entries, free)
        return (
          <div key={f.id} className="rounded-2xl p-4" style={{ background: '#171f33', border: '1px solid rgba(88,66,55,0.4)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-base font-bold">{f.emoji} {f.name}</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono" style={{ color: free.length > 0 ? '#34d399' : '#584237' }}>
                  {free.length} livre{free.length !== 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  disabled={busy || !seatable}
                  onClick={() => seatable && act({ action: 'callNext', featureId: f.id, tableId: seatable.table.id })}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono disabled:opacity-40"
                  style={{ background: '#f97316', color: '#582200' }}>
                  Chamar próximo
                </button>
              </div>
            </div>

            {free.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {free.map(t => (
                  <span key={t.id} className="text-[10px] font-mono px-2 py-0.5 rounded"
                    style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                    Mesa {t.number}{t.capacity != null ? ` · ${t.capacity}p` : ''}
                  </span>
                ))}
              </div>
            )}

            {entries.length === 0 ? (
              <p className="text-xs font-mono" style={{ color: '#584237' }}>Ninguém na fila.</p>
            ) : (
              <ul className="space-y-2">
                {entries.map((e, i) => {
                  const ready = e.status === 'notified'
                  const needed = tablesNeeded(f.id, e.partySize)
                  const isBig = needed > 1
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
                        {e.reservedTables.length > 0 && (
                          <p className="text-[10px] font-mono mt-0.5" style={{ color: '#34d399' }}>
                            Reservado: {e.reservedTables.map(t => `Mesa ${t.number}`).join(', ')}
                            {' '}({e.reservedTables.reduce((s, t) => s + (t.capacity ?? 0), 0)} lugares)
                          </p>
                        )}
                        {!ready && isBig && e.reservedTables.length === 0 && (
                          <p className="text-[10px] font-mono mt-0.5" style={{ color: '#fbbf24' }}>
                            Precisa de ~{needed} mesas próximas — aponte as mesas ou sente manualmente
                          </p>
                        )}
                        {!ready && !isBig && free.length > 0 && !free.some(t => t.capacity == null || t.capacity >= e.partySize) && (
                          <p className="text-[10px] font-mono mt-0.5" style={{ color: '#fbbf24' }}>
                            Sem mesa livre p/ {e.partySize}p
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
                        <div className="flex gap-1.5 shrink-0 items-center">
                          {isBig && e.reservedTables.length === 0 && free.length > 0 && (
                            <button type="button" disabled={busy}
                              onClick={() => setReserveFor({ entryId: e.id, featureId: f.id, featureName: featureLabel(f), partySize: e.partySize })}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono" style={{ background: '#f97316', color: '#582200' }}>
                              Reservar mesas
                            </button>
                          )}
                          {isBig && (
                            <button type="button" disabled={busy} onClick={() => act({ action: 'seat', entryId: e.id })}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                              Sentar
                            </button>
                          )}
                          <button type="button" disabled={busy} onClick={() => act({ action: 'cancel', entryId: e.id })}
                            className="text-[11px] font-mono" style={{ color: '#584237' }}>Remover</button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}

      {/* Reservas diretas (feitas pelo grid da página Mesas) */}
      {reservas.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: '#171f33', border: '1px solid rgba(88,66,55,0.4)' }}>
          <p className="text-base font-bold mb-2">Reservas diretas</p>
          <ul className="space-y-2">
            {reservas.map(e => (
              <li key={e.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)' }}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {e.name} <span className="text-[11px] font-mono" style={{ color: '#a78b7d' }}>· {e.partySize}p</span>
                  </p>
                  {e.reservedTables.length > 0 && (
                    <p className="text-[11px] font-mono mt-0.5" style={{ color: '#34d399' }}>
                      {e.reservedTables.map(t => `Mesa ${t.number}`).join(', ')}
                      {' '}({e.reservedTables.reduce((s, t) => s + (t.capacity ?? 0), 0)} lugares)
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button type="button" disabled={busy} onClick={() => act({ action: 'seat', entryId: e.id })}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                    Sentou
                  </button>
                  <button type="button" disabled={busy} onClick={() => act({ action: 'cancel', entryId: e.id })}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-mono" style={{ background: 'transparent', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                    Liberar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Adicionar à fila (recepção/portaria) */}
      {features.length > 0 && (
        <button type="button" onClick={() => setShowAdd(true)}
          className="w-full h-12 rounded-2xl text-sm font-bold font-mono flex items-center justify-center gap-2"
          style={{ background: '#f97316', color: '#582200' }}>
          <Plus className="h-4 w-4" /> Adicionar à fila
        </button>
      )}

      {showAdd && (
        <WaitlistAddModal
          features={features}
          featureMaxCapacity={featureMaxCapacity}
          onClose={() => setShowAdd(false)}
          onAdd={addToQueue}
        />
      )}

      {reserveFor && (
        <ReserveTablesModal
          entryId={reserveFor.entryId}
          featureName={reserveFor.featureName}
          partySize={reserveFor.partySize}
          freeTables={freeByFeature[reserveFor.featureId] ?? []}
          onClose={() => setReserveFor(null)}
          onReserved={load}
        />
      )}
    </div>
  )
}
