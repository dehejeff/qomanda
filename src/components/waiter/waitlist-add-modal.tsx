'use client'

import { useState } from 'react'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatPhoneInput } from '@/lib/customer-form'
import { parseWaitlistContacts } from '@/lib/waitlist-contact'

type Feature = { id: string; name: string; emoji: string | null }

export type WaitlistAddPayload = {
  featureId: string
  name: string
  partySize: number
  whatsapp: string
  secondaryName: string | null
  secondaryWhatsapp: string | null
}

interface Props {
  features: Feature[]
  /** Maior capacidade de uma única mesa por característica (null = ilimitada). */
  featureMaxCapacity: Record<string, number | null>
  onClose: () => void
  onAdd: (payload: WaitlistAddPayload) => Promise<void>
}

/**
 * Modal de "Adicionar cliente à fila de espera" (recepção/portaria).
 */
export function WaitlistAddModal({ features, featureMaxCapacity, onClose, onAdd }: Props) {
  const [feature, setFeature] = useState('')
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [party, setParty] = useState('2')
  const [showSecond, setShowSecond] = useState(false)
  const [secondName, setSecondName] = useState('')
  const [secondWhatsapp, setSecondWhatsapp] = useState('')
  const [busy, setBusy] = useState(false)

  const p = Math.max(1, Number(party) || 1)
  const maxCap = feature ? featureMaxCapacity[feature] ?? null : null
  const tablesNeeded = maxCap != null && p > maxCap ? Math.ceil(p / maxCap) : 1
  const isBigGroup = tablesNeeded > 1

  async function submit() {
    if (!feature || !name.trim() || busy) return
    const parsed = parseWaitlistContacts({
      whatsapp,
      secondaryName: showSecond ? secondName : null,
      secondaryWhatsapp: showSecond ? secondWhatsapp : null,
    })
    if ('error' in parsed) {
      toast.error(parsed.error)
      return
    }
    setBusy(true)
    try {
      await onAdd({
        featureId: feature,
        name: name.trim(),
        partySize: p,
        whatsapp: parsed.whatsapp,
        secondaryName: parsed.secondaryName,
        secondaryWhatsapp: parsed.whatsappSecondary,
      })
      onClose()
    } finally { setBusy(false) }
  }

  const canSubmit = Boolean(feature && name.trim() && whatsapp.replace(/\D/g, '').length >= 10)

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl"
        style={{ background: '#161B22', color: '#FFFFFF', fontFamily: 'Geist, sans-serif', border: '1px solid rgba(88,66,55,0.4)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(88,66,55,0.4)' }}>
          <h2 className="text-base font-black">Adicionar à fila</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#8B949E' }} aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-[9px] font-mono uppercase tracking-widest mb-1.5" style={{ color: '#8B949E' }}>Seção desejada</label>
            <div className="flex flex-wrap gap-2">
              {features.map(f => (
                <button key={f.id} type="button" onClick={() => setFeature(f.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono"
                  style={{ background: feature === f.id ? '#00E676' : 'transparent', color: feature === f.id ? '#003319' : '#8B949E', border: `1px solid ${feature === f.id ? '#00E676' : '#30363D'}` }}>
                  {f.emoji} {f.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: '#8B949E' }}>Cliente</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do cliente"
                className="w-full h-10 px-3 rounded-lg text-sm outline-none" style={{ background: '#0D1117', border: '1px solid #30363D', color: '#FFFFFF' }} />
            </div>
            <div>
              <label className="block text-[9px] font-mono uppercase tracking-widest mb-1 text-center" style={{ color: '#8B949E' }}>Pessoas</label>
              <input type="number" min={1} max={50} value={party} onChange={e => setParty(e.target.value)} aria-label="Nº de pessoas"
                className="w-16 h-10 px-2 rounded-lg text-sm text-center outline-none" style={{ background: '#0D1117', border: '1px solid #30363D', color: '#FFFFFF' }} />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: '#8B949E' }}>
              WhatsApp <span style={{ color: '#00E676' }}>*</span>
            </label>
            <input
              value={whatsapp}
              onChange={e => setWhatsapp(formatPhoneInput(e.target.value))}
              placeholder="(11) 98765-4321"
              inputMode="tel"
              autoComplete="off"
              className="w-full h-10 px-3 rounded-lg text-sm outline-none font-mono"
              style={{ background: '#0D1117', border: '1px solid #30363D', color: '#FFFFFF' }}
            />
            <p className="text-[10px] mt-1" style={{ color: '#30363D' }}>Aviso quando a mesa liberar (WhatsApp do restaurante).</p>
          </div>

          {!showSecond ? (
            <button
              type="button"
              onClick={() => setShowSecond(true)}
              className="flex items-center gap-1.5 text-xs font-mono"
              style={{ color: '#58A6FF' }}
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar outra pessoa do grupo (opcional)
            </button>
          ) : (
            <div className="rounded-lg p-3 space-y-3" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid #30363D' }}>
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: '#8B949E' }}>2ª pessoa — também recebe aviso</p>
                <button type="button" onClick={() => { setShowSecond(false); setSecondName(''); setSecondWhatsapp('') }}
                  className="p-1 rounded" style={{ color: '#8B949E' }} aria-label="Remover segunda pessoa">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <input value={secondName} onChange={e => setSecondName(e.target.value)} placeholder="Nome (opcional)"
                className="w-full h-10 px-3 rounded-lg text-sm outline-none" style={{ background: '#0D1117', border: '1px solid #30363D', color: '#FFFFFF' }} />
              <input
                value={secondWhatsapp}
                onChange={e => setSecondWhatsapp(formatPhoneInput(e.target.value))}
                placeholder="WhatsApp da 2ª pessoa"
                inputMode="tel"
                className="w-full h-10 px-3 rounded-lg text-sm outline-none font-mono"
                style={{ background: '#0D1117', border: '1px solid #30363D', color: '#FFFFFF' }}
              />
            </div>
          )}

          {isBigGroup && (
            <div className="rounded-lg px-3 py-2.5 text-xs font-mono" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}>
              Grupo grande: a maior mesa dessa seção comporta {maxCap} pessoas.
              Este grupo precisará de <strong>~{tablesNeeded} mesas próximas</strong> — a equipe junta as mesas ao sentar.
            </div>
          )}

          <button type="button" onClick={submit} disabled={busy || !canSubmit}
            className="w-full h-11 rounded-lg text-sm font-bold font-mono disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: '#00E676', color: '#003319' }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adicionar à fila'}
          </button>
        </div>
      </div>
    </div>
  )
}
