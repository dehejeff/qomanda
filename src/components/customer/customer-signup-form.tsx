'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatPhoneInput, formatWhatsApp, maskCPF, validateCPF } from '@/lib/customer-form'
import { PinInput } from '@/components/customer/pin-input'
import { isValidLoginPin } from '@/lib/customer-pin-shared'
import type { CustomerRegisterResponse } from '@/app/api/customer/register/route'

type Props = {
  submitLabel?: string
  loading?: boolean
  onSubmit: (payload: {
    firstName: string
    lastName: string
    whatsapp: string
    pin: string
    documentType: 'cpf' | 'passport'
    cpf: string | null
    passport: string | null
  }) => Promise<void>
}

export function CustomerSignupForm({ submitLabel = 'Criar minha conta', loading: externalLoading, onSubmit }: Props) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [whatsapp, setWhatsapp]   = useState('')
  const [pin, setPin]             = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [docType, setDocType]     = useState<'cpf' | 'passport'>('cpf')
  const [cpf, setCpf]             = useState('')
  const [passport, setPassport]   = useState('')
  const [submitting, setSubmitting] = useState(false)

  const cpfDigits   = cpf.replace(/\D/g, '')
  const cpfComplete = cpfDigits.length === 11
  const cpfValid    = cpfComplete && validateCPF(cpf)
  const loading     = externalLoading ?? submitting

  const inputStyle: React.CSSProperties = {
    background: '#161B22', border: '1px solid #30363D', color: '#FFFFFF',
    outline: 'none', width: '100%', height: 48, borderRadius: 12,
    padding: '0 16px', fontSize: 14, fontFamily: 'Geist, sans-serif',
    transition: 'border-color 0.15s',
  }
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = '#00E676' }
  const onBlur  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = '#30363D' }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = firstName.trim()
    const surname = lastName.trim()
    const phone = whatsapp.replace(/\D/g, '')

    if (!name || !surname) { toast.error('Informe nome e sobrenome.'); return }
    if (phone.length < 10) { toast.error('Informe um WhatsApp válido.'); return }
    if (!isValidLoginPin(pin)) { toast.error('Informe um PIN de 4 dígitos.'); return }
    if (pin !== pinConfirm) { toast.error('A confirmação do PIN não confere.'); return }
    if (docType === 'cpf' && cpf && !cpfValid) { toast.error('CPF inválido.'); return }

    setSubmitting(true)
    try {
      await onSubmit({
        firstName: name,
        lastName: surname,
        whatsapp: phone,
        pin,
        documentType: docType,
        cpf: cpfDigits.length === 11 ? cpfDigits : null,
        passport: passport.trim() || null,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#8B949E' }}>Nome</label>
          <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
            placeholder="João" required autoComplete="given-name"
            style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#8B949E' }}>Sobrenome</label>
          <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
            placeholder="Silva" required autoComplete="family-name"
            style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#8B949E' }}>WhatsApp</label>
        <input type="tel" inputMode="tel" value={whatsapp}
          onChange={e => setWhatsapp(docType === 'passport' ? formatPhoneInput(e.target.value) : formatWhatsApp(e.target.value))}
          placeholder={docType === 'passport' ? '+351 912 345 678' : '(11) 99999-9999'} required autoComplete="tel"
          style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#8B949E' }}>PIN de 4 dígitos</label>
        <p className="text-[11px] leading-relaxed" style={{ color: '#30363D' }}>
          Obrigatório para acessar sua conta no Hub.
        </p>
        <PinInput value={pin} onChange={setPin} length={4} />
        <label className="text-[11px] font-mono uppercase tracking-wider pt-1 block" style={{ color: '#8B949E' }}>Confirmar PIN</label>
        <PinInput value={pinConfirm} onChange={setPinConfirm} length={4} />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: '#30363D' }} />
        <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#30363D' }}>Identificação (opcional)</span>
        <div className="flex-1 h-px" style={{ background: '#30363D' }} />
      </div>

      <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #30363D' }}>
        {(['cpf', 'passport'] as const).map(t => (
          <button key={t} type="button" onClick={() => setDocType(t)}
            className="flex-1 py-2.5 text-xs font-mono font-bold uppercase tracking-wider transition-all"
            style={{
              background: docType === t ? '#00E676' : 'transparent',
              color: docType === t ? '#003319' : '#8B949E',
            }}>
            {t === 'cpf' ? '🇧🇷 CPF' : '🌍 Passaporte'}
          </button>
        ))}
      </div>

      {docType === 'cpf' ? (
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#8B949E' }}>CPF</label>
          <input type="text" inputMode="numeric" value={cpf}
            onChange={e => setCpf(maskCPF(e.target.value))}
            placeholder="000.000.000-00" maxLength={14}
            style={{ ...inputStyle, borderColor: cpfComplete ? (cpfValid ? '#34d399' : '#f87171') : '#30363D' }}
            onFocus={onFocus} onBlur={onBlur} />
          {cpfComplete && !cpfValid && (
            <p className="text-[11px] font-mono" style={{ color: '#f87171' }}>CPF inválido.</p>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#8B949E' }}>Passaporte</label>
          <input type="text" value={passport}
            onChange={e => setPassport(e.target.value.toUpperCase())}
            placeholder="AB123456" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
        </div>
      )}

      <p className="text-[11px] leading-relaxed" style={{ color: '#30363D' }}>
        <span className="material-symbols-outlined text-[13px] align-middle mr-1">lock</span>
        Dados usados para NF-e, fidelidade e histórico. Seu WhatsApp + PIN protegem sua conta.
      </p>

      <button type="submit" disabled={loading}
        className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
        style={{ background: '#00E676', color: '#003319', boxShadow: '0 8px 24px rgba(0,230,118,0.25)' }}>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <>
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            {submitLabel}
          </>
        )}
      </button>
    </form>
  )
}

/** Cadastro via API + localStorage + redirect hub */
export async function registerCustomerAndStore(payload: Parameters<Props['onSubmit']>[0]) {
  const res = await fetch('/api/customer/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erro ao criar conta.')

  const registered = data as CustomerRegisterResponse
  localStorage.setItem('kicomanda_customer_id', registered.customerId)
  localStorage.setItem('kicomanda_customer_name', `${registered.firstName} ${registered.lastName}`)
  return registered
}
