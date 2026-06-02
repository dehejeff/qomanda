'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { QomandaLogo } from '@/components/qomanda-logo'
import { CustomerSignupForm, registerCustomerAndStore } from '@/components/customer/customer-signup-form'
import { friendlyAuthError } from '@/lib/supabase/auth-errors'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  getAvailableRestaurantModels,
  restaurantModelPresetToDb,
  type RestaurantModelId,
} from '@/lib/restaurant-models'

type CadastroTipo = 'restaurant' | 'customer'
type RestStep = 'account' | 'model' | 'restaurant'

function parseTipo(value: string | null): CadastroTipo {
  if (value === 'cliente' || value === 'customer') return 'customer'
  return 'restaurant'
}

export default function CadastroPage() {
  const router = useRouter()
  const [tipo, setTipo]           = useState<CadastroTipo>('restaurant')
  const [step, setStep]           = useState<RestStep>('account')
  const [loading, setLoading]     = useState(false)

  // Restaurante — conta admin
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')

  // Restaurante — estabelecimento
  const [restName, setRestName]   = useState('')
  const [restSlug, setRestSlug]   = useState('')
  const [restType, setRestType]   = useState('restaurante')
  const [restModel, setRestModel] = useState<RestaurantModelId>('salao')

  const availableModels = getAvailableRestaurantModels()

  useEffect(() => {
    setTipo(parseTipo(new URLSearchParams(window.location.search).get('tipo')))
  }, [])

  function slugify(v: string) {
    return v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }

  function handleRestNameChange(v: string) {
    setRestName(v)
    setRestSlug(slugify(v))
  }

  async function handleAccount(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { toast.error('As senhas não coincidem.'); return }
    if (password.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres.'); return }
    setStep('model')
  }

  async function handleModelContinue(e: React.FormEvent) {
    e.preventDefault()
    setStep('restaurant')
  }

  async function handleRestaurantSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!restSlug) { toast.error('Informe o nome do estabelecimento.'); return }
    setLoading(true)

    const supabase = createClient()
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
    if (authError || !authData.user) {
      toast.error(friendlyAuthError(authError))
      setLoading(false)
      return
    }

    const modelPreset = restaurantModelPresetToDb(restModel)

    const { error: restError } = await supabase.from('restaurants').insert({
      owner_id: authData.user.id,
      name: restName,
      slug: restSlug,
      status: 'active',
      ...modelPreset,
    })

    if (restError) {
      toast.error(restError.code === '23505'
        ? 'Este slug já está em uso. Tente um nome diferente.'
        : 'Erro ao criar restaurante. Tente novamente.')
      setLoading(false)
      return
    }

    // Provisiona plano starter + trial de 14 dias em background (não bloqueia o redirect)
    fetch('/api/auth/provision-trial', { method: 'POST' }).catch(() => {})

    toast.success('Conta criada! Bem-vindo à Qomanda 🎉')
    router.push('/dashboard')
  }

  async function handleCustomerSignup(payload: Parameters<typeof registerCustomerAndStore>[0]) {
    try {
      const registered = await registerCustomerAndStore(payload)
      toast.success(`Bem-vindo, ${registered.firstName}!`)
      router.push('/hub')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar conta.')
      throw err
    }
  }

  const inputStyle: React.CSSProperties = {
    background: '#131b2e', border: '1px solid #584237', color: '#dae2fd',
    outline: 'none', width: '100%', height: 48, borderRadius: 12,
    padding: '0 16px', fontSize: 14, fontFamily: 'Geist, sans-serif',
    transition: 'border-color 0.15s',
  }
  function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) { e.target.style.borderColor = '#f97316' }
  function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) { e.target.style.borderColor = '#584237' }

  const isRestaurant = tipo === 'restaurant'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8 relative"
      style={{ background: '#0b1326', color: '#dae2fd', fontFamily: 'Geist, sans-serif' }}>
      <div className="pointer-events-none fixed top-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full"
        style={{ background: 'rgba(249,115,22,0.07)', filter: 'blur(100px)' }} />

      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <QomandaLogo size={48} />
          <div className="text-center">
            <h1 className="text-2xl font-black" style={{ letterSpacing: '-0.02em' }}>
              {isRestaurant
                ? (step === 'account' ? 'Cadastro do restaurante'
                  : step === 'model' ? 'Escolha o modelo'
                  : 'Seu estabelecimento')
                : 'Cadastro de cliente'}
            </h1>
            <p className="text-sm mt-1 max-w-[300px] mx-auto leading-relaxed" style={{ color: '#a78b7d' }}>
              {isRestaurant
                ? (step === 'account' ? 'Conta do administrador · 14 dias grátis'
                  : step === 'model' ? 'Como seu negócio opera?'
                  : 'Seu estabelecimento')
                : 'Crie sua conta para acessar o hub, histórico e cartões salvos'}
            </p>
          </div>
        </div>

        {/* Tipo: Restaurante | Cliente */}
        <div className="flex rounded-xl overflow-hidden p-1 gap-1"
          style={{ background: '#131b2e', border: '1px solid #334155' }}>
          {([
            { id: 'restaurant' as const, icon: 'storefront', label: 'Restaurante' },
            { id: 'customer' as const, icon: 'person', label: 'Cliente' },
          ]).map(t => {
            const active = tipo === t.id
            return (
              <button key={t.id} type="button"
                onClick={() => { setTipo(t.id); setStep('account') }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all active:scale-[0.98]"
                style={{ background: active ? '#f97316' : 'transparent', color: active ? '#582200' : '#a78b7d' }}>
                <span className="material-symbols-outlined text-[18px]"
                  style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}>{t.icon}</span>
                <span className="text-xs font-mono font-bold uppercase tracking-wide">{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* ── Cliente ── */}
        {tipo === 'customer' && (
          <>
            <CustomerSignupForm submitLabel="Criar conta e ir ao hub" onSubmit={handleCustomerSignup} />
            <div className="rounded-xl p-4" style={{ background: 'rgba(123,208,255,0.06)', border: '1px solid rgba(123,208,255,0.15)' }}>
              <p className="text-xs leading-relaxed" style={{ color: '#a78b7d' }}>
                <strong style={{ color: '#7bd0ff' }}>Primeira visita a um restaurante?</strong>{' '}
                Você também pode se cadastrar escaneando o QR Code da mesa — os mesmos dados serão usados.
              </p>
              <Link href="/scan"
                className="inline-flex items-center gap-1.5 mt-3 text-xs font-mono font-bold"
                style={{ color: '#7bd0ff' }}>
                <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                Escanear mesa
              </Link>
            </div>
          </>
        )}

        {/* ── Restaurante ── */}
        {tipo === 'restaurant' && (
          <>
            <div className="flex items-center gap-2">
              {(['account', 'model', 'restaurant'] as RestStep[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                      style={{
                        background: step === s ? '#f97316'
                          : (['account', 'model', 'restaurant'].indexOf(step) > i) ? '#34d399' : '#1e293b',
                        color: step === s ? '#582200'
                          : (['account', 'model', 'restaurant'].indexOf(step) > i) ? '#052e16' : '#584237',
                        border: `1px solid ${step === s ? '#f97316'
                          : (['account', 'model', 'restaurant'].indexOf(step) > i) ? '#34d399' : '#584237'}`,
                      }}>
                      {['account', 'model', 'restaurant'].indexOf(step) > i ? (
                        <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                      ) : i + 1}
                    </div>
                    <span className="text-[10px] font-mono truncate hidden sm:inline" style={{ color: step === s ? '#dae2fd' : '#584237' }}>
                      {s === 'account' ? 'Conta' : s === 'model' ? 'Modelo' : 'Loja'}
                    </span>
                  </div>
                  {i < 2 && (
                    <div className="flex-1 h-px min-w-[8px]"
                      style={{ background: ['account', 'model', 'restaurant'].indexOf(step) > i ? '#34d399' : '#1e293b' }} />
                  )}
                </div>
              ))}
            </div>

            {step === 'account' && (
              <form onSubmit={handleAccount} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Seu nome</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="João Silva" required style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>E-mail</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="joao@seurestaurante.com" required style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Senha</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" required minLength={6} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Confirmar</label>
                    <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                      placeholder="••••••••" required style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                </div>
                <button type="submit"
                  className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 mt-2"
                  style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 24px rgba(249,115,22,0.25)' }}>
                  Continuar
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </form>
            )}

            {step === 'model' && (
              <form onSubmit={handleModelContinue} className="space-y-4">
                <p className="text-xs leading-relaxed" style={{ color: '#a78b7d' }}>
                  O sistema já configura fluxo de pedido, pagamento e painel conforme o modelo.
                  Depois você só ajusta a chave PIX ou Asaas.
                </p>
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {availableModels.map(m => {
                    const active = restModel === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setRestModel(m.id)}
                        className="w-full text-left rounded-xl p-4 transition-all active:scale-[0.99]"
                        style={{
                          background: active ? 'rgba(249,115,22,0.12)' : '#131b2e',
                          border: `1px solid ${active ? '#f97316' : '#334155'}`,
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <span className="material-symbols-outlined text-[22px] shrink-0"
                            style={{ color: active ? '#f97316' : '#a78b7d', fontVariationSettings: active ? "'FILL' 1" : undefined }}>
                            {m.icon}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm" style={{ color: active ? '#ffb690' : '#dae2fd' }}>{m.name}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#a78b7d' }}>{m.tagline}</p>
                            <p className="text-[10px] font-mono mt-1.5" style={{ color: '#584237' }}>{m.examples}</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep('account')}
                    className="flex-1 h-12 rounded-xl font-bold text-sm"
                    style={{ background: 'transparent', border: '1px solid #584237', color: '#a78b7d' }}>
                    Voltar
                  </button>
                  <button type="submit"
                    className="flex-[2] h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                    style={{ background: '#f97316', color: '#582200' }}>
                    Continuar
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </form>
            )}

            {step === 'restaurant' && (
              <form onSubmit={handleRestaurantSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Nome do estabelecimento</label>
                  <input type="text" value={restName} onChange={e => handleRestNameChange(e.target.value)}
                    placeholder="Tasca do Porto" required style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Tipo</label>
                  <select value={restType} onChange={e => setRestType(e.target.value)}
                    style={{ ...inputStyle, appearance: 'none' } as React.CSSProperties}
                    onFocus={onFocus} onBlur={onBlur}>
                    <option value="restaurante">Restaurante</option>
                    <option value="bar">Bar</option>
                    <option value="lanchonete">Lanchonete</option>
                    <option value="cafeteria">Cafeteria</option>
                    <option value="pizzaria">Pizzaria</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Link do cardápio</label>
                  <div className="flex items-center h-12 px-4 rounded-xl text-sm"
                    style={{ background: '#0b1326', border: '1px solid #1e293b' }}>
                    <span style={{ color: '#584237', fontFamily: 'JetBrains Mono, monospace' }}>qomanda.app/</span>
                    <span style={{ color: restSlug ? '#ffb690' : '#584237', fontFamily: 'JetBrains Mono, monospace' }}>
                      {restSlug || 'seu-restaurante'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3 mt-2">
                  <button type="button" onClick={() => setStep('model')}
                    className="flex-1 h-12 rounded-xl font-bold text-sm transition-all active:scale-95"
                    style={{ background: 'transparent', border: '1px solid #584237', color: '#a78b7d' }}>
                    Voltar
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-[2] h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                    style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 24px rgba(249,115,22,0.25)' }}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                      <><span className="material-symbols-outlined text-[18px]">rocket_launch</span>Criar minha conta</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        <p className="text-center text-sm" style={{ color: '#584237' }}>
          Já tem conta?{' '}
          <Link href={isRestaurant ? '/login?perfil=admin' : '/login?perfil=cliente'}
            className="font-semibold hover:opacity-80 transition-opacity" style={{ color: '#f97316' }}>
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
