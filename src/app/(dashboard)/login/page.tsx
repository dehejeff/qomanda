'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { QomandaLogo } from '@/components/qomanda-logo'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e: React.FormEvent) {
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
  function onBlur (e: React.FocusEvent<HTMLInputElement>) { e.target.style.borderColor = '#584237' }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 relative"
      style={{ background: '#0b1326', color: '#dae2fd', fontFamily: 'Geist, sans-serif' }}>
      <div className="pointer-events-none fixed top-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full"
        style={{ background: 'rgba(249,115,22,0.07)', filter: 'blur(100px)' }} />

      <div className="relative z-10 w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <QomandaLogo size={48} />
          <div className="text-center">
            <h1 className="text-2xl font-black" style={{ letterSpacing: '-0.02em' }}>Bem-vindo de volta</h1>
            <p className="text-sm mt-1" style={{ color: '#a78b7d' }}>Acesse o painel do seu restaurante</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="seu@restaurante.com" required
              style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
            style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 24px rgba(249,115,22,0.25)', marginTop: 8 }}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Entrar no Painel'}
          </button>
        </form>

        <div className="flex flex-col items-center gap-3">
          <p className="text-sm" style={{ color: '#584237' }}>
            Novo por aqui?{' '}
            <Link href="/cadastro" className="font-semibold transition-colors hover:opacity-80" style={{ color: '#f97316' }}>
              Cadastre seu restaurante
            </Link>
          </p>

          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 h-px" style={{ background: '#1e293b' }} />
            <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#584237' }}>acesso rápido</span>
            <div className="flex-1 h-px" style={{ background: '#1e293b' }} />
          </div>

          <Link href="/scan"
            className="w-full h-11 rounded-xl text-sm font-mono flex items-center justify-center gap-2 transition-all active:scale-95 hover:opacity-80"
            style={{ background: '#131b2e', border: '1px solid #584237', color: '#a78b7d' }}>
            <span className="material-symbols-outlined text-[18px]">phone_iphone</span>
            Ir para Scanner (cliente)
          </Link>
        </div>
      </div>
    </div>
  )
}
