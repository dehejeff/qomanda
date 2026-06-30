'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { KiComandaLogo } from '@/components/kicomanda-logo'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function InternalLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }

    // Garante cookies de sessão antes do fetch server-side
    await supabase.auth.getSession()
    router.refresh()

    let res = await fetch('/api/internal/session')
    if (res.status === 401) {
      await new Promise(r => setTimeout(r, 400))
      router.refresh()
      res = await fetch('/api/internal/session')
    }

    if (!res.ok) {
      await supabase.auth.signOut()
      const body = await res.json().catch(() => ({})) as { error?: string }
      if (res.status === 403) {
        toast.error('Esta conta não tem acesso ao portal interno.')
      } else if (res.status === 401) {
        toast.error('Sessão não validada. Atualize a página e tente de novo.')
      } else {
        toast.error(body.error ?? 'Erro ao entrar no portal interno.')
      }
      setLoading(false)
      return
    }

    router.push('/internal')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <KiComandaLogo size={48} />
          <p className="text-sm font-black text-on-surface">KiComanda<span style={{ color: '#00E676' }}>.</span></p>
          <div>
            <h1 className="text-xl font-black text-on-surface">Portal interno</h1>
            <p className="text-sm text-on-surface-variant mt-1">Acesso restrito à equipe KiComanda</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-surface-container border border-outline-variant rounded-xl p-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">E-mail corporativo</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full h-10 px-3 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full h-10 px-3 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg text-sm font-mono font-bold bg-primary-container text-on-primary-container hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Entrar
          </button>
        </form>

        <p className="text-center text-xs text-on-surface-variant">
          <Link href="/" className="hover:text-on-surface transition-colors">← Voltar ao site</Link>
        </p>
      </div>
    </div>
  )
}
