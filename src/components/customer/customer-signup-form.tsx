'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatWhatsApp, maskCPF, validateCPF } from '@/lib/customer-form'
import type { CustomerRegisterResponse } from '@/app/api/customer/register/route'

type Props = {
  submitLabel?: string
  loading?: boolean
  onSubmit: (payload: {
    firstName: string
    lastName: string
    whatsapp: string
    documentType: 'cpf' | 'passport'
    cpf: string | null
    passport: string | null
  }) => Promise<void>
}

export function CustomerSignupForm({ submitLabel = 'Criar minha conta', loading: externalLoading, onSubmit }: Props) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [whatsapp, setWhatsapp]   = useState('')
  const [docType, setDocType]     = useState<'cpf' | 'passport'>('cpf')
  const [cpf, setCpf]             = useState('')
  const [passport, setPassport]   = useState('')
  const [submitting, setSubmitting] = useState(false)

  const cpfDigits   = cpf.replace(/\D/g, '')
  const cpfComplete = cpfDigits.length === 11
  const cpfValid    = cpfComplete && validateCPF(cpf)
  const loading     = externalLoading ?? submitting

  const inputStyle: React.CSSProperties = {
    background: '#131b2e', border: '1px solid #584237', color: '#dae2fd',
    outline: 'none', width: '100%', height: 48, borderRadius: 12,
    padding: '0 16px', fontSize: 14, fontFamily: 'Geist, sans-serif',
    transition: 'border-color 0.15s',
  }
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = '#f97316' }
  const onBlur  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = '#584237' }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = firstName.trim()
    const surname = lastName.trim()
    const phone = whatsapp.replace(/\D/g, '')

    if (!name || !surname) { toast.error('Informe nome e sobrenome.'); return }
    if (phone.length < 10) { toast.error('Informe um WhatsApp válido.'); return }
    if (docType === 'cpf' && cpf && !cpfValid) { toast.error('CPF inválido.'); return }

    setSubmitting(true)
    try {
      await onSubmit({
        firstName: name,
        lastName: surname,
        whatsapp: phone,
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
          <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Nome</label>
          <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
            placeholder="João" required autoComplete="given-name"
            style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Sobrenome</label>
          <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
            placeholder="Silva" required autoComplete="family-name"
            style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>WhatsApp</label>
        <input type="tel" inputMode="numeric" value={whatsapp}
          onChange={e => setWhatsapp(formatWhatsApp(e.target.value))}
          placeholder="(11) 99999-9999" required autoComplete="tel"
          style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: '#334155' }} />
        <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#584237' }}>Identificação (opcional)</span>
        <div className="flex-1 h-px" style={{ background: '#334155' }} />
      </div>

      <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #334155' }}>
        {(['cpf', 'passport'] as const).map(t => (
          <button key={t} type="button" onClick={() => setDocType(t)}
            className="flex-1 py-2.5 text-xs font-mono font-bold uppercase tracking-wider transition-all"
            style={{
              background: docType === t ? '#f97316' : 'transparent',
              color: docType === t ? '#582200' : '#a78b7d',
            }}>
            {t === 'cpf' ? '🇧🇷 CPF' : '🌍 Passaporte'}
          </button>
        ))}
      </div>

      {docType === 'cpf' ? (
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>CPF</label>
          <input type="text" inputMode="numeric" value={cpf}
            onChange={e => setCpf(maskCPF(e.target.value))}
            placeholder="000.000.000-00" maxLength={14}
            style={{ ...inputStyle, borderColor: cpfComplete ? (cpfValid ? '#34d399' : '#f87171') : '#584237' }}
            onFocus={onFocus} onBlur={onBlur} />
          {cpfComplete && !cpfValid && (
            <p className="text-[11px] font-mono" style={{ color: '#f87171' }}>CPF inválido.</p>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Passaporte</label>
          <input type="text" value={passport}
            onChange={e => setPassport(e.target.value.toUpperCase())}
            placeholder="AB123456" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
        </div>
      )}

      <p className="text-[11px] leading-relaxed" style={{ color: '#584237' }}>
        <span className="material-symbols-outlined text-[13px] align-middle mr-1">lock</span>
        Dados usados para NF-e, fidelidade e histórico. Seu WhatsApp é sua chave de acesso.
      </p>

      <button type="submit" disabled={loading}
        className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
        style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 24px rgba(249,115,22,0.25)' }}>
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
  localStorage.setItem('qomanda_customer_id', registered.customerId)
  localStorage.setItem('qomanda_customer_name', `${registered.firstName} ${registered.lastName}`)
  return registered
}
