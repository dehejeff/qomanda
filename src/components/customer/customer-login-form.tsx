'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { formatPhoneInput } from '@/lib/customer-form'
import { PinInput } from '@/components/customer/pin-input'
import { isValidPin } from '@/lib/customer-pin-shared'
import { loginWithWhatsApp, verifyLoginPin, finishCustomerLogin } from '@/lib/customer-login-client'
import type { CustomerLoginResponse } from '@/lib/customer-login-types'

const inputStyle: React.CSSProperties = {
  background: '#131b2e',
  border: '1px solid #584237',
  color: '#dae2fd',
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

export function CustomerLoginForm({ onFocus, onBlur }: Props) {
  const router = useRouter()
  const [whatsapp, setWhatsapp] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [pinStep, setPinStep] = useState<{ challengeToken: string; firstName: string } | null>(null)

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

      if ('requiresPin' in data && data.requiresPin) {
        setPinStep({ challengeToken: data.challengeToken, firstName: data.firstName })
        setPin('')
        toast.message(`Olá, ${data.firstName}! Digite seu PIN.`)
        return
      }

      toast.success(`Olá, ${data.firstName}!`)
      finishCustomerLogin(data, router)
    } catch {
      toast.error('Erro ao entrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pinStep || !isValidPin(pin)) {
      toast.error('PIN deve ter 4 dígitos.')
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
      toast.error('Erro ao verificar PIN.')
    } finally {
      setLoading(false)
    }
  }

  if (pinStep) {
    return (
      <div className="space-y-3">
        <form onSubmit={handlePinSubmit} className="space-y-4">
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold">Olá, {pinStep.firstName}</p>
            <p className="text-xs" style={{ color: '#a78b7d' }}>Digite seu PIN de 4 dígitos</p>
          </div>
          <PinInput value={pin} onChange={setPin} autoFocus disabled={loading} />
          <button type="submit" disabled={loading || !isValidPin(pin)}
            className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
            style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 24px rgba(249,115,22,0.25)' }}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirmar PIN'}
          </button>
        </form>
        <button type="button" onClick={() => { setPinStep(null); setPin('') }}
          className="w-full text-xs font-mono underline underline-offset-2" style={{ color: '#584237' }}>
          Voltar e usar outro WhatsApp
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleWhatsAppSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>
            WhatsApp
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px]" style={{ color: '#a78b7d' }}>phone</span>
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
          style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 24px rgba(249,115,22,0.25)' }}>
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
        style={{ background: '#131b2e', border: '1px solid #584237', color: '#dae2fd' }}>
        <span className="material-symbols-outlined text-[20px]">person_add</span>
        Criar conta de cliente
      </Link>
      <Link href="/scan"
        className="w-full h-11 rounded-xl text-sm font-mono flex items-center justify-center gap-2 transition-all active:scale-95"
        style={{ background: 'transparent', border: '1px solid #334155', color: '#a78b7d' }}>
        <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
        Escanear mesa (check-in)
      </Link>
      <div className="rounded-xl p-4" style={{ background: 'rgba(123,208,255,0.06)', border: '1px solid rgba(123,208,255,0.15)' }}>
        <p className="text-xs leading-relaxed" style={{ color: '#a78b7d' }}>
                <strong style={{ color: '#7bd0ff' }}>Brasil:</strong>{' '}
                DDD + número. <strong style={{ color: '#7bd0ff' }}>Exterior:</strong>{' '}
                comece com + e código do país (ex: +351912345678).
        </p>
      </div>
    </div>
  )
}
