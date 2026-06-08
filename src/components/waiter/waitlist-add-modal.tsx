'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'

type Feature = { id: string; name: string; emoji: string | null }

interface Props {
  features: Feature[]
  /** Maior capacidade de uma única mesa por característica (null = ilimitada). */
  featureMaxCapacity: Record<string, number | null>
  onClose: () => void
  onAdd: (featureId: string, name: string, partySize: number, whatsapp: string) => Promise<void>
}

/**
 * Modal de "Adicionar cliente à fila de espera" (recepção/portaria).
 * Detecta grupo grande: se o nº de pessoas passa da maior mesa da característica,
 * mostra que precisará de N mesas próximas (a equipe junta as mesas na hora).
 */
export function WaitlistAddModal({ features, featureMaxCapacity, onClose, onAdd }: Props) {
  const [feature, setFeature] = useState('')
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [party, setParty] = useState('2')
  const [busy, setBusy] = useState(false)

  const p = Math.max(1, Number(party) || 1)
  const maxCap = feature ? featureMaxCapacity[feature] ?? null : null
  const tablesNeeded = maxCap != null && p > maxCap ? Math.ceil(p / maxCap) : 1
  const isBigGroup = tablesNeeded > 1

  async function submit() {
    if (!feature || !name.trim() || busy) return
    setBusy(true)
    try {
      await onAdd(feature, name.trim(), p, whatsapp.replace(/\D/g, ''))
      onClose()
    } finally { setBusy(false) }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl"
        style={{ background: '#171f33', color: '#dae2fd', fontFamily: 'Geist, sans-serif', border: '1px solid rgba(88,66,55,0.4)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(88,66,55,0.4)' }}>
          <h2 className="text-base font-black">Adicionar à fila</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#a78b7d' }} aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-[9px] font-mono uppercase tracking-widest mb-1.5" style={{ color: '#a78b7d' }}>Característica desejada</label>
            <div className="flex flex-wrap gap-2">
              {features.map(f => (
                <button key={f.id} type="button" onClick={() => setFeature(f.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono"
                  style={{ background: feature === f.id ? '#f97316' : 'transparent', color: feature === f.id ? '#582200' : '#a78b7d', border: `1px solid ${feature === f.id ? '#f97316' : '#334155'}` }}>
                  {f.emoji} {f.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: '#a78b7d' }}>Cliente</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do cliente"
                className="w-full h-10 px-3 rounded-lg text-sm outline-none" style={{ background: '#0b1326', border: '1px solid #334155', color: '#dae2fd' }} />
            </div>
            <div>
              <label className="block text-[9px] font-mono uppercase tracking-widest mb-1 text-center" style={{ color: '#a78b7d' }}>Pessoas</label>
              <input type="number" min={1} max={50} value={party} onChange={e => setParty(e.target.value)} aria-label="Nº de pessoas"
                className="w-16 h-10 px-2 rounded-lg text-sm text-center outline-none" style={{ background: '#0b1326', border: '1px solid #334155', color: '#dae2fd' }} />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: '#a78b7d' }}>WhatsApp <span className="opacity-60">(opcional)</span></label>
            <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 90000-0000" inputMode="tel"
              className="w-full h-10 px-3 rounded-lg text-sm outline-none" style={{ background: '#0b1326', border: '1px solid #334155', color: '#dae2fd' }} />
          </div>

          {isBigGroup && (
            <div className="rounded-lg px-3 py-2.5 text-xs font-mono" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}>
              Grupo grande: a maior mesa dessa característica comporta {maxCap} pessoas.
              Este grupo precisará de <strong>~{tablesNeeded} mesas próximas</strong> — a equipe junta as mesas ao sentar.
            </div>
          )}

          <button type="button" onClick={submit} disabled={busy || !feature || !name.trim()}
            className="w-full h-11 rounded-lg text-sm font-bold font-mono disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: '#f97316', color: '#582200' }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adicionar à fila'}
          </button>
        </div>
      </div>
    </div>
  )
}
