'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  TicketCategoryLabel,
  TicketPriorityBadge,
  TicketStatusBadge,
} from '@/components/support/ticket-ui'
import type { SupportTicketListItem, SupportTicketStatus } from '@/lib/support-tickets'
import { SUPPORT_STATUSES, ticketRef } from '@/lib/support-tickets'

export default function InternalSupportPage() {
  const [tickets, setTickets] = useState<SupportTicketListItem[]>([])
  const [openCount, setOpenCount] = useState(0)
  const [filter, setFilter] = useState<SupportTicketStatus | 'all'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const qs = filter === 'all' ? '' : `?status=${filter}`
    fetch(`/api/internal/support/tickets${qs}`)
      .then(r => r.json())
      .then(d => {
        setTickets(d.tickets ?? [])
        setOpenCount(d.openCount ?? 0)
      })
      .finally(() => setLoading(false))
  }, [filter])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-on-surface">Suporte</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Tickets abertos pelos restaurantes · {openCount} aguardando atendimento
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 p-1 rounded-xl w-fit bg-surface-container-low border border-outline-variant">
        {[{ id: 'all' as const, label: 'Todos' }, ...SUPPORT_STATUSES.map(s => ({ id: s.id, label: s.label }))].map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-lg text-xs font-mono transition-all ${
              filter === f.id
                ? 'bg-primary-container text-on-primary-container font-bold'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
        {loading ? (
          <p className="px-6 py-8 text-sm text-on-surface-variant">Carregando…</p>
        ) : tickets.length === 0 ? (
          <p className="px-6 py-8 text-sm text-on-surface-variant text-center">Nenhum ticket neste filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">
                  {['Ticket', 'Restaurante', 'Assunto', 'Categoria', 'Status', 'Prioridade', 'Atualizado'].map(h => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {tickets.map(t => (
                  <tr key={t.id} className="hover:bg-surface-container-low">
                    <td className="px-4 py-3 font-mono text-primary">
                      <Link href={`/internal/support/${t.id}`} className="hover:underline">{ticketRef(t.id)}</Link>
                    </td>
                    <td className="px-4 py-3 text-on-surface">{t.restaurant_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Link href={`/internal/support/${t.id}`} className="text-on-surface hover:text-primary font-medium">
                        {t.subject}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><TicketCategoryLabel category={t.category} /></td>
                    <td className="px-4 py-3"><TicketStatusBadge status={t.status} /></td>
                    <td className="px-4 py-3"><TicketPriorityBadge priority={t.priority} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">
                      {new Date(t.last_message_at).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
