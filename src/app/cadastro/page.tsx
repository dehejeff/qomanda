'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { QomandaLogo } from '@/components/qomanda-logo'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

type Step = 'account' | 'restaurant'

export default function CadastroPage() {
  const router = useRouter()
  const [step, setStep]           = useState<Step>('account')
  const [loading, setLoading]     = useState(false)

  // Step 1 — Conta
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')

  // Step 2 — Restaurante
  const [restName, setRestName]   = useState('')
  const [restSlug, setRestSlug]   = useState('')
  const [restType, setRestType]   = useState('restaurante')

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
    setStep('restaurant')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!restSlug) { toast.error('Informe o nome do estabelecimento.'); return }
    setLoading(true)

    const supabase = createClient()

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
    if (authError || !authData.user) {
      toast.error(authError?.message ?? 'Erro ao criar conta.')
      setLoading(false)
      return
    }

    // Create restaurant record
    const { error: restError } = await supabase.from('restaurants').insert({
      owner_id: authData.user.id,
      name: restName,
      slug: restSlug,
      status: 'active',
    })

    if (restError) {
      toast.error(restError.code === '23505'
        ? 'Este slug já está em uso. Tente um nome diferente.'
        : 'Erro ao criar restaurante. Tente novamente.')
      setLoading(false)
      return
    }

    toast.success('Conta criada! Bem-vindo à Qomanda 🎉')
    router.push('/dashboard')
  }

  const inputStyle: React.CSSProperties = {
    background: '#131b2e', border: '1px solid #584237', color: '#dae2fd',
    outline: 'none', width: '100%', height: 48, borderRadius: 12,
    padding: '0 16px', fontSize: 14, fontFamily: 'Geist, sans-serif',
    transition: 'border-color 0.15s',
  }
  function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) { e.target.style.borderColor = '#f97316' }
  function onBlur (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) { e.target.style.borderColor = '#584237' }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8 relative"
      style={{ background: '#0b1326', color: '#dae2fd', fontFamily: 'Geist, sans-serif' }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none fixed top-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full"
        style={{ background: 'rgba(249,115,22,0.07)', filter: 'blur(100px)' }} />

      <div className="relative z-10 w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <QomandaLogo size={48} />
          <div className="text-center">
            <h1 className="text-2xl font-black" style={{ letterSpacing: '-0.02em' }}>
              {step === 'account' ? 'Crie sua conta' : 'Seu estabelecimento'}
            </h1>
            <p className="text-sm mt-1" style={{ color: '#a78b7d' }}>
              {step === 'account'
                ? '14 dias grátis · Sem cartão de crédito'
                : 'Conte-nos sobre seu negócio'}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3">
          {(['account', 'restaurant'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-3 flex-1">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                  style={{
                    background: step === s ? '#f97316' : (i === 0 && step === 'restaurant') ? '#34d399' : '#1e293b',
                    color: step === s ? '#582200' : (i === 0 && step === 'restaurant') ? '#052e16' : '#584237',
                    border: `1px solid ${step === s ? '#f97316' : (i === 0 && step === 'restaurant') ? '#34d399' : '#584237'}`,
                  }}
                >
                  {i === 0 && step === 'restaurant' ? (
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                  ) : i + 1}
                </div>
                <span className="text-xs font-mono" style={{ color: step === s ? '#dae2fd' : '#584237' }}>
                  {s === 'account' ? 'Conta' : 'Restaurante'}
                </span>
              </div>
              {i === 0 && <div className="flex-1 h-px" style={{ background: step === 'restaurant' ? '#34d399' : '#1e293b' }} />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Account ───────────────────────────── */}
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

        {/* ── STEP 2: Restaurant ────────────────────────── */}
        {step === 'restaurant' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>
                Nome do estabelecimento
              </label>
              <input type="text" value={restName} onChange={e => handleRestNameChange(e.target.value)}
                placeholder="Tasca do Porto" required style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>
                Tipo
              </label>
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

            {/* Slug preview */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>
                Link do cardápio
              </label>
              <div className="flex items-center h-12 px-4 rounded-xl text-sm"
                style={{ background: '#0b1326', border: '1px solid #1e293b' }}>
                <span style={{ color: '#584237', fontFamily: 'JetBrains Mono, monospace' }}>qomanda.app/</span>
                <span style={{ color: restSlug ? '#ffb690' : '#584237', fontFamily: 'JetBrains Mono, monospace' }}>
                  {restSlug || 'seu-restaurante'}
                </span>
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button type="button" onClick={() => setStep('account')}
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

        {/* Already have account */}
        <p className="text-center text-sm" style={{ color: '#584237' }}>
          Já tem conta?{' '}
          <Link href="/login" className="font-semibold hover:opacity-80 transition-opacity" style={{ color: '#f97316' }}>
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
