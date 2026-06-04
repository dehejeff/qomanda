'use client'

import { useEffect, useRef, useState } from 'react'
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

  const autoQuickCheckInRef = useRef(false)
  const [resumingSession, setResumingSession] = useState(false)

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [operationalMode, setOperationalMode] = useState<'dine_in' | 'counter' | 'both'>('dine_in')
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
  const [savedCustomerId, setSavedCustomerId] = useState<string | null>(null)
  const [savedCustomerName, setSavedCustomerName] = useState('')
  const [showFullForm, setShowFullForm] = useState(false)
  const [loginWhatsapp, setLoginWhatsapp] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginPin, setLoginPin] = useState('')
  const [pinStep, setPinStep] = useState<{ challengeToken: string; firstName: string; pinLength: 4 | 6 } | null>(null)
  const [pinSetupStep, setPinSetupStep] = useState<{ challengeToken: string; firstName: string } | null>(null)
  const [setupPin, setSetupPin] = useState('')
  const [setupPinConfirm, setSetupPinConfirm] = useState('')

  // CPF validation state
  const cpfDigits   = cpf.replace(/\D/g, '')
  const cpfComplete = cpfDigits.length === 11
  const cpfValid    = cpfComplete && validateCPF(cpf)

  useEffect(() => {
    const cid = localStorage.getItem('qomanda_customer_id')
    const cname = localStorage.getItem('qomanda_customer_name') ?? ''
    if (cid) {
      setSavedCustomerId(cid)
      setSavedCustomerName(cname)
    }

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
      setLoading(false)
    }
    loadRestaurant()
  }, [params.slug, mesaParam, tokenParam, router])

  useEffect(() => {
    if (mesaParam && tokenParam) {
      setResumingSession(false)
      return
    }
    if (loading || verifyLoading || !restaurant) return

    const customerId = localStorage.getItem('qomanda_customer_id')
    if (!customerId) {
      setResumingSession(false)
      return
    }

    let cancelled = false
    setResumingSession(true)

    async function resumeOpenSession() {
      try {
        const supabase = createClient()
        const active = await findCustomerActiveSession(supabase, customerId!)
        if (cancelled || !active || active.slug !== params.slug) return
        navigateToCustomerHome(params.slug, active.sessionId)
      } finally {
        if (!cancelled) setResumingSession(false)
      }
    }

    void resumeOpenSession()
    return () => {
      cancelled = true
      setResumingSession(false)
    }
  }, [mesaParam, tokenParam, loading, verifyLoading, restaurant, params.slug])

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

    localStorage.setItem('qomanda_session_id', sessionId)
    localStorage.setItem('qomanda_customer_id', customerId)
    localStorage.setItem('qomanda_customer_name', `${name} ${surname}`)
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
        toast.success(`PIN criado! Olá, ${data.firstName}! Faça check-in na mesa.`)
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
        toast.success(`Olá, ${data.firstName}! Faça check-in na mesa.`)
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
        setShowFullForm(true)
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

      toast.success(`Olá, ${data.firstName}! Faça check-in na mesa.`)
    } catch {
      toast.error('Erro ao entrar. Tente novamente.')
    } finally {
      setLoggingIn(false)
    }
  }

  async function handleQuickCheckIn() {
    if (!restaurant || !savedCustomerId || !tableToken) {
      autoQuickCheckInRef.current = false
      return
    }
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
      setCheckingIn(false)
      autoQuickCheckInRef.current = false
      return
    }

    const { sessionId, customerId } = (await res.json()) as CheckInResponse
    localStorage.setItem('qomanda_session_id', sessionId)
    localStorage.setItem('qomanda_customer_id', customerId)
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

  useEffect(() => {
    if (!restaurant || !canQuickCheckIn || checkingIn || checkedIn) return
    if (autoQuickCheckInRef.current) return
    autoQuickCheckInRef.current = true
    void handleQuickCheckIn()
  }, [restaurant, canQuickCheckIn, checkingIn, checkedIn])

  // ── Loading ──────────────────────────────────────────────
  if (loading || verifyLoading || resumingSession || checkingIn) {
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
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative"
        style={{ background: '#0b1326', color: '#dae2fd' }}>
        <div className="pointer-events-none fixed top-[-10%] left-[-10%] w-[50%] h-[40%] rounded-full"
          style={{ background: 'rgba(255,182,144,0.07)', filter: 'blur(120px)' }} />
        <div className="relative z-10 max-w-sm w-full space-y-6 flex flex-col items-center">
          <span className="material-symbols-outlined block mx-auto" style={{ fontSize: 72, color: '#f97316' }}>
            {isBothMode ? 'layers' : 'qr_code_scanner'}
          </span>
          <div className="w-full text-center">
            <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'Geist, sans-serif' }}>
              {restaurant.name}
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: '#e0c0b1' }}>
              {isBothMode
                ? 'Escolha como quer pedir: mesa no salão (QR) ou fila no balcão.'
                : (verifyError ?? 'Para entrar na mesa, escaneie o QR Code fixado na mesa do restaurante.')}
            </p>
          </div>
          {!verifyError && !isBothMode && (
            <div className="rounded-xl p-4 w-full text-center text-xs leading-relaxed"
              style={{ background: '#1e293b', border: '1px solid #334155', color: '#a78b7d' }}>
              <span className="material-symbols-outlined block mx-auto mb-2 text-[20px]" style={{ color: '#7bd0ff' }}>info</span>
              O QR Code fica na sua mesa. Com ele você acessa o cardápio, faz pedidos e acompanha a conta.
            </div>
          )}
          <Link href="/scan"
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl text-sm font-bold font-mono transition-all active:scale-[0.98]"
            style={{ background: '#f97316', color: '#582200' }}>
            <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
            {isBothMode ? 'Escanear QR da mesa' : 'Escanear QR da mesa'}
          </Link>
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
              {canQuickCheckIn ? 'Confirme a mesa escaneada no QR' : 'Confirme seus dados para começar'}
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
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ color: statusColor, background: `${statusColor}20` }}>{statusLabel}</span>
            </div>
          </div>
          <Link href="/scan"
            className="col-span-2 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-mono transition-colors"
            style={{ background: '#131b2e', border: '1px dashed #584237', color: '#a78b7d' }}>
            <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
            Está em outra mesa? Escaneie o QR correto
          </Link>
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

        {/* Entrar com WhatsApp (sem dados salvos no aparelho) */}
        {!canQuickCheckIn && (
          <div className="rounded-xl p-5 mb-6 flex flex-col gap-4"
            style={{ background: '#1e293b', border: '1px solid #334155' }}>
            <div>
              <p className="text-sm font-semibold">Já tem conta Qomanda?</p>
              <p className="text-xs mt-1" style={{ color: '#a78b7d' }}>
                Entre com seu WhatsApp para retomar visitas em andamento ou check-in rápido.
              </p>
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
            <button type="button" onClick={() => setShowFullForm(true)}
              className="text-xs font-mono underline underline-offset-2 self-center"
              style={{ color: '#a78b7d' }}>
              Usar outra conta
            </button>
          </div>
        )}

        {/* Form */}
        {!canQuickCheckIn && (
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
              <input type="tel" inputMode="tel" value={whatsapp}
                onChange={e => setWhatsapp(docType === 'passport' ? formatPhoneInput(e.target.value) : formatWhatsApp(e.target.value))}
                placeholder={docType === 'passport' ? '+351 912 345 678' : '(11) 99999-9999'} autoComplete="tel"
                className="w-full h-11 pl-9 pr-3 rounded-lg text-sm outline-none transition-all"
                style={{ background: '#0b1326', border: '1px solid #584237', color: '#dae2fd' }}
                onFocus={e => (e.target.style.borderColor = '#f97316')}
                onBlur={e => (e.target.style.borderColor = '#584237')} />
            </div>
          </div>

          {/* PIN de acesso */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#e0c0b1' }}>
              PIN de 4 dígitos
            </label>
            <p className="text-[11px] leading-relaxed" style={{ color: '#584237' }}>
              Use para entrar no Hub e acessar sua conta remotamente.
            </p>
            <PinInput value={checkInPin} onChange={setCheckInPin} length={4} />
            <label className="text-[11px] font-mono uppercase tracking-wider mt-1" style={{ color: '#e0c0b1' }}>
              Confirmar PIN
            </label>
            <PinInput value={checkInPinConfirm} onChange={setCheckInPinConfirm} length={4} />
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
        {!canQuickCheckIn && (
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

        {!canQuickCheckIn && (
        <p className="text-center text-xs font-mono uppercase tracking-widest mt-4"
          style={{ color: 'rgba(218,226,253,0.35)' }}>
          Toque para iniciar o pedido
        </p>
        )}

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
