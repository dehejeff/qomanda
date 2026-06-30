'use client'

import { Loader2 } from 'lucide-react'
import { PinInput } from '@/components/customer/pin-input'
import { isValidLoginPin } from '@/lib/customer-pin-shared'

type Props = {
  firstName: string
  pin: string
  pinConfirm: string
  loading?: boolean
  onPinChange: (v: string) => void
  onPinConfirmChange: (v: string) => void
  onSubmit: () => void
  onBack: () => void
}

export function CustomerPinSetupForm({
  firstName,
  pin,
  pinConfirm,
  loading = false,
  onPinChange,
  onPinConfirmChange,
  onSubmit,
  onBack,
}: Props) {
  const valid = isValidLoginPin(pin) && pin === pinConfirm

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl p-4 space-y-2"
        style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.25)' }}
      >
        <p className="text-sm font-semibold" style={{ color: '#00E676' }}>
          Olá, {firstName}! Crie seu PIN de acesso
        </p>
        <p className="text-xs leading-relaxed" style={{ color: '#8B949E' }}>
          Sua conta foi criada antes do PIN obrigatório. Defina um PIN de 4 dígitos para proteger seu acesso — você usará nas próximas visitas.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider mb-2" style={{ color: '#8B949E' }}>
            Novo PIN (4 dígitos)
          </p>
          <PinInput value={pin} onChange={onPinChange} length={4} autoFocus disabled={loading} />
        </div>
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider mb-2" style={{ color: '#8B949E' }}>
            Confirmar PIN
          </p>
          <PinInput value={pinConfirm} onChange={onPinConfirmChange} length={4} disabled={loading} />
        </div>
      </div>

      <button
        type="button"
        disabled={loading || !valid}
        onClick={onSubmit}
        className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
        style={{ background: '#00E676', color: '#003319', boxShadow: '0 8px 24px rgba(0,230,118,0.25)' }}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Criar PIN e entrar'}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="w-full text-xs font-mono underline underline-offset-2"
        style={{ color: '#30363D' }}
      >
        Voltar e usar outro WhatsApp
      </button>
    </div>
  )
}
