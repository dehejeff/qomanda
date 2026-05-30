'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Restaurant } from '@/types'
import type { CheckInResponse } from '@/app/api/checkin/route'

import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

// ── Helpers ─────────────────────────────────────────────────

function formatWhatsApp(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function maskCPF(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function validateCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i)
  let r1 = 11 - (sum % 11)
  if (r1 >= 10) r1 = 0
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i)
  let r2 = 11 - (sum % 11)
  if (r2 >= 10) r2 = 0
  return r1 === parseInt(d[9]) && r2 === parseInt(d[10])
}

// ── Component ────────────────────────────────────────────────

export default function CheckInPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading]       = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkedIn, setCheckedIn]   = useState(false)
  const [tableNumber, setTableNumber] = useState('1')

  // Form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [whatsapp, setWhatsapp]   = useState('')
  const [docType, setDocType]     = useState<'cpf' | 'passport'>('cpf')
  const [cpf, setCpf]             = useState('')
  const [passport, setPassport]   = useState('')

  // CPF validation state
  const cpfDigits   = cpf.replace(/\D/g, '')
  const cpfComplete = cpfDigits.length === 11
  const cpfValid    = cpfComplete && validateCPF(cpf)

  useEffect(() => {
    setTableNumber(new URLSearchParams(window.location.search).get('mesa') ?? '1')
  }, [])

  useEffect(() => {
    async function loadRestaurant() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, slug, logo_url, status')  // sem credenciais sensíveis
        .eq('slug', params.slug).eq('status', 'active').single()
      if (error || !data) { toast.error('Restaurante não encontrado.'); setLoading(false); return }
      setRestaurant(data as unknown as Restaurant)
      setLoading(false)
    }
    loadRestaurant()
  }, [params.slug])

  async function handleCheckIn() {
    if (!restaurant) return
    const name    = firstName.trim()
    const surname = lastName.trim()
    const phone   = whatsapp.replace(/\D/g, '')

    if (!name || !surname) { toast.error('Informe seu nome e sobrenome.'); return }
    if (phone.length < 10)  { toast.error('Informe um WhatsApp válido.'); return }
    if (docType === 'cpf' && cpf && !cpfValid) {
      toast.error('CPF inválido. Verifique os números.'); return
    }

    setCheckingIn(true)
    const mesa = new URLSearchParams(window.location.search).get('mesa') ?? '1'

    // Toda a lógica sensível (upsert de cliente, sessão, fidelidade)
    // roda server-side com service role — sem exposição da tabela customers
    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: params.slug,
        mesa,
        firstName: name,
        lastName: surname,
        whatsapp: phone,
        documentType: docType,
        cpf: cpfDigits.length === 11 ? cpfDigits : null,
        passport: passport.trim() || null,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'Erro ao realizar check-in. Tente novamente.')
      setCheckingIn(false)
      return
    }

    const { sessionId, customerId } = (await res.json()) as CheckInResponse

    localStorage.setItem('qomanda_session_id', sessionId)
    localStorage.setItem('qomanda_customer_id', customerId)
    localStorage.setItem('qomanda_customer_name', `${name} ${surname}`)
    setCheckedIn(true)
    setCheckingIn(false)
    toast.success(`Bem-vindo, ${name}!`)
    setTimeout(() => router.push(`/${params.slug}/home?session=${sessionId}`), 700)
  }

  const tableLabel = tableNumber.padStart(2, '0')
  const formValid  = firstName.trim() && lastName.trim() && whatsapp.replace(/\D/g, '').length >= 10

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  // ── Not found ─────────────────────────────────────────────
  if (!restaurant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
        style={{ background: '#0b1326', color: '#dae2fd' }}>
        <span className="material-symbols-outlined mb-4" style={{ fontSize: 64, color: '#584237' }}>no_meals</span>
        <h1 className="text-xl font-semibold">Restaurante não encontrado</h1>
        <p className="mt-2 text-sm" style={{ color: '#e0c0b1' }}>Verifique o QR Code e tente novamente.</p>
      </div>
    )
  }

  // ── Main ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center relative"
      style={{ background: '#0b1326', color: '#dae2fd' }}>
      {/* Ambient glow */}
      <div className="pointer-events-none fixed top-[-10%] left-[-10%] w-[50%] h-[40%] rounded-full"
        style={{ background: 'rgba(255,182,144,0.07)', filter: 'blur(120px)' }} />
      <div className="pointer-events-none fixed bottom-[-5%] right-[-5%] w-[40%] h-[30%] rounded-full"
        style={{ background: 'rgba(123,208,255,0.07)', filter: 'blur(100px)' }} />

      <div className="relative z-10 w-full max-w-md px-6 pb-10 flex flex-col">
        {/* Header */}
        <header className="pt-8 flex flex-col items-center gap-5 mb-7">
          <div className="flex justify-center items-center h-16">
            {restaurant.logo_url ? (
              <img src={restaurant.logo_url} alt={restaurant.name} className="max-w-[160px] max-h-14 object-contain" />
            ) : (
              <span className="text-2xl font-bold" style={{ color: '#ffb690' }}>{restaurant.name}</span>
            )}
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
              Bem-vindo à{' '}
              <span className="font-bold" style={{ color: '#ffb690' }}>{restaurant.name}</span>
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: '#e0c0b1' }}>
              Confirme seus dados para começar
            </p>
          </div>
        </header>

        {/* Bento grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="col-span-2 p-4 rounded-xl flex items-center justify-between relative overflow-hidden"
            style={{ background: '#1e293b', border: '1px solid #334155' }}>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 100%)' }} />
            <div className="relative z-10">
              <span className="text-xs font-mono uppercase tracking-wider block mb-1" style={{ color: '#e0c0b1' }}>MESA ATUAL</span>
              <span className="font-bold leading-none" style={{ fontSize: 36, color: '#ffb690' }}>{tableLabel}</span>
            </div>
            <div className="relative z-10 flex flex-col items-end gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#ffb690' }}>table_restaurant</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ color: '#34d399', background: 'rgba(52,211,153,0.12)' }}>DISPONÍVEL</span>
            </div>
          </div>
          <div className="p-4 rounded-xl flex flex-col justify-between" style={{ background: '#1e293b', border: '1px solid #334155' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#e0c0b1' }}>timer</span>
            <div className="mt-2">
              <span className="text-[10px] font-mono uppercase tracking-wider block mb-0.5" style={{ color: '#e0c0b1' }}>TEMPO MÉDIO</span>
              <span className="text-lg font-semibold">-- min</span>
            </div>
          </div>
          <div className="p-4 rounded-xl flex flex-col justify-between" style={{ background: '#1e293b', border: '1px solid #334155' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#e0c0b1' }}>person_check</span>
            <div className="mt-2">
              <span className="text-[10px] font-mono uppercase tracking-wider block mb-0.5" style={{ color: '#e0c0b1' }}>ATENDIMENTO</span>
              <span className="text-lg font-semibold">Ativo</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-xl p-5 flex flex-col gap-4 mb-6"
          style={{ background: '#1e293b', border: '1px solid #334155' }}>

          {/* Name row */}
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[20px]" style={{ color: '#ffb690' }}>person</span>
            <span className="text-sm font-semibold">Seus dados</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Nome', value: firstName, set: setFirstName, placeholder: 'João', ac: 'given-name' },
              { label: 'Sobrenome', value: lastName, set: setLastName, placeholder: 'Silva', ac: 'family-name' },
            ].map(f => (
              <div key={f.label} className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#e0c0b1' }}>{f.label}</label>
                <input type="text" value={f.value} onChange={e => f.set(e.target.value)}
                  placeholder={f.placeholder} autoComplete={f.ac}
                  className="w-full h-11 px-3 rounded-lg text-sm outline-none transition-all"
                  style={{ background: '#0b1326', border: '1px solid #584237', color: '#dae2fd' }}
                  onFocus={e => (e.target.style.borderColor = '#f97316')}
                  onBlur={e => (e.target.style.borderColor = '#584237')} />
              </div>
            ))}
          </div>

          {/* WhatsApp */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#e0c0b1' }}>WhatsApp</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px]" style={{ color: '#a78b7d' }}>phone</span>
              <input type="tel" inputMode="numeric" value={whatsapp}
                onChange={e => setWhatsapp(formatWhatsApp(e.target.value))}
                placeholder="(11) 99999-9999" autoComplete="tel"
                className="w-full h-11 pl-9 pr-3 rounded-lg text-sm outline-none transition-all"
                style={{ background: '#0b1326', border: '1px solid #584237', color: '#dae2fd' }}
                onFocus={e => (e.target.style.borderColor = '#f97316')}
                onBlur={e => (e.target.style.borderColor = '#584237')} />
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: '#334155' }} />
            <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#584237' }}>
              Identificação (opcional)
            </span>
            <div className="flex-1 h-px" style={{ background: '#334155' }} />
          </div>

          {/* BR / Estrangeiro toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #334155' }}>
            {(['cpf', 'passport'] as const).map(t => (
              <button key={t} onClick={() => setDocType(t)}
                className="flex-1 py-2.5 text-xs font-mono font-bold uppercase tracking-wider transition-all"
                style={{
                  background: docType === t ? '#f97316' : 'transparent',
                  color: docType === t ? '#582200' : '#a78b7d',
                }}>
                {t === 'cpf' ? '🇧🇷 CPF' : '🌍 Passaporte'}
              </button>
            ))}
          </div>

          {/* CPF field */}
          {docType === 'cpf' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#e0c0b1' }}>CPF</label>
              <div className="relative">
                <input type="text" inputMode="numeric" value={cpf}
                  onChange={e => setCpf(maskCPF(e.target.value))}
                  placeholder="000.000.000-00" maxLength={14}
                  className="w-full h-11 px-3 pr-10 rounded-lg text-sm font-mono outline-none transition-all"
                  style={{
                    background: '#0b1326',
                    border: `1px solid ${cpfComplete ? (cpfValid ? '#34d399' : '#f87171') : '#584237'}`,
                    color: '#dae2fd',
                  }}
                  onFocus={e => { if (!cpfComplete) e.target.style.borderColor = '#f97316' }}
                  onBlur={e => { if (!cpfComplete) e.target.style.borderColor = '#584237' }} />
                {cpfComplete && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px]"
                    style={{ color: cpfValid ? '#34d399' : '#f87171', fontVariationSettings: "'FILL' 1" }}>
                    {cpfValid ? 'check_circle' : 'cancel'}
                  </span>
                )}
              </div>
              {cpfComplete && !cpfValid && (
                <p className="text-[11px] font-mono" style={{ color: '#f87171' }}>CPF inválido. Verifique os números.</p>
              )}
            </div>
          )}

          {/* Passport field */}
          {docType === 'passport' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#e0c0b1' }}>
                Número do Passaporte
              </label>
              <input type="text" value={passport}
                onChange={e => setPassport(e.target.value.toUpperCase())}
                placeholder="AB123456"
                className="w-full h-11 px-3 rounded-lg text-sm font-mono outline-none transition-all"
                style={{ background: '#0b1326', border: '1px solid #584237', color: '#dae2fd' }}
                onFocus={e => (e.target.style.borderColor = '#f97316')}
                onBlur={e => (e.target.style.borderColor = '#584237')} />
            </div>
          )}

          {/* Consent note */}
          <p className="text-[11px] leading-relaxed" style={{ color: '#584237' }}>
            <span className="material-symbols-outlined text-[13px] align-middle mr-1">lock</span>
            Dados usados para emissão de nota fiscal e manutenção do seu histórico de fidelidade. Não compartilhamos com terceiros.
          </p>
        </div>

        {/* CTA */}
        <button onClick={handleCheckIn} disabled={checkingIn || checkedIn || !formValid}
          className="w-full py-5 rounded-xl text-xl font-semibold flex items-center justify-center gap-3 transition-all active:scale-[0.97] disabled:opacity-50"
          style={{
            background: checkedIn ? '#22c55e' : '#f97316',
            color: checkedIn ? '#fff' : '#582200',
            boxShadow: formValid ? '0 16px 32px rgba(249,115,22,0.2)' : 'none',
            fontFamily: 'Geist, sans-serif',
          }}>
          {checkingIn ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : checkedIn ? (
            <>
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Mesa {tableLabel} Ativada
            </>
          ) : (
            <>Fazer Check-in <span className="material-symbols-outlined">login</span></>
          )}
        </button>

        <p className="text-center text-xs font-mono uppercase tracking-widest mt-4"
          style={{ color: 'rgba(218,226,253,0.35)' }}>
          Toque para iniciar o pedido
        </p>

        {/* Footer */}
        <div className="mt-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-1" style={{ color: 'rgba(218,226,253,0.25)' }}>
            <span className="material-symbols-outlined text-base">wifi</span>
            <span className="text-xs font-mono">Free Wi-Fi: QOMANDA_GUEST</span>
          </div>
          <p className="text-xs font-mono" style={{ color: 'rgba(218,226,253,0.18)' }}>Powered by Qomanda</p>
        </div>
      </div>
    </div>
  )
}
