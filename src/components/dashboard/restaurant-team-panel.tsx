'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

type Member = {
  id: string
  email: string
  name: string | null
  role: string
  active: boolean
  has_login: boolean
}

const MIN_PASSWORD = 6

type StaffRole = 'manager' | 'waiter' | 'kitchen' | 'caixa' | 'recepcionista'
const ROLE_OPTIONS: { id: StaffRole; label: string }[] = [
  { id: 'waiter',        label: 'Garçom'       },
  { id: 'kitchen',       label: 'Cozinha'      },
  { id: 'caixa',         label: 'Caixa'        },
  { id: 'recepcionista', label: 'Recepcionista' },
  { id: 'manager',       label: 'Gerente'      },
]
const ROLE_LABEL: Record<string, string> = { owner: 'Dono', manager: 'Gerente', waiter: 'Garçom', kitchen: 'Cozinha', caixa: 'Caixa', recepcionista: 'Recepcionista' }

export function RestaurantTeamPanel() {
  const [members, setMembers] = useState<Member[]>([])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<StaffRole>('waiter')
  const [password, setPassword] = useState('')
  const [adding, setAdding] = useState(false)
  const [resetFor, setResetFor] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/dashboard/members')
    const data = await res.json()
    if (res.ok) setMembers(data.members ?? [])
  }

  useEffect(() => { load() }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (password && password.length < MIN_PASSWORD) {
      toast.error(`A senha deve ter ao menos ${MIN_PASSWORD} caracteres.`)
      return
    }
    setAdding(true)
    try {
      const res = await fetch('/api/dashboard/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, role, password: password || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro ao adicionar.'); return }
      const ACESSO: Record<StaffRole, string> = {
        manager: '/dashboard (painel)',
        caixa: '/dashboard/caixa',
        recepcionista: '/garcom (aba Fila) no celular',
        waiter: '/garcom no celular',
        kitchen: '/cozinha (KDS)',
      }
      const acessa = ACESSO[role]
      toast.success(
        password
          ? `${ROLE_LABEL[role]} criado com senha. Acesso em ${acessa}.`
          : `${ROLE_LABEL[role]} adicionado (sem senha). Defina uma senha para liberar o login.`,
      )
      setEmail(''); setName(''); setPassword(''); setRole('waiter')
      load()
    } finally {
      setAdding(false)
    }
  }

  async function submitReset(memberId: string) {
    if (resetPassword.length < MIN_PASSWORD) {
      toast.error(`A senha deve ter ao menos ${MIN_PASSWORD} caracteres.`)
      return
    }
    setBusyId(memberId)
    try {
      const res = await fetch('/api/dashboard/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, password: resetPassword }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro ao redefinir senha.'); return }
      toast.success('Senha definida.')
      setResetFor(null); setResetPassword('')
      load()
    } finally {
      setBusyId(null)
    }
  }

  async function toggleActive(member: Member) {
    setBusyId(member.id)
    try {
      const res = await fetch('/api/dashboard/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, active: !member.active }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro ao atualizar.'); return }
      toast.success(member.active ? 'Conta inativada.' : 'Conta reativada.')
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-4">
      <p className="text-sm text-on-surface-variant">
        Convide garçons pelo e-mail e defina uma senha para liberar o login. Eles acessam o app em{' '}
        <span className="font-mono">/garcom</span> ou{' '}
        <span className="font-mono">/login?perfil=garcom</span> no celular.
      </p>

      <form onSubmit={add} className="grid grid-cols-1 sm:grid-cols-[1.3fr_1fr_auto_1fr_auto] gap-2">
        <input
          type="email"
          required
          placeholder="E-mail"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="px-3 py-2 rounded-lg bg-surface-dim border border-outline-variant text-sm"
        />
        <input
          placeholder="Nome"
          value={name}
          onChange={e => setName(e.target.value)}
          className="px-3 py-2 rounded-lg bg-surface-dim border border-outline-variant text-sm"
        />
        <select
          value={role}
          onChange={e => setRole(e.target.value as StaffRole)}
          aria-label="Perfil do colaborador"
          className="px-3 py-2 rounded-lg bg-surface-dim border border-outline-variant text-sm"
        >
          {ROLE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <input
          type="password"
          placeholder={`Senha (mín. ${MIN_PASSWORD})`}
          value={password}
          autoComplete="new-password"
          onChange={e => setPassword(e.target.value)}
          className="px-3 py-2 rounded-lg bg-surface-dim border border-outline-variant text-sm font-mono"
        />
        <button
          type="submit"
          disabled={adding}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold disabled:opacity-50"
        >
          {adding ? 'Salvando…' : 'Adicionar'}
        </button>
      </form>
      <p className="text-[11px] text-on-surface-variant">
        <strong>Garçom</strong> → app <span className="font-mono">/garcom</span> · <strong>Cozinha</strong> → <span className="font-mono">/cozinha</span> · <strong>Recepcionista</strong> → app <span className="font-mono">/garcom</span> (aba Fila de espera) · <strong>Caixa</strong> → <span className="font-mono">/dashboard/caixa</span> · <strong>Gerente</strong> → painel completo <span className="font-mono">/dashboard</span>.
      </p>

      <ul className="space-y-2">
        {members.map(m => {
          const isOwner = m.role === 'owner'
          return (
            <li key={m.id} className="border border-outline-variant rounded-lg px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className={`font-medium ${m.active ? 'text-on-surface' : 'text-on-surface-variant line-through'}`}>
                    {m.name ?? m.email}
                  </span>
                  <span className="font-mono text-on-surface-variant"> · {ROLE_LABEL[m.role] ?? m.role}</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <StatusChip ok={m.active} okLabel="Ativo" offLabel="Inativo" />
                    <StatusChip ok={m.has_login} okLabel="Login" offLabel="Sem senha" warnWhenOff />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-on-surface-variant text-xs hidden md:inline">{m.email}</span>
                  {!isOwner && (
                    <>
                      <button
                        type="button"
                        onClick={() => { setResetFor(resetFor === m.id ? null : m.id); setResetPassword('') }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-mono border border-outline-variant text-on-surface-variant hover:text-on-surface"
                      >
                        {m.has_login ? 'Trocar senha' : 'Definir senha'}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === m.id}
                        onClick={() => toggleActive(m)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border disabled:opacity-50 ${
                          m.active
                            ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                            : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                      >
                        {m.active ? 'Inativar' : 'Reativar'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {resetFor === m.id && !isOwner && (
                <div className="flex flex-col sm:flex-row gap-2 mt-2.5 pt-2.5 border-t border-outline-variant">
                  <input
                    type="password"
                    autoFocus
                    autoComplete="new-password"
                    placeholder={`Nova senha (mín. ${MIN_PASSWORD})`}
                    value={resetPassword}
                    onChange={e => setResetPassword(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitReset(m.id) }}
                    className="flex-1 px-3 py-2 rounded-lg bg-surface-dim border border-outline-variant text-sm font-mono"
                  />
                  <button
                    type="button"
                    disabled={busyId === m.id}
                    onClick={() => submitReset(m.id)}
                    className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold disabled:opacity-50"
                  >
                    Salvar senha
                  </button>
                  <button
                    type="button"
                    onClick={() => { setResetFor(null); setResetPassword('') }}
                    className="px-3 py-2 rounded-lg text-sm text-on-surface-variant hover:text-on-surface"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </li>
          )
        })}
        {members.length === 0 && (
          <li className="text-sm text-on-surface-variant py-4 text-center">Nenhum membro na equipe ainda.</li>
        )}
      </ul>
    </section>
  )
}

function StatusChip({ ok, okLabel, offLabel, warnWhenOff }: {
  ok: boolean; okLabel: string; offLabel: string; warnWhenOff?: boolean
}) {
  const cls = ok
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
    : warnWhenOff
      ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      : 'text-on-surface-variant border-outline-variant bg-surface-dim'
  return (
    <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${cls}`}>
      {ok ? okLabel : offLabel}
    </span>
  )
}
