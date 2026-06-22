'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Restaurant } from '@/types'
import type { CheckInResponse } from '@/app/api/checkin/route'

import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { formatPhoneInput, formatWhatsApp } from '@/lib/customer-form'
import { PinInput } from '@/components/customer/pin-input'
import { isValidCardPassword, isValidLoginPin } from '@/lib/customer-pin-shared'
import { loginWithWhatsApp, verifyLoginPin, setupLoginPin } from '@/lib/customer-login-client'
import { CustomerPinSetupForm } from '@/components/customer/customer-pin-setup-form'
import {
  findCustomerActiveSession,
  navigateToCustomerHome,
  persistCustomerAuth,
  setCustomerSessionToken,
  type CustomerActiveSession,
} from '@/lib/customer-auth'
import {
  clearPendingTableCheckIn,
  readPendingTableCheckIn,
  readTableCheckInQuery,
  stashPendingTableCheckIn,
} from '@/lib/table-checkin-url'
import type { CheckInVerifyResponse } from '@/app/api/checkin/verify/route'
import Link from 'next/link'
import { TestTableCheckInLink } from '@/components/customer/test-table-checkin-link'

// ── Helpers ─────────────────────────────────────────────────

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
  const searchParams = useSearchParams()
  const queryFromUrl = readTableCheckInQuery(searchParams)
  const pendingQr = queryFromUrl.mesa && queryFromUrl.token
    ? null
    : readPendingTableCheckIn(params.slug)
  const mesaParam = queryFromUrl.mesa ?? pendingQr?.mesa ?? null
  const tokenParam = queryFromUrl.token ?? pendingQr?.token ?? null

  const [openSession, setOpenSession] = useState<CustomerActiveSession | null>(null)

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [operationalMode, setOperationalMode] = useState<'dine_in' | 'counter' | 'both'>('dine_in')
  const [hasWaitlist, setHasWaitlist] = useState(false)
  const [loading, setLoading]       = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkedIn, setCheckedIn]   = useState(false)
  const [tableNumber, setTableNumber] = useState('')
  const [tableToken, setTableToken] = useState<string | null>(null)
  const [tableStatus, setTableStatus] = useState<string | null>(null)
  const [verifyLoading, setVerifyLoading] = useState(true)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  // Form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [whatsapp, setWhatsapp]   = useState('')
  const [docType, setDocType]     = useState<'cpf' | 'passport'>('cpf')
  const [cpf, setCpf]             = useState('')
  const [passport, setPassport]   = useState('')
  const [checkInPin, setCheckInPin] = useState('')
  const [checkInPinConfirm, setCheckInPinConfirm] = useState('')
  const [savedCustomerId, setSavedCustomerId] = useState<string | null>(
    () => (typeof window !== 'undefined' ? localStorage.getItem('kicomanda_customer_id') : null)
  )
  const [savedCustomerName, setSavedCustomerName] = useState(
    () => (typeof window !== 'undefined' ? (localStorage.getItem('kicomanda_customer_name') ?? '') : '')
  )
  const [showFullForm, setShowFullForm] = useState(false)
  const [loginWhatsapp, setLoginWhatsapp] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginPin, setLoginPin] = useState('')
  const [pinStep, setPinStep] = useState<{ challengeToken: string; firstName: string; pinLength: 4 | 6 } | null>(null)
  const [pinSetupStep, setPinSetupStep] = useState<{ challengeToken: string; firstName: string } | null>(null)
  const [setupPin, setSetupPin] = useState('')
  const [setupPinConfirm, setSetupPinConfirm] = useState('')
  const [accessMode, setAccessMode] = useState<'choose' | 'new' | 'returning'>('choose')

  // CPF validation state
  const cpfDigits   = cpf.replace(/\D/g, '')
  const cpfComplete = cpfDigits.length === 11
  const cpfValid    = cpfComplete && validateCPF(cpf)

  useEffect(() => {
    async function verifyTable() {
      setVerifyLoading(true)
      setVerifyError(null)
      setTableToken(null)
      setTableNumber('')
      setTableStatus(null)

      if (!mesaParam || !tokenParam) {
        setVerifyError('Escaneie o QR Code na mesa para fazer check-in.')
        setVerifyLoading(false)
        return
      }

      setTableNumber(mesaParam)
      setTableToken(tokenParam)

      try {
        const qs = new URLSearchParams({ slug: params.slug, mesa: mesaParam, t: tokenParam })
        const res = await fetch(`/api/checkin/verify?${qs}`)
        const data = (await res.json()) as CheckInVerifyResponse
        if (!data.valid) {
          setVerifyError(data.error ?? 'QR Code inválido.')
          setVerifyLoading(false)
          return
        }
        setTableStatus(data.tableStatus ?? 'free')
        setVerifyError(null)
        stashPendingTableCheckIn(params.slug, mesaParam, tokenParam)
      } catch {
        setVerifyError('Não foi possível validar a mesa. Tente escanear novamente.')
      } finally {
        setVerifyLoading(false)
      }
    }

    verifyTable()
  }, [params.slug, mesaParam, tokenParam])

  useEffect(() => {
    async function loadRestaurant() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, slug, logo_url, status, operational_mode')
        .eq('slug', params.slug).eq('status', 'active').single()
      if (error || !data) { toast.error('Restaurante não encontrado.'); setLoading(false); return }
      if (data.operational_mode === 'counter' && !mesaParam && !tokenParam) {
        router.replace(`/${params.slug}/balcao`)
        return
      }
      setOperationalMode((data.operational_mode as 'dine_in' | 'counter' | 'both') ?? 'dine_in')
      setRestaurant(data as unknown as Restaurant)
      // Tem fila de espera por característica de mesa?
      const { count } = await supabase
        .from('table_features').select('id', { count: 'exact', head: true }).eq('restaurant_id', data.id)
      setHasWaitlist((count ?? 0) > 0)
      setLoading(false)
    }
    loadRestaurant()
  }, [params.slug, mesaParam, tokenParam, router])

  useEffect(() => {
    if (mesaParam && tokenParam) {
      setOpenSession(null)
      return
    }
    if (loading || !restaurant) return

    const customerId = localStorage.getItem('kicomanda_customer_id')
    if (!customerId) {
      setOpenSession(null)
      return
    }

    let cancelled = false
    async function loadOpenSession() {
      const supabase = createClient()
      const active = await findCustomerActiveSession(supabase, customerId!)
      if (!cancelled && active?.slug === params.slug) setOpenSession(active)
    }
    void loadOpenSession()
    return () => { cancelled = true }
  }, [mesaParam, tokenParam, loading, restaurant, params.slug])

  async function handleCheckIn() {
    if (!restaurant || !tableToken) return
    const name    = firstName.trim()
    const surname = lastName.trim()
    const phone   = whatsapp.replace(/\D/g, '')

    if (!name || !surname) { toast.error('Informe seu nome e sobrenome.'); return }
    if (phone.length < 10)  { toast.error('Informe um WhatsApp válido.'); return }
    if (!isValidLoginPin(checkInPin)) {
      toast.error('Informe um PIN de 4 dígitos.')
      return
    }
    if (checkInPin !== checkInPinConfirm) {
      toast.error('A confirmação do PIN não confere.')
      return
    }
    if (docType === 'cpf' && cpf && !cpfValid) {
      toast.error('CPF inválido. Verifique os números.'); return
    }

    setCheckingIn(true)

    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: params.slug,
        mesa: tableNumber,
        tableToken,
        firstName: name,
        lastName: surname,
        whatsapp: phone,
        documentType: docType,
        cpf: cpfDigits.length === 11 ? cpfDigits : null,
        passport: passport.trim() || null,
        pin: checkInPin,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'Erro ao realizar check-in. Tente novamente.')
      setCheckingIn(false)
      return
    }

    const { sessionId, customerId } = (await res.json()) as CheckInResponse

    localStorage.setItem('kicomanda_session_id', sessionId)
    localStorage.setItem('kicomanda_customer_id', customerId)
    localStorage.setItem('kicomanda_customer_name', `${name} ${surname}`)
    setCheckedIn(true)
    setCheckingIn(false)
    clearPendingTableCheckIn()
    toast.success(`Bem-vindo, ${name}!`)
    navigateToCustomerHome(params.slug, sessionId)
  }

  async function handleWhatsAppLogin() {
    if (pinSetupStep) {
      if (!isValidLoginPin(setupPin)) {
        toast.error('O PIN deve ter 4 dígitos.')
        return
      }
      if (setupPin !== setupPinConfirm) {
        toast.error('A confirmação do PIN não confere.')
        return
      }
      setLoggingIn(true)
      try {
        const data = await setupLoginPin(pinSetupStep.challengeToken, setupPin, setupPinConfirm)
        if (data.error) {
          toast.error(data.error)
          return
        }
        persistCustomerAuth(data.customerId, data.firstName, data.lastName, data.activeSession)
        if (data.sessionToken) setCustomerSessionToken(data.sessionToken)
        setSavedCustomerId(data.customerId)
        setSavedCustomerName(`${data.firstName} ${data.lastName}`)
        setShowFullForm(false)
        setPinSetupStep(null)
        setSetupPin('')
        setSetupPinConfirm('')

        if (data.activeSession?.slug === params.slug) {
          toast.success(`PIN criado! Bem-vindo, ${data.firstName}!`)
          navigateToCustomerHome(params.slug, data.activeSession.sessionId)
          return
        }
        const checked = await autoCheckInAfterLogin(data.customerId, data.firstName)
        if (!checked) toast.success(`PIN criado! Olá, ${data.firstName}! Toque para entrar na mesa.`)
      } catch {
        toast.error('Erro ao criar PIN.')
      } finally {
        setLoggingIn(false)
      }
      return
    }

    if (pinStep) {
      const pinValid = pinStep.pinLength === 6
        ? isValidCardPassword(loginPin)
        : isValidLoginPin(loginPin)
      if (!pinValid) {
        toast.error(pinStep.pinLength === 6 ? 'A senha deve ter 6 dígitos.' : 'PIN deve ter 4 dígitos.')
        return
      }
      setLoggingIn(true)
      try {
        const data = await verifyLoginPin(pinStep.challengeToken, loginPin)
        if (data.error) {
          toast.error(data.error)
          return
        }
        persistCustomerAuth(data.customerId, data.firstName, data.lastName, data.activeSession)
        if (data.sessionToken) setCustomerSessionToken(data.sessionToken)
        setSavedCustomerId(data.customerId)
        setSavedCustomerName(`${data.firstName} ${data.lastName}`)
        setShowFullForm(false)
        setPinStep(null)
        setLoginPin('')

        if (data.activeSession?.slug === params.slug) {
          toast.success(`Bem-vindo de volta, ${data.firstName}!`)
          navigateToCustomerHome(params.slug, data.activeSession.sessionId)
          return
        }
        const checked = await autoCheckInAfterLogin(data.customerId, data.firstName)
        if (!checked) toast.success(`Olá, ${data.firstName}! Toque para entrar na mesa.`)
      } catch {
        toast.error('Erro ao verificar PIN.')
      } finally {
        setLoggingIn(false)
      }
      return
    }

    const phone = loginWhatsapp.replace(/\D/g, '')
    if (phone.length < 10) {
      toast.error('Informe um WhatsApp válido.')
      return
    }

    setLoggingIn(true)
    try {
      const data = await loginWithWhatsApp(phone)
      if ('error' in data) {
        toast.error(data.error)
        if (!savedCustomerId) {
          setShowFullForm(true)
          setAccessMode('new')
        }
        return
      }

      if ('requiresPinSetup' in data && data.requiresPinSetup) {
        setPinSetupStep({
          challengeToken: data.challengeToken,
          firstName: data.firstName,
        })
        setSetupPin('')
        setSetupPinConfirm('')
        setPinStep(null)
        toast.message(`${data.firstName}, crie seu PIN de 4 dígitos para continuar.`)
        return
      }

      if ('requiresPin' in data && data.requiresPin) {
        setPinStep({
          challengeToken: data.challengeToken,
          firstName: data.firstName,
          pinLength: data.pinLength,
        })
        setLoginPin('')
        const label = data.pinLength === 6 ? 'senha' : 'PIN'
        toast.message(`Digite sua ${label}, ${data.firstName}.`)
        return
      }

      if (!('customerId' in data)) return

      persistCustomerAuth(data.customerId, data.firstName, data.lastName, data.activeSession)
      if ('sessionToken' in data && data.sessionToken) setCustomerSessionToken(data.sessionToken)
      setSavedCustomerId(data.customerId)
      setSavedCustomerName(`${data.firstName} ${data.lastName}`)
      setShowFullForm(false)

      if (data.activeSession?.slug === params.slug) {
        toast.success(`Bem-vindo de volta, ${data.firstName}!`)
        navigateToCustomerHome(params.slug, data.activeSession.sessionId)
        return
      }

      const checked = await autoCheckInAfterLogin(data.customerId, data.firstName)
      if (!checked) toast.success(`Olá, ${data.firstName}! Toque para entrar na mesa.`)
    } catch {
      toast.error('Erro ao entrar. Tente novamente.')
    } finally {
      setLoggingIn(false)
    }
  }

  async function autoCheckInAfterLogin(customerId: string, firstName: string): Promise<boolean> {
    if (!tableToken || !restaurant) return false
    setCheckingIn(true)
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: params.slug, mesa: tableNumber, tableToken, customerId }),
      })
      if (!res.ok) return false
      const { sessionId, customerId: cid } = (await res.json()) as CheckInResponse
      localStorage.setItem('kicomanda_session_id', sessionId)
      localStorage.setItem('kicomanda_customer_id', cid)
      clearPendingTableCheckIn()
      toast.success(`Bem-vindo de volta, ${firstName}!`)
      navigateToCustomerHome(params.slug, sessionId)
      return true
    } catch {
      return false
    } finally {
      setCheckingIn(false)
    }
  }

  async function handleQuickCheckIn() {
    if (!restaurant || !savedCustomerId || !tableToken) return
    setCheckingIn(true)

    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: params.slug, mesa: tableNumber, tableToken, customerId: savedCustomerId }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'Erro no check-in rápido. Preencha seus dados.')
      setShowFullForm(true)
      setAccessMode('new')
      setCheckingIn(false)
      return
    }

    const { sessionId, customerId } = (await res.json()) as CheckInResponse
    localStorage.setItem('kicomanda_session_id', sessionId)
    localStorage.setItem('kicomanda_customer_id', customerId)
    setCheckedIn(true)
    setCheckingIn(false)
    clearPendingTableCheckIn()
    const first = savedCustomerName.split(' ')[0] || 'Cliente'
    toast.success(`Bem-vindo de volta, ${first}!`)
    navigateToCustomerHome(params.slug, sessionId)
  }

  const tableLabel = tableNumber ? tableNumber.padStart(2, '0') : '—'
  const formValid  = firstName.trim()
    && lastName.trim()
    && whatsapp.replace(/\D/g, '').length >= 10
    && isValidLoginPin(checkInPin)
    && checkInPin === checkInPinConfirm
  const canQuickCheckIn = savedCustomerId && !showFullForm && Boolean(tableToken) && !verifyError
  const tableVerified = Boolean(tableToken) && !verifyError && !verifyLoading
  const statusLabel = tableStatus === 'occupied' ? 'EM USO' : tableStatus === 'reserved' ? 'RESERVADA' : 'DISPONÍVEL'
  const statusColor = tableStatus === 'occupied' ? '#f97316' : tableStatus === 'reserved' ? '#a78b7d' : '#34d399'

  // ── Loading ──────────────────────────────────────────────
  if (loading || verifyLoading) {
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

  // ── QR obrigatório (ou hub salão+balcão) ───────────────────
  if (!tableVerified) {
    const isBothMode = operationalMode === 'both'
    const isCounterOnly = operationalMode === 'counter'
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative"
        style={{ background: '#0b1326', color: '#dae2fd' }}>
        <div className="pointer-events-none fixed top-[-10%] left-[-10%] w-[50%] h-[40%] rounded-full"
          style={{ background: 'rgba(255,182,144,0.07)', filter: 'blur(120px)' }} />
        <div className="relative z-10 max-w-sm w-full space-y-6 flex flex-col items-center">
          <span className="material-symbols-outlined block mx-auto" style={{ fontSize: 72, color: '#f97316' }}>
            {isCounterOnly ? 'countertops' : isBothMode ? 'layers' : 'qr_code_scanner'}
          </span>
          <div className="w-full text-center">
            <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'Geist, sans-serif' }}>
              {restaurant.name}
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: '#e0c0b1' }}>
              {isCounterOnly
                ? 'Peça pelo celular no balcão. Você recebe um número e avisamos quando ficar pronto.'
                : isBothMode
                  ? 'Escolha como quer pedir: mesa no salão (QR) ou fila no balcão.'
                  : (verifyError ?? 'Para entrar na mesa, escaneie o QR Code fixado na mesa do restaurante.')}
            </p>
          </div>
          {!verifyError && !isBothMode && !isCounterOnly && (
            <div className="rounded-xl p-4 w-full text-center text-xs leading-relaxed"
              style={{ background: '#1e293b', border: '1px solid #334155', color: '#a78b7d' }}>
              <span className="material-symbols-outlined block mx-auto mb-2 text-[20px]" style={{ color: '#7bd0ff' }}>info</span>
              O QR Code fica na sua mesa. Com ele você acessa o cardápio, faz pedidos e acompanha a conta.
            </div>
          )}

          {/* Balcão puro: CTA principal é o balcão (não há mesas) */}
          {isCounterOnly ? (
            <Link href={`/${params.slug}/balcao`}
              className="flex items-center justify-center gap-2 w-full h-12 rounded-xl text-sm font-bold font-mono transition-all active:scale-[0.98]"
              style={{ background: '#f97316', color: '#582200' }}>
              <span className="material-symbols-outlined text-[20px]">storefront</span>
              Pedir no balcão
            </Link>
          ) : (
            <Link href="/scan"
              className="flex items-center justify-center gap-2 w-full h-12 rounded-xl text-sm font-bold font-mono transition-all active:scale-[0.98]"
              style={{ background: '#f97316', color: '#582200' }}>
              <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
              Escanear QR da mesa
            </Link>
          )}

          {openSession && (
            <button
              type="button"
              onClick={() => navigateToCustomerHome(params.slug, openSession.sessionId)}
              className="flex items-center justify-center gap-2 w-full h-12 rounded-xl text-sm font-bold font-mono transition-all active:scale-[0.98]"
              style={{ background: '#1e293b', border: '1px solid #334155', color: '#ffb690' }}>
              <span className="material-symbols-outlined text-[20px]">table_restaurant</span>
              Continuar na mesa {openSession.tableNumber}
            </button>
          )}
          {isBothMode && (
            <>
              <p className="text-xs font-mono uppercase tracking-widest" style={{ color: '#584237' }}>ou</p>
              <Link href={`/${params.slug}/balcao`}
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl text-sm font-bold font-mono transition-all active:scale-[0.98]"
                style={{ background: '#1e293b', border: '1px solid #334155', color: '#ffb690' }}>
                <span className="material-symbols-outlined text-[20px]">storefront</span>
                Pedir no balcão
              </Link>
              <p className="text-[11px] leading-relaxed px-2" style={{ color: '#584237' }}>
                No balcão você recebe um número (#42) e aviso quando ficar pronto — sem QR de mesa.
              </p>
            </>
          )}
          {hasWaitlist && (
            <Link href={`/${params.slug}/fila`}
              className="flex items-center justify-center gap-2 w-full h-12 rounded-xl text-sm font-bold font-mono transition-all active:scale-[0.98]"
              style={{ background: '#1e293b', border: '1px solid #334155', color: '#ffb690' }}>
              <span className="material-symbols-outlined text-[20px]">deck</span>
              Entrar na fila por mesa com vista
            </Link>
          )}
          <TestTableCheckInLink />
          {savedCustomerId && (
            <Link href="/hub" className="block w-full text-center text-xs font-mono underline underline-offset-2" style={{ color: '#584237' }}>
              Ir para o Hub da minha conta
            </Link>
          )}
        </div>
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
              {canQuickCheckIn
                ? 'Toque no botão abaixo para entrar na mesa'
                : accessMode === 'choose'
                  ? 'Escolha como quer entrar na mesa'
                  : accessMode === 'returning'
                    ? 'Entre com o WhatsApp da sua conta KiComanda'
                    : 'Cadastro rápido — menos de 30 segundos'}
            </p>
          </div>

          {/* Indicador de etapa — só para primeira vez */}
          {!canQuickCheckIn && accessMode === 'new' && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{ background: '#f97316', color: '#582200' }}>1</div>
                <span className="text-[11px] font-mono" style={{ color: '#ffb690' }}>Seus dados</span>
              </div>
              <div className="flex-1 h-px" style={{ background: '#334155' }} />
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{ background: '#1e293b', color: '#584237', border: '1px solid #334155' }}>2</div>
                <span className="text-[11px] font-mono" style={{ color: '#584237' }}>Cardápio</span>
              </div>
              <div className="flex-1 h-px" style={{ background: '#334155' }} />
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{ background: '#1e293b', color: '#584237', border: '1px solid #334155' }}>3</div>
                <span className="text-[11px] font-mono" style={{ color: '#584237' }}>Pedido</span>
              </div>
            </div>
          )}
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
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ color: statusColor, background: `${statusColor}20` }}>{statusLabel}</span>
            </div>
          </div>
          <Link href="/scan"
            className="col-span-2 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-mono transition-colors"
            style={{ background: '#131b2e', border: '1px dashed #584237', color: '#a78b7d' }}>
            <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
            Está em outra mesa? Escaneie o QR correto
          </Link>
          {!canQuickCheckIn && (
            <>
              <button
                type="button"
                onClick={() => setAccessMode('new')}
                className="p-4 rounded-xl flex flex-col items-start gap-2 text-left transition-all active:scale-[0.98]"
                style={{
                  background: accessMode === 'new' ? 'rgba(249,115,22,0.12)' : '#1e293b',
                  border: `1px solid ${accessMode === 'new' ? 'rgba(249,115,22,0.45)' : '#334155'}`,
                }}
              >
                <span className="material-symbols-outlined text-[22px]" style={{ color: '#ffb690' }}>person_add</span>
                <div>
                  <span className="text-sm font-bold block" style={{ color: '#dae2fd' }}>Primeiro acesso</span>
                  <span className="text-[11px] font-mono mt-0.5 block" style={{ color: '#a78b7d' }}>Cadastre-se agora</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setAccessMode('returning')}
                className="p-4 rounded-xl flex flex-col items-start gap-2 text-left transition-all active:scale-[0.98]"
                style={{
                  background: accessMode === 'returning' ? 'rgba(249,115,22,0.12)' : '#1e293b',
                  border: `1px solid ${accessMode === 'returning' ? 'rgba(249,115,22,0.45)' : '#334155'}`,
                }}
              >
                <span className="material-symbols-outlined text-[22px]" style={{ color: '#ffb690' }}>login</span>
                <div>
                  <span className="text-sm font-bold block" style={{ color: '#dae2fd' }}>Já tenho cadastro</span>
                  <span className="text-[11px] font-mono mt-0.5 block" style={{ color: '#a78b7d' }}>Entrar com WhatsApp</span>
                </div>
              </button>
            </>
          )}
        </div>

        {/* Login returning customer */}
        {!canQuickCheckIn && accessMode === 'returning' && (
          <div className="rounded-xl p-5 mb-6 flex flex-col gap-4"
            style={{ background: '#131b2e', border: '1px solid #334155' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: '#a78b7d' }}>Entrar com WhatsApp</p>
                <p className="text-xs mt-1" style={{ color: '#584237' }}>
                  Entre com seu número para check-in rápido.
                </p>
              </div>
              <button type="button" onClick={() => {
                  setAccessMode('choose')
                  setPinStep(null)
                  setPinSetupStep(null)
                  setLoginPin('')
                  setLoginWhatsapp('')
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: '#1e293b', color: '#584237' }}>
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px]" style={{ color: '#a78b7d' }}>phone</span>
              <input type="tel" inputMode="tel" value={loginWhatsapp}
                onChange={e => setLoginWhatsapp(formatPhoneInput(e.target.value))}
                placeholder="(21) 99999-9999 ou +351…" autoComplete="tel"
                disabled={Boolean(pinStep || pinSetupStep)}
                className="w-full h-11 pl-9 pr-3 rounded-lg text-sm outline-none transition-all"
                style={{ background: '#0b1326', border: '1px solid #584237', color: '#dae2fd', opacity: pinStep || pinSetupStep ? 0.6 : 1 }}
                onFocus={e => (e.target.style.borderColor = '#f97316')}
                onBlur={e => (e.target.style.borderColor = '#584237')} />
            </div>
            {pinSetupStep && (
              <CustomerPinSetupForm
                firstName={pinSetupStep.firstName}
                pin={setupPin}
                pinConfirm={setupPinConfirm}
                loading={loggingIn}
                onPinChange={setSetupPin}
                onPinConfirmChange={setSetupPinConfirm}
                onSubmit={handleWhatsAppLogin}
                onBack={() => {
                  setPinSetupStep(null)
                  setSetupPin('')
                  setSetupPinConfirm('')
                }}
              />
            )}
            {pinStep && !pinSetupStep && (
              <div className="space-y-2">
                <p className="text-xs text-center" style={{ color: '#a78b7d' }}>
                  {pinStep.pinLength === 6 ? `Senha de ${pinStep.firstName}` : `PIN de ${pinStep.firstName}`}
                </p>
                <PinInput value={loginPin} onChange={setLoginPin} length={pinStep.pinLength} autoFocus disabled={loggingIn} />
              </div>
            )}
            {!pinSetupStep && (
            <button type="button" onClick={handleWhatsAppLogin} disabled={loggingIn || checkingIn}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-50"
              style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.35)', color: '#ffb690' }}>
              {loggingIn ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <>
                  <span className="material-symbols-outlined">{pinStep ? 'pin' : 'login'}</span>
                  {pinStep ? (pinStep.pinLength === 6 ? 'Confirmar senha' : 'Confirmar PIN') : 'Entrar com WhatsApp'}
                </>
              )}
            </button>
            )}
          </div>
        )}

        {/* Check-in rápido */}
        {canQuickCheckIn && (
          <div className="rounded-xl p-5 mb-6 flex flex-col gap-4"
            style={{ background: 'linear-gradient(145deg,#1e293b,#0f172a)', border: '1px solid rgba(249,115,22,0.35)' }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold shrink-0"
                style={{ background: 'rgba(249,115,22,0.15)', color: '#ffb690' }}>
                {savedCustomerName.trim()
                  ? savedCustomerName.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
                  : '?'}
              </div>
              <div>
                <p className="text-sm font-semibold">{savedCustomerName || 'Cliente'}</p>
                <p className="text-xs" style={{ color: '#a78b7d' }}>Conta salva neste aparelho</p>
              </div>
            </div>
            <button onClick={handleQuickCheckIn} disabled={checkingIn || checkedIn}
              className="w-full py-4 rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-50"
              style={{ background: '#f97316', color: '#582200', boxShadow: '0 12px 28px rgba(249,115,22,0.2)' }}>
              {checkingIn ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <>
                  <span className="material-symbols-outlined">bolt</span>
                  Entrar na Mesa {tableLabel}
                </>
              )}
            </button>
            <button type="button" onClick={() => { setShowFullForm(true); setAccessMode('new') }}
              className="text-xs font-mono underline underline-offset-2 self-center"
              style={{ color: '#a78b7d' }}>
              Usar outra conta
            </button>
          </div>
        )}

        {/* Form */}
        {!canQuickCheckIn && accessMode === 'new' && (
        <div className="rounded-xl p-5 flex flex-col gap-4 mb-6"
          style={{ background: '#1e293b', border: '1px solid #334155' }}>

          {/* Name row */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]" style={{ color: '#ffb690' }}>person</span>
              <span className="text-sm font-semibold">Seus dados</span>
            </div>
            <button type="button" onClick={() => setAccessMode('choose')}
              className="text-[11px] font-mono underline underline-offset-2"
              style={{ color: '#a78b7d' }}>
              Voltar
            </button>
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
              <input type="tel" inputMode="tel" value={whatsapp}
                onChange={e => setWhatsapp(docType === 'passport' ? formatPhoneInput(e.target.value) : formatWhatsApp(e.target.value))}
                placeholder={docType === 'passport' ? '+351 912 345 678' : '(11) 99999-9999'} autoComplete="tel"
                className="w-full h-11 pl-9 pr-3 rounded-lg text-sm outline-none transition-all"
                style={{ background: '#0b1326', border: '1px solid #584237', color: '#dae2fd' }}
                onFocus={e => (e.target.style.borderColor = '#f97316')}
                onBlur={e => (e.target.style.borderColor = '#584237')} />
            </div>
          </div>

          {/* Senha de acesso */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#e0c0b1' }}>
                Crie uma senha de 4 dígitos
              </label>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                obrigatório
              </span>
            </div>
            <p className="text-[11px] leading-relaxed flex items-center gap-1.5" style={{ color: '#a78b7d' }}>
              <span className="material-symbols-outlined text-[14px]">lock</span>
              Para acessar sua conta nas próximas visitas
            </p>
            <PinInput value={checkInPin} onChange={setCheckInPin} length={4} />
            {checkInPin.length === 4 && (
              <>
                <label className="text-[11px] font-mono uppercase tracking-wider mt-1" style={{ color: '#e0c0b1' }}>
                  Confirme a senha
                </label>
                <PinInput value={checkInPinConfirm} onChange={setCheckInPinConfirm} length={4} />
                {checkInPinConfirm.length === 4 && checkInPin !== checkInPinConfirm && (
                  <p className="text-[11px] font-mono" style={{ color: '#f87171' }}>
                    As senhas não conferem. Tente novamente.
                  </p>
                )}
              </>
            )}
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
        )}

        {/* CTA */}
        {!canQuickCheckIn && accessMode === 'new' && (
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
        )}

        {/* Footer */}
        <div className="mt-10 text-center">
          <p className="text-xs font-mono" style={{ color: 'rgba(218,226,253,0.18)' }}>Powered by KiComanda</p>
        </div>
      </div>
    </div>
  )
}
