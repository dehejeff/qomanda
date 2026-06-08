'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PinInput } from '@/components/customer/pin-input'
import {
  customerAuthFetch,
  getCustomerSessionToken,
  setCustomerSessionToken,
  startCustomerSessionIdleWatch,
} from '@/lib/customer-auth'
import { isValidCardPassword } from '@/lib/customer-pin-shared'
import type { HubAccessResponse } from '@/app/api/customer/hub/access/route'

type Props = {
  customerId: string
  children: React.ReactNode
  onUnlocked?: () => void
}

type Gate = 'loading' | 'create' | 'enter' | 'ready'

export function HubSessionGate({ customerId, children, onUnlocked }: Props) {
  const [gate, setGate] = useState<Gate>('loading')
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [authing, setAuthing] = useState(false)
  const [firstName, setFirstName] = useState('')

  const checkAccess = useCallback(async () => {
    setGate('loading')
    const res = await customerAuthFetch(`/api/customer/hub/access?customer=${customerId}`)
    if (!res.ok) {
      setGate('enter')
      return
    }
    const data = (await res.json()) as HubAccessResponse

    if (!data.requiresSession) {
      setGate('ready')
      return
    }

    if (data.sessionValid) {
      setGate('ready')
      return
    }

    if (!data.hasPin) {
      setGate('create')
      return
    }

    setGate('enter')
  }, [customerId])

  useEffect(() => {
    const name = localStorage.getItem('qomanda_customer_name')?.split(' ')[0] ?? ''
    setFirstName(name)
    checkAccess().catch(() => setGate('enter'))
  }, [checkAccess])

  useEffect(() => {
    if (gate !== 'ready') return
    return startCustomerSessionIdleWatch(() => {
      toast.message('Sessão expirada por inatividade. Digite sua senha novamente.')
      setGate('enter')
    })
  }, [gate])

  async function handleCreatePassword() {
    if (!isValidCardPassword(pwd)) {
      toast.error('A senha deve ter 6 dígitos.')
      return
    }
    if (pwd !== pwd2) {
      toast.error('As senhas não conferem.')
      return
    }
    setAuthing(true)
    try {
      const res = await fetch('/api/customer/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, pin: pwd, mode: 'set', pinKind: 'card' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar senha.')
      if (data.sessionToken) setCustomerSessionToken(data.sessionToken)
      setPwd('')
      setPwd2('')
      toast.success('Senha criada!')
      setGate('ready')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar senha.')
    } finally {
      setAuthing(false)
    }
  }

  async function handleEnterPassword() {
    if (!isValidCardPassword(pwd)) {
      toast.error('A senha deve ter 6 dígitos.')
      return
    }
    setAuthing(true)
    try {
      const res = await fetch('/api/customer/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, pin: pwd, mode: 'verify', pinKind: 'card' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Senha incorreta.')
      if (data.sessionToken) setCustomerSessionToken(data.sessionToken)
      setPwd('')
      toast.success('Acesso liberado!')
      setGate('ready')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Senha incorreta.')
    } finally {
      setAuthing(false)
    }
  }

  useEffect(() => {
    if (gate === 'ready') onUnlocked?.()
  }, [gate, onUnlocked])

  if (gate === 'ready') return <>{children}</>

  if (gate === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  const inputSt: React.CSSProperties = {
    background: '#0b1326', border: '1px solid #334155', color: '#dae2fd',
    outline: 'none', width: '100%', height: 40, borderRadius: 10, padding: '0 12px', fontSize: 14,
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
      style={{ background: '#0b1326', color: '#dae2fd' }}>
      <div className="max-w-sm w-full space-y-6 flex flex-col items-center">
        <span className="material-symbols-outlined block mx-auto" style={{ fontSize: 64, color: '#f97316' }}>lock</span>
        <div className="w-full text-center space-y-1">
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Geist, sans-serif' }}>
            {firstName ? `Olá, ${firstName}` : 'Hub KiComanda'}
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: '#e0c0b1' }}>
            {gate === 'create'
              ? 'Você tem cartão salvo. Crie uma senha de 6 dígitos para acessar o Hub com segurança.'
              : 'Digite sua senha de 6 dígitos para acessar o Hub.'}
          </p>
        </div>

        {gate === 'create' ? (
          <div className="w-full space-y-3 text-left">
            <PinInput value={pwd} onChange={setPwd} length={6} autoFocus />
            <input type="password" inputMode="numeric" value={pwd2} placeholder="Confirme a senha"
              onChange={e => setPwd2(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} style={inputSt} />
            <button type="button" onClick={handleCreatePassword} disabled={authing}
              className="w-full h-12 rounded-xl text-sm font-bold font-mono flex items-center justify-center gap-2"
              style={{ background: '#f97316', color: '#582200' }}>
              {authing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar senha e entrar'}
            </button>
          </div>
        ) : (
          <div className="w-full space-y-3">
            <PinInput value={pwd} onChange={setPwd} length={6} autoFocus />
            <button type="button" onClick={handleEnterPassword} disabled={authing}
              className="w-full h-12 rounded-xl text-sm font-bold font-mono flex items-center justify-center gap-2"
              style={{ background: '#f97316', color: '#582200' }}>
              {authing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Desbloquear Hub'}
            </button>
          </div>
        )}

        {!getCustomerSessionToken() && gate === 'enter' && (
          <p className="text-xs leading-relaxed" style={{ color: '#584237' }}>
            Esqueceu a senha? Entre com WhatsApp em{' '}
            <a href="/login?perfil=cliente" className="underline underline-offset-2" style={{ color: '#ffb690' }}>
              login
            </a>.
          </p>
        )}
      </div>
    </div>
  )
}
