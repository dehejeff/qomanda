'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { formatPhoneInput } from '@/lib/customer-form'
import { PinInput } from '@/components/customer/pin-input'
import { isValidCardPassword, isValidLoginPin } from '@/lib/customer-pin-shared'
import { loginWithWhatsApp, verifyLoginPin, setupLoginPin, finishCustomerLogin } from '@/lib/customer-login-client'
import { CustomerPinSetupForm } from '@/components/customer/customer-pin-setup-form'

const inputStyle: React.CSSProperties = {
  background: '#161B22',
  border: '1px solid #30363D',
  color: '#FFFFFF',
  outline: 'none',
  width: '100%',
  height: 48,
  borderRadius: 12,
  padding: '0 16px',
  fontSize: 14,
  fontFamily: 'Geist, sans-serif',
}

type Props = {
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => void
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void
}

type PinStep = {
  challengeToken: string
  firstName: string
  pinLength: 4 | 6
}

type PinSetupStep = {
  challengeToken: string
  firstName: string
}

export function CustomerLoginForm({ onFocus, onBlur }: Props) {
  const router = useRouter()
  const [whatsapp, setWhatsapp] = useState('')
  const [pin, setPin] = useState('')
  const [setupPin, setSetupPin] = useState('')
  const [setupPinConfirm, setSetupPinConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [pinStep, setPinStep] = useState<PinStep | null>(null)
  const [pinSetupStep, setPinSetupStep] = useState<PinSetupStep | null>(null)

  async function handleWhatsAppSubmit(e: React.FormEvent) {
    e.preventDefault()
    const phone = whatsapp.replace(/\D/g, '')
    if (phone.length < 10) {
      toast.error('Informe um WhatsApp válido.')
      return
    }

    setLoading(true)
    try {
      const data = await loginWithWhatsApp(phone)
      if ('error' in data) {
        toast.error(data.error)
        return
      }

      if ('requiresPinSetup' in data && data.requiresPinSetup) {
        setPinSetupStep({
          challengeToken: data.challengeToken,
          firstName: data.firstName,
        })
        setSetupPin('')
        setSetupPinConfirm('')
        return
      }

      if ('requiresPin' in data && data.requiresPin) {
        setPinStep({
          challengeToken: data.challengeToken,
          firstName: data.firstName,
          pinLength: data.pinLength,
        })
        setPin('')
        const label = data.pinLength === 6 ? 'senha de 6 dígitos' : 'PIN de 4 dígitos'
        toast.message(`Olá, ${data.firstName}! Digite sua ${label}.`)
        return
      }

      if ('customerId' in data) {
        toast.success(`Olá, ${data.firstName}!`)
        finishCustomerLogin(data, router)
      }
    } catch {
      toast.error('Erro ao entrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pinStep) return

    const pinValid = pinStep.pinLength === 6
      ? isValidCardPassword(pin)
      : isValidLoginPin(pin)

    if (!pinValid) {
      toast.error(pinStep.pinLength === 6 ? 'A senha deve ter 6 dígitos.' : 'PIN deve ter 4 dígitos.')
      return
    }

    setLoading(true)
    try {
      const data = await verifyLoginPin(pinStep.challengeToken, pin)
      if (data.error) {
        toast.error(data.error)
        return
      }
      toast.success(`Olá, ${data.firstName}!`)
      finishCustomerLogin(data, router)
    } catch {
      toast.error('Erro ao verificar.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePinSetupSubmit() {
    if (!pinSetupStep) return
    if (!isValidLoginPin(setupPin)) {
      toast.error('O PIN deve ter 4 dígitos.')
      return
    }
    if (setupPin !== setupPinConfirm) {
      toast.error('A confirmação do PIN não confere.')
      return
    }

    setLoading(true)
    try {
      const data = await setupLoginPin(pinSetupStep.challengeToken, setupPin, setupPinConfirm)
      if (data.error) {
        toast.error(data.error)
        return
      }
      toast.success(`PIN criado! Olá, ${data.firstName}!`)
      finishCustomerLogin(data, router)
    } catch {
      toast.error('Erro ao criar PIN.')
    } finally {
      setLoading(false)
    }
  }

  if (pinSetupStep) {
    return (
      <CustomerPinSetupForm
        firstName={pinSetupStep.firstName}
        pin={setupPin}
        pinConfirm={setupPinConfirm}
        loading={loading}
        onPinChange={setSetupPin}
        onPinConfirmChange={setSetupPinConfirm}
        onSubmit={handlePinSetupSubmit}
        onBack={() => {
          setPinSetupStep(null)
          setSetupPin('')
          setSetupPinConfirm('')
        }}
      />
    )
  }

  if (pinStep) {
    const isSix = pinStep.pinLength === 6
    const pinValid = isSix ? isValidCardPassword(pin) : isValidLoginPin(pin)

    return (
      <div className="space-y-3">
        <form onSubmit={handlePinSubmit} className="space-y-4">
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold">Olá, {pinStep.firstName}</p>
            <p className="text-xs" style={{ color: '#8B949E' }}>
              {isSix
                ? 'Digite sua senha de 6 dígitos (cartão salvo na conta)'
                : 'Digite seu PIN de 4 dígitos'}
            </p>
          </div>
          <PinInput value={pin} onChange={setPin} length={pinStep.pinLength} autoFocus disabled={loading} />
          <button type="submit" disabled={loading || !pinValid}
            className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
            style={{ background: '#00E676', color: '#003319', boxShadow: '0 8px 24px rgba(0,230,118,0.25)' }}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : isSix ? 'Confirmar senha' : 'Confirmar PIN'}
          </button>
        </form>
        <button type="button" onClick={() => { setPinStep(null); setPin('') }}
          className="w-full text-xs font-mono underline underline-offset-2" style={{ color: '#30363D' }}>
          Voltar e usar outro WhatsApp
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleWhatsAppSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#8B949E' }}>
            WhatsApp
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px]" style={{ color: '#8B949E' }}>phone</span>
            <input
              type="tel"
              inputMode="numeric"
              value={whatsapp}
              onChange={e => setWhatsapp(formatPhoneInput(e.target.value))}
              placeholder="(21) 99999-9999 ou +351…"
              required
              autoComplete="tel"
              style={{ ...inputStyle, paddingLeft: 40 }}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>
        </div>
        <button type="submit" disabled={loading}
          className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
          style={{ background: '#00E676', color: '#003319', boxShadow: '0 8px 24px rgba(0,230,118,0.25)' }}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <>
              <span className="material-symbols-outlined text-[20px]">login</span>
              Entrar na minha conta
            </>
          )}
        </button>
      </form>
      <Link href="/cadastro?tipo=cliente"
        className="w-full h-12 rounded-xl text-sm font-mono flex items-center justify-center gap-2 transition-all active:scale-95"
        style={{ background: '#161B22', border: '1px solid #30363D', color: '#FFFFFF' }}>
        <span className="material-symbols-outlined text-[20px]">person_add</span>
        Criar conta de cliente
      </Link>
      <Link href="/scan"
        className="w-full h-11 rounded-xl text-sm font-mono flex items-center justify-center gap-2 transition-all active:scale-95"
        style={{ background: 'transparent', border: '1px solid #30363D', color: '#8B949E' }}>
        <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
        Escanear mesa (check-in)
      </Link>
      <div className="rounded-xl p-4" style={{ background: 'rgba(123,208,255,0.06)', border: '1px solid rgba(123,208,255,0.15)' }}>
        <p className="text-xs leading-relaxed" style={{ color: '#8B949E' }}>
                <strong style={{ color: '#58A6FF' }}>Brasil:</strong>{' '}
                DDD + número. <strong style={{ color: '#58A6FF' }}>Exterior:</strong>{' '}
                comece com + e código do país (ex: +351912345678).
        </p>
      </div>
    </div>
  )
}
