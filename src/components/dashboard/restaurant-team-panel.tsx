'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

type Member = { id: string; email: string; name: string | null; role: string; active: boolean }

export function RestaurantTeamPanel() {
  const [members, setMembers] = useState<Member[]>([])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')

  async function load() {
    const res = await fetch('/api/dashboard/members')
    const data = await res.json()
    if (res.ok) setMembers(data.members ?? [])
  }

  useEffect(() => { load() }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/dashboard/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, role: 'waiter' }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Erro ao convidar.')
      return
    }
    toast.success('Garçom adicionado. Ele entra em /login → Garçom com este e-mail.')
    setEmail('')
    setName('')
    load()
  }

  return (
    <section className="space-y-4">
      <p className="text-sm text-on-surface-variant">
        Convide garçons pelo e-mail. Eles acessam <span className="font-mono">/login?perfil=garcom</span> com a senha da conta Supabase.
      </p>
      <form onSubmit={add} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          placeholder="E-mail"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg bg-surface-dim border border-outline-variant text-sm"
        />
        <input
          placeholder="Nome"
          value={name}
          onChange={e => setName(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg bg-surface-dim border border-outline-variant text-sm"
        />
        <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold">Adicionar</button>
      </form>
      <ul className="space-y-2">
        {members.map(m => (
          <li key={m.id} className="flex justify-between text-sm border border-outline-variant rounded-lg px-3 py-2">
            <span>{m.name ?? m.email} · <span className="font-mono text-on-surface-variant">{m.role}</span></span>
            <span className="text-on-surface-variant">{m.email}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
