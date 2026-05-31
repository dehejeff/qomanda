'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { InternalClientListItem } from '@/types/internal'

function brl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const SUB_STATUS: Record<string, string> = {
  trialing: 'Trial',
  active: 'Ativo',
  past_due: 'Inadimplente',
  paused: 'Pausado',
  cancelled: 'Cancelado',
}

const PAY_STATUS: Record<string, string> = {
  inactive: 'Inativo',
  pending: 'Em análise',
  active: 'Ativo',
}

export default function InternalClientsPage() {
  const [clients, setClients] = useState<InternalClientListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/internal/clients')
      .then(r => r.json())
      .then(d => setClients(d.clients ?? []))
      .finally(() => setLoading(false))
  }, [])

  const filtered = clients.filter(c => {
    const q = query.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || c.slug.includes(q) || (c.owner_email?.includes(q) ?? false)
  })

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-1">Carteira</p>
          <h1 className="text-2xl font-black text-on-surface">Clientes</h1>
        </div>
        <Link
          href="/internal/clients/new"
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg text-sm font-mono font-bold bg-primary-container text-on-primary-container hover:opacity-90"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Novo cliente
        </Link>
      </div>

      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Buscar por nome, slug ou e-mail..."
        className="w-full max-w-md h-10 px-3 rounded-lg text-sm bg-surface-container border border-outline-variant text-on-surface outline-none focus:border-primary"
      />

      <div className="bg-surface-container border border-outline-variant rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-outline-variant text-left">
              {['Restaurante', 'Plano', 'Assinatura', 'Mensalidade', 'Taxa tx', 'Pay', 'Mesas'].map(h => (
                <th key={h} className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-on-surface-variant font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {loading && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-on-surface-variant">Carregando...</td></tr>
            )}
            {!loading && filtered.map(c => (
              <tr key={c.id} className="hover:bg-surface-container-highest transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/internal/clients/${c.id}`} className="block">
                    <p className="font-medium text-on-surface hover:text-primary transition-colors">{c.name}</p>
                    <p className="text-xs font-mono text-on-surface-variant">{c.slug}</p>
                    {c.owner_email && <p className="text-xs text-on-surface-variant opacity-70">{c.owner_email}</p>}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-on-surface-variant">{c.plan_name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                    c.subscription_status === 'active' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                    : c.subscription_status === 'trialing' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                    : 'text-on-surface-variant border-outline-variant'
                  }`}>
                    {c.subscription_status ? SUB_STATUS[c.subscription_status] : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono">{brl(c.monthly_fee)}</td>
                <td className="px-4 py-3 font-mono">{c.platform_fee_percent.toFixed(2)}%</td>
                <td className="px-4 py-3 text-xs font-mono text-on-surface-variant">{PAY_STATUS[c.digital_status]}</td>
                <td className="px-4 py-3 font-mono text-on-surface-variant">{c.tables_count}</td>
              </tr>
            ))}
            {!loading && !filtered.length && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-on-surface-variant">Nenhum cliente encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
