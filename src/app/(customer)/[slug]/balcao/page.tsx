'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PinInput } from '@/components/customer/pin-input'
import { CustomerPinSetupForm } from '@/components/customer/customer-pin-setup-form'
import { isValidLoginPin, isValidCardPassword } from '@/lib/customer-pin-shared'
import { loginWithWhatsApp, verifyLoginPin, setupLoginPin } from '@/lib/customer-login-client'
import { formatPhoneInput, formatWhatsApp } from '@/lib/customer-form'

function maskCPF(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export default function BalcaoPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [modeLoading, setModeLoading] = useState(true)
  const [dineInOnly, setDineInOnly] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantModel, setRestaurantModel] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Conta salva neste aparelho (check-in rápido)
  const [savedCustomerId, setSavedCustomerId] = useState<string | null>(null)
  const [savedCustomerName, setSavedCustomerName] = useState('')
  const [showFullForm, setShowFullForm] = useState(false)

  // Cadastro novo
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [cpf, setCpf] = useState('')

  // Login WhatsApp (conta sem aparelho)
  const [showLogin, setShowLogin] = useState(false)
  const [loginWhatsapp, setLoginWhatsapp] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginPin, setLoginPin] = useState('')
  const [pinStep, setPinStep] = useState<{ challengeToken: string; firstName: string; pinLength: 4 | 6 } | null>(null)
  const [pinSetupStep, setPinSetupStep] = useState<{ challengeToken: string; firstName: string } | null>(null)
  const [setupPin, setSetupPin] = useState('')
  const [setupPinConfirm, setSetupPinConfirm] = useState('')

  useEffect(() => {
    const cid = localStorage.getItem('kicomanda_customer_id')
    const cname = localStorage.getItem('kicomanda_customer_name') ?? ''
    if (cid) { setSavedCustomerId(cid); setSavedCustomerName(cname) }

    async function loadMode() {
      const supabase = createClient()
      const { data } = await supabase
        .from('restaurants')
        .select('name, operational_mode, restaurant_model')
        .eq('slug', slug)
        .eq('status', 'active')
        .maybeSingle()
      setRestaurantName(data?.name ?? '')
      setRestaurantModel(data?.restaurant_model ?? null)
      setDineInOnly(data?.operational_mode === 'dine_in')
      setModeLoading(false)
    }
    loadMode()
  }, [slug])

  /** Cria a sessão de balcão e segue para o cardápio. */
  async function doCounterCheckIn(payload: Record<string, unknown>, displayName?: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/checkin/counter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ...payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro no check-in.')
        toast.error(data.error ?? 'Erro no check-in.')
        return false
      }
      localStorage.setItem('kicomanda_session_id', data.sessionId)
      localStorage.setItem('kicomanda_customer_id', data.customerId)
      localStorage.setItem('kicomanda_service_mode', 'counter')
      if (displayName) localStorage.setItem('kicomanda_customer_name', displayName)
      router.push(`/${slug}/menu?session=${data.sessionId}`)
      return true
    } finally {
      setLoading(false)
    }
  }

  function handleQuickCheckIn() {
    if (!savedCustomerId) return
    void doCounterCheckIn({ customerId: savedCustomerId }, savedCustomerName)
  }

  function handleNewCustomer(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) { toast.error('Informe nome e sobrenome.'); return }
    if (whatsapp.replace(/\D/g, '').length < 10) { toast.error('Informe um WhatsApp válido.'); return }
    if (!isValidLoginPin(pin)) { toast.error('Crie uma senha de 4 dígitos.'); return }
    if (pin !== pinConfirm) { toast.error('As senhas não conferem.'); return }
    const cpfDigits = cpf.replace(/\D/g, '')
    void doCounterCheckIn(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        whatsapp: whatsapp.replace(/\D/g, ''),
        pin,
        documentType: cpfDigits.length === 11 ? 'cpf' : null,
        cpf: cpfDigits.length === 11 ? cpfDigits : null,
      },
      `${firstName.trim()} ${lastName.trim()}`,
    )
  }

  async function handleWhatsAppLogin() {
    // Etapa: criar PIN (conta sem PIN ainda)
    if (pinSetupStep) {
      if (!isValidLoginPin(setupPin)) { toast.error('O PIN deve ter 4 dígitos.'); return }
      if (setupPin !== setupPinConfirm) { toast.error('A confirmação não confere.'); return }
      setLoggingIn(true)
      try {
        const data = await setupLoginPin(pinSetupStep.challengeToken, setupPin, setupPinConfirm)
        if (data.error) { toast.error(data.error); return }
        await doCounterCheckIn({ customerId: data.customerId }, `${data.firstName} ${data.lastName}`)
      } catch { toast.error('Erro ao criar PIN.') } finally { setLoggingIn(false) }
      return
    }

    // Etapa: digitar PIN/senha existente
    if (pinStep) {
      const ok = pinStep.pinLength === 6 ? isValidCardPassword(loginPin) : isValidLoginPin(loginPin)
      if (!ok) { toast.error(pinStep.pinLength === 6 ? 'Senha de 6 dígitos.' : 'PIN de 4 dígitos.'); return }
      setLoggingIn(true)
      try {
        const data = await verifyLoginPin(pinStep.challengeToken, loginPin)
        if (data.error) { toast.error(data.error); return }
        await doCounterCheckIn({ customerId: data.customerId }, `${data.firstName} ${data.lastName}`)
      } catch { toast.error('Erro ao verificar PIN.') } finally { setLoggingIn(false) }
      return
    }

    // Etapa inicial: informar WhatsApp
    const phone = loginWhatsapp.replace(/\D/g, '')
    if (phone.length < 10) { toast.error('Informe um WhatsApp válido.'); return }
    setLoggingIn(true)
    try {
      const data = await loginWithWhatsApp(phone)
      if ('error' in data) { toast.error(data.error); return }
      if ('requiresPinSetup' in data && data.requiresPinSetup) {
        setPinSetupStep({ challengeToken: data.challengeToken, firstName: data.firstName })
        setSetupPin(''); setSetupPinConfirm(''); setPinStep(null)
        toast.message(`${data.firstName}, crie seu PIN de 4 dígitos.`)
        return
      }
      if ('requiresPin' in data && data.requiresPin) {
        setPinStep({ challengeToken: data.challengeToken, firstName: data.firstName, pinLength: data.pinLength })
        setLoginPin('')
        toast.message(`Digite sua ${data.pinLength === 6 ? 'senha' : 'PIN'}, ${data.firstName}.`)
        return
      }
      if ('customerId' in data) {
        await doCounterCheckIn({ customerId: data.customerId }, `${data.firstName} ${data.lastName}`)
      }
    } catch { toast.error('Erro ao entrar.') } finally { setLoggingIn(false) }
  }

  if (modeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1117' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#00E676' }} />
      </div>
    )
  }

  if (dineInOnly) {
    return (
      <div className="min-h-screen px-6 py-10 max-w-md mx-auto" style={{ background: '#0D1117', color: '#FFFFFF' }}>
        <Link href={`/${slug}`} className="text-xs font-mono" style={{ color: '#8B949E' }}>← Voltar</Link>
        <h1 className="text-2xl font-black mt-4">Salão com mesas</h1>
        <p className="text-sm mt-3" style={{ color: '#e0c0b1' }}>
          {restaurantName ? `${restaurantName} atende` : 'Este restaurante atende'} apenas pelo{' '}
          <strong>QR Code na mesa</strong>. Escaneie o código na sua mesa para pedir e pagar.
        </p>
        <Link href={`/${slug}`} className="mt-8 inline-flex w-full justify-center py-3 rounded-xl font-bold"
          style={{ background: '#00E676', color: '#003319' }}>Entendi</Link>
      </div>
    )
  }

  const isFoodHall = restaurantModel === 'food_hall'
  const title = isFoodHall ? 'Praça de alimentação' : 'Pedido no balcão'
  const subtitle = isFoodHall
    ? 'Um cardápio, pedido com número e aviso "pronto" no celular.'
    : 'Faça seu pedido pelo celular. Você recebe um número e avisamos quando ficar pronto.'

  const canQuick = savedCustomerId && !showFullForm

  return (
    <div className="min-h-screen px-6 py-8 max-w-md mx-auto" style={{ background: '#0D1117', color: '#FFFFFF' }}>
      <Link href={`/${slug}`} className="text-xs font-mono" style={{ color: '#8B949E' }}>← Voltar</Link>

      <header className="mt-5 text-center">
        <span className="material-symbols-outlined text-[40px]" style={{ color: '#00E676' }}>countertops</span>
        <h1 className="text-2xl font-black mt-2" style={{ fontFamily: 'Geist, sans-serif' }}>{title}</h1>
        {restaurantName && <p className="text-xs font-mono mt-1" style={{ color: '#8B949E' }}>{restaurantName}</p>}
        <p className="text-sm mt-2 leading-relaxed" style={{ color: '#e0c0b1' }}>{subtitle}</p>
      </header>

      {/* Check-in rápido — conta salva no aparelho */}
      {canQuick && (
        <div className="mt-8 rounded-xl p-5 flex flex-col gap-4"
          style={{ background: 'linear-gradient(145deg,#21262D,#0f172a)', border: '1px solid rgba(0,230,118,0.35)' }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold shrink-0"
              style={{ background: 'rgba(0,230,118,0.15)', color: '#00E676' }}>
              {savedCustomerName.trim()
                ? savedCustomerName.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
                : '?'}
            </div>
            <div>
              <p className="text-sm font-semibold">{savedCustomerName || 'Cliente'}</p>
              <p className="text-xs" style={{ color: '#8B949E' }}>Conta salva neste aparelho</p>
            </div>
          </div>
          <button onClick={handleQuickCheckIn} disabled={loading}
            className="w-full py-4 rounded-xl text-base font-bold flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-50"
            style={{ background: '#00E676', color: '#003319', boxShadow: '0 12px 28px rgba(0,230,118,0.2)' }}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <><span className="material-symbols-outlined">bolt</span> Entrar e ver cardápio</>
            )}
          </button>
          <button type="button" onClick={() => setShowFullForm(true)}
            className="text-xs font-mono underline underline-offset-2 self-center" style={{ color: '#8B949E' }}>
            Usar outra conta
          </button>
        </div>
      )}

      {/* Cadastro novo */}
      {!canQuick && (
        <form onSubmit={handleNewCustomer} className="mt-8 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Nome" autoComplete="given-name"
              className="w-full h-11 px-3 rounded-lg text-sm outline-none"
              style={{ background: '#161B22', border: '1px solid #30363D', color: '#FFFFFF' }} required />
            <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Sobrenome" autoComplete="family-name"
              className="w-full h-11 px-3 rounded-lg text-sm outline-none"
              style={{ background: '#161B22', border: '1px solid #30363D', color: '#FFFFFF' }} required />
          </div>
          <input type="tel" inputMode="tel" value={whatsapp} onChange={e => setWhatsapp(formatWhatsApp(e.target.value))}
            placeholder="WhatsApp — (11) 99999-9999" autoComplete="tel"
            className="w-full h-11 px-3 rounded-lg text-sm outline-none"
            style={{ background: '#161B22', border: '1px solid #30363D', color: '#FFFFFF' }} required />

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#e0c0b1' }}>
              Crie uma senha de 4 dígitos
            </label>
            <p className="text-[11px] flex items-center gap-1.5" style={{ color: '#8B949E' }}>
              <span className="material-symbols-outlined text-[14px]">lock</span>
              Para acessar sua conta nas próximas visitas
            </p>
            <PinInput value={pin} onChange={setPin} length={4} />
            {pin.length === 4 && (
              <>
                <label className="text-[11px] font-mono uppercase tracking-wider mt-1" style={{ color: '#e0c0b1' }}>Confirme a senha</label>
                <PinInput value={pinConfirm} onChange={setPinConfirm} length={4} />
                {pinConfirm.length === 4 && pin !== pinConfirm && (
                  <p className="text-[11px] font-mono" style={{ color: '#f87171' }}>As senhas não conferem.</p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#30363D' }}>CPF na nota (opcional)</label>
            <input type="text" inputMode="numeric" value={cpf} onChange={e => setCpf(maskCPF(e.target.value))}
              placeholder="000.000.000-00" maxLength={14}
              className="w-full h-11 px-3 rounded-lg text-sm font-mono outline-none"
              style={{ background: '#161B22', border: '1px solid #30363D', color: '#FFFFFF' }} />
          </div>

          {error && <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-4 rounded-xl text-base font-bold flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-50"
            style={{ background: '#00E676', color: '#003319' }}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (<>Ver cardápio <span className="material-symbols-outlined">arrow_forward</span></>)}
          </button>

          {savedCustomerId && (
            <button type="button" onClick={() => setShowFullForm(false)}
              className="w-full text-xs font-mono underline underline-offset-2" style={{ color: '#8B949E' }}>
              Voltar para minha conta salva
            </button>
          )}
        </form>
      )}

      {/* Login WhatsApp — conta sem aparelho */}
      {!canQuick && !showLogin && (
        <button type="button" onClick={() => setShowLogin(true)}
          className="w-full text-center text-sm mt-4 py-2" style={{ color: '#30363D' }}>
          Já usei aqui antes →{' '}
          <span className="underline underline-offset-2" style={{ color: '#8B949E' }}>Entrar com WhatsApp</span>
        </button>
      )}

      {!canQuick && showLogin && (
        <div className="mt-5 rounded-xl p-5 flex flex-col gap-4" style={{ background: '#161B22', border: '1px solid #30363D' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: '#8B949E' }}>Entrar com WhatsApp</p>
            <button type="button" onClick={() => { setShowLogin(false); setPinStep(null); setPinSetupStep(null) }}
              className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#21262D', color: '#30363D' }}>
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          {!pinSetupStep && (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px]" style={{ color: '#8B949E' }}>phone</span>
              <input type="tel" inputMode="tel" value={loginWhatsapp} onChange={e => setLoginWhatsapp(formatPhoneInput(e.target.value))}
                placeholder="(21) 99999-9999" autoComplete="tel" disabled={Boolean(pinStep)}
                className="w-full h-11 pl-9 pr-3 rounded-lg text-sm outline-none"
                style={{ background: '#0D1117', border: '1px solid #30363D', color: '#FFFFFF', opacity: pinStep ? 0.6 : 1 }} />
            </div>
          )}

          {pinSetupStep && (
            <CustomerPinSetupForm
              firstName={pinSetupStep.firstName} pin={setupPin} pinConfirm={setupPinConfirm} loading={loggingIn}
              onPinChange={setSetupPin} onPinConfirmChange={setSetupPinConfirm} onSubmit={handleWhatsAppLogin}
              onBack={() => { setPinSetupStep(null); setSetupPin(''); setSetupPinConfirm('') }}
            />
          )}

          {pinStep && !pinSetupStep && (
            <div className="space-y-2">
              <p className="text-xs text-center" style={{ color: '#8B949E' }}>
                {pinStep.pinLength === 6 ? `Senha de ${pinStep.firstName}` : `PIN de ${pinStep.firstName}`}
              </p>
              <PinInput value={loginPin} onChange={setLoginPin} length={pinStep.pinLength} autoFocus disabled={loggingIn} />
            </div>
          )}

          {!pinSetupStep && (
            <button type="button" onClick={handleWhatsAppLogin} disabled={loggingIn || loading}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-50"
              style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.35)', color: '#00E676' }}>
              {loggingIn ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <><span className="material-symbols-outlined">{pinStep ? 'pin' : 'login'}</span>
                  {pinStep ? 'Confirmar' : 'Entrar com WhatsApp'}</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
