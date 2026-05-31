'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { PinInput } from '@/components/customer/pin-input'
import { isValidPin } from '@/lib/customer-pin-shared'

type Props = {
  customerId: string
}

export function CustomerPinSettings({ customerId }: Props) {
  const [hasPin, setHasPin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'idle' | 'create' | 'change' | 'remove'>('idle')
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  useEffect(() => {
    fetch(`/api/customer/pin?customer=${customerId}`)
      .then(r => r.json())
      .then(d => { setHasPin(Boolean(d.hasPin)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [customerId])

  async function savePin() {
    if (!isValidPin(newPin)) {
      toast.error('PIN deve ter 4 dígitos.')
      return
    }
    if (newPin !== confirmPin) {
      toast.error('Confirmação do PIN não confere.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/customer/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          pin: newPin,
          currentPin: hasPin ? currentPin : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar PIN.')
      toast.success(hasPin ? 'PIN alterado.' : 'PIN configurado.')
      setHasPin(true)
      setMode('idle')
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar PIN.')
    } finally {
      setSaving(false)
    }
  }

  async function removePin() {
    if (!isValidPin(currentPin)) {
      toast.error('Digite seu PIN atual.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/customer/pin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, pin: currentPin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao remover PIN.')
      toast.success('PIN removido.')
      setHasPin(false)
      setMode('idle')
      setCurrentPin('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover PIN.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  return (
    <section className="rounded-xl p-5 space-y-4" style={{ background: '#131b2e', border: '1px solid #334155' }}>
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>Segurança</p>
        <p className="text-sm font-semibold mt-1">PIN de acesso (opcional)</p>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: '#584237' }}>
          Protege login remoto por WhatsApp. Check-in na mesa continua rápido, sem PIN.
        </p>
      </div>

      {mode === 'idle' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#1e293b' }}>
            <span className="material-symbols-outlined text-[18px]" style={{ color: hasPin ? '#34d399' : '#584237' }}>
              {hasPin ? 'lock' : 'lock_open'}
            </span>
            <span className="text-xs font-mono" style={{ color: '#a78b7d' }}>
              {hasPin ? 'PIN ativo no login remoto' : 'Nenhum PIN configurado'}
            </span>
          </div>
          <button type="button" onClick={() => setMode(hasPin ? 'change' : 'create')}
            className="w-full h-11 rounded-xl text-sm font-mono font-semibold transition-all active:scale-[0.98]"
            style={{ background: '#f97316', color: '#582200' }}>
            {hasPin ? 'Alterar PIN' : 'Criar PIN'}
          </button>
          {hasPin && (
            <button type="button" onClick={() => setMode('remove')}
              className="w-full h-10 rounded-xl text-xs font-mono transition-all"
              style={{ border: '1px solid #584237', color: '#a78b7d' }}>
              Remover PIN
            </button>
          )}
        </div>
      )}

      {(mode === 'create' || mode === 'change') && (
        <div className="space-y-4">
          {hasPin && (
            <div className="space-y-2">
              <p className="text-xs font-mono" style={{ color: '#a78b7d' }}>PIN atual</p>
              <PinInput value={currentPin} onChange={setCurrentPin} autoFocus />
            </div>
          )}
          <div className="space-y-2">
            <p className="text-xs font-mono" style={{ color: '#a78b7d' }}>{hasPin ? 'Novo PIN' : 'Escolha um PIN'}</p>
            <PinInput value={newPin} onChange={setNewPin} autoFocus={!hasPin} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-mono" style={{ color: '#a78b7d' }}>Confirmar PIN</p>
            <PinInput value={confirmPin} onChange={setConfirmPin} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setMode('idle'); setCurrentPin(''); setNewPin(''); setConfirmPin('') }}
              className="flex-1 h-11 rounded-xl text-xs font-mono" style={{ border: '1px solid #584237', color: '#a78b7d' }}>
              Cancelar
            </button>
            <button type="button" onClick={savePin} disabled={saving}
              className="flex-[2] h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: '#f97316', color: '#582200' }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar PIN'}
            </button>
          </div>
        </div>
      )}

      {mode === 'remove' && (
        <div className="space-y-4">
          <p className="text-xs" style={{ color: '#a78b7d' }}>Digite o PIN atual para remover a proteção.</p>
          <PinInput value={currentPin} onChange={setCurrentPin} autoFocus />
          <div className="flex gap-2">
            <button type="button" onClick={() => { setMode('idle'); setCurrentPin('') }}
              className="flex-1 h-11 rounded-xl text-xs font-mono" style={{ border: '1px solid #584237', color: '#a78b7d' }}>
              Cancelar
            </button>
            <button type="button" onClick={removePin} disabled={saving}
              className="flex-[2] h-11 rounded-xl text-sm font-bold flex items-center justify-center disabled:opacity-60"
              style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remover PIN'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
