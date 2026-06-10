'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'
import { formatPhoneInput } from '@/lib/customer-form'
import { parseWaitlistContacts } from '@/lib/waitlist-contact'

type SelectedTable = { id: string; number: string; capacity: number | null }

interface Props {
  tables: SelectedTable[]
  onClose: () => void
  onConfirm: (name: string, partySize: number, whatsapp: string) => Promise<void>
}

/**
 * Reserva direta pelo grid: confirma um grupo nas mesas já selecionadas na
 * página Mesas. Soma a capacidade das mesas escolhidas.
 */
export function GroupReserveModal({ tables, onClose, onConfirm }: Props) {
  const seats = tables.reduce((s, t) => s + (t.capacity ?? 0), 0)
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [party, setParty] = useState(String(seats || tables.length))
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (!name.trim() || busy) return
    const contacts = parseWaitlistContacts({ whatsapp })
    if ('error' in contacts) {
      toast.error(contacts.error)
      return
    }
    setBusy(true)
    try {
      await onConfirm(name.trim(), Math.max(1, Number(party) || tables.length), contacts.whatsapp)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reservar.')
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-container border border-outline-variant rounded-t-2xl sm:rounded-xl w-full sm:max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <h2 className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>Reservar mesas</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface"><X className="h-5 w-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg px-3 py-2.5 bg-surface-container-low border border-outline-variant">
            <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-1">Mesas selecionadas</p>
            <p className="text-sm text-on-surface font-medium">
              {tables.map(t => `Mesa ${t.number}`).join(', ')}
            </p>
            <p className="text-xs font-mono text-on-surface-variant mt-1">{seats} lugares no total</p>
          </div>

          <div>
            <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1.5 block">Nome do grupo</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Família Souza"
              className="w-full h-11 px-3 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-sm outline-none" />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1.5 block">Pessoas</label>
              <input value={party} onChange={e => setParty(e.target.value.replace(/\D/g, ''))} inputMode="numeric"
                className="w-full h-11 px-3 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-sm outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1.5 block">WhatsApp *</label>
              <input value={whatsapp} onChange={e => setWhatsapp(formatPhoneInput(e.target.value))} inputMode="tel" autoComplete="off" placeholder="(11) 98765-4321"
                className="w-full h-11 px-3 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-sm outline-none font-mono" />
            </div>
          </div>

          <button type="button" onClick={confirm} disabled={busy || !name.trim() || !whatsapp.trim()}
            className="w-full py-2.5 bg-primary-container text-on-primary-container font-bold font-mono text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Reservar ${tables.length} mesa${tables.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
