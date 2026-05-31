'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { QomandaLogo } from '@/components/qomanda-logo'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { CustomerLoginForm } from '@/components/customer/customer-login-form'

type AccessRole = 'customer' | 'admin' | 'waiter'

const ROLES: { id: AccessRole; icon: string; label: string }[] = [
  { id: 'customer', icon: 'person',           label: 'Cliente'     },
  { id: 'admin',    icon: 'storefront',       label: 'Restaurante' },
  { id: 'waiter',   icon: 'room_service',     label: 'Garçom'      },
]

const ROLE_COPY: Record<AccessRole, { title: string; subtitle: string }> = {
  customer: {
    title: 'Área do cliente',
    subtitle: 'Histórico, recibos, cartões e check-in nas mesas',
  },
  admin: {
    title: 'Painel do restaurante',
    subtitle: 'Gerencie cardápio, mesas, pedidos e pagamentos',
  },
  waiter: {
    title: 'Acesso garçom',
    subtitle: 'Atendimento de mesa, pedidos e fechamento de conta',
  },
}

function parseRole(value: string | null): AccessRole {
  if (value === 'cliente' || value === 'customer') return 'customer'
  if (value === 'garcom' || value === 'waiter') return 'waiter'
  if (value === 'admin' || value === 'restaurante') return 'admin'
  return 'customer'
}

export default function LoginPage() {
  const router = useRouter()
  const [role, setRole]         = useState<AccessRole>('admin')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('perfil')
    setRole(parseRole(param))
  }, [])

  useEffect(() => {
    if (role !== 'customer') return
    const cid = localStorage.getItem('qomanda_customer_id')
    if (cid) router.replace('/hub')
  }, [role, router])

  const copy = ROLE_COPY[role]

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  async function handleWaiterLogin(e: React.FormEvent) {
    e.preventDefault()
    toast.info('Painel do garçom em breve. Em breve você entrará por aqui com e-mail e senha.')
  }

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
    transition: 'border-color 0.15s',
  }

  function onFocus(e: React.FocusEvent<HTMLInputElement>) { e.target.style.borderColor = '#f97316' }
  function onBlur(e: React.FocusEvent<HTMLInputElement>) { e.target.style.borderColor = '#584237' }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8 relative"
      style={{ background: '#0b1326', color: '#dae2fd', fontFamily: 'Geist, sans-serif' }}>
      <div className="pointer-events-none fixed top-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full"
        style={{ background: 'rgba(249,115,22,0.07)', filter: 'blur(100px)' }} />

      <div className="relative z-10 w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <QomandaLogo size={48} />
          <div className="text-center">
            <h1 className="text-2xl font-black" style={{ letterSpacing: '-0.02em' }}>{copy.title}</h1>
            <p className="text-sm mt-1 max-w-[280px] mx-auto leading-relaxed" style={{ color: '#a78b7d' }}>
              {copy.subtitle}
            </p>
          </div>
        </div>

        {/* Seletor de perfil */}
        <div className="flex rounded-xl overflow-hidden p-1 gap-1"
          style={{ background: '#131b2e', border: '1px solid #334155' }}>
          {ROLES.map(r => {
            const active = role === r.id
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg transition-all active:scale-[0.98]"
                style={{
                  background: active ? '#f97316' : 'transparent',
                  color: active ? '#582200' : '#a78b7d',
                }}
              >
                <span className="material-symbols-outlined text-[20px]"
                  style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                  {r.icon}
                </span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wide">{r.label}</span>
              </button>
            )
          })}
        </div>

        {/* ── Cliente ── */}
        {role === 'customer' && (
          <CustomerLoginForm onFocus={onFocus} onBlur={onBlur} />
        )}

        {/* ── Admin do restaurante ── */}
        {role === 'admin' && (
          <>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>E-mail</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu@restaurante.com" required autoComplete="email"
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Senha</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <button type="submit" disabled={loading}
                className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 24px rgba(249,115,22,0.25)', marginTop: 8 }}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">dashboard</span>
                    Entrar no painel
                  </>
                )}
              </button>
            </form>
            <p className="text-center text-sm" style={{ color: '#584237' }}>
              Novo restaurante?{' '}
              <Link href="/cadastro" className="font-semibold transition-colors hover:opacity-80" style={{ color: '#f97316' }}>
                Cadastre seu estabelecimento
              </Link>
            </p>
          </>
        )}

        {/* ── Garçom ── */}
        {role === 'waiter' && (
          <>
            <div className="flex items-center justify-center gap-2 py-2">
              <span className="text-[10px] font-mono uppercase tracking-widest px-3 py-1 rounded-full"
                style={{ background: 'rgba(249,115,22,0.12)', color: '#ffb690', border: '1px solid rgba(249,115,22,0.25)' }}>
                Em breve
              </span>
            </div>
            <form onSubmit={handleWaiterLogin} className="space-y-4 opacity-90">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>E-mail</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="garcom@restaurante.com" autoComplete="email"
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Senha</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <button type="submit"
                className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{ background: '#131b2e', border: '1px solid #584237', color: '#a78b7d' }}>
                <span className="material-symbols-outlined text-[18px]">room_service</span>
                Entrar como garçom
              </button>
            </form>
            <p className="text-xs text-center leading-relaxed px-2" style={{ color: '#584237' }}>
              O login de garçons usará credenciais criadas pelo admin do restaurante. Disponível em uma próxima versão.
            </p>
          </>
        )}

        <div className="pt-2">
          <Link href="/"
            className="flex items-center justify-center gap-1.5 text-xs font-mono transition-opacity hover:opacity-80"
            style={{ color: '#584237' }}>
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Voltar ao site
          </Link>
        </div>
      </div>
    </div>
  )
}
