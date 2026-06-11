'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { NewTicketForm, TicketCategoryLabel, TicketStatusBadge } from '@/components/support/ticket-ui'
import type { SupportTicketListItem } from '@/lib/support-tickets'
import { ticketRef } from '@/lib/support-tickets'

export default function RestaurantSupportPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<SupportTicketListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/support/tickets')
      .then(r => r.json())
      .then(d => setTickets(d.tickets ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(data: { subject: string; category: string; body: string; files: File[] }) {
    setCreating(true)
    try {
      const formData = new FormData()
      formData.set('subject', data.subject)
      formData.set('category', data.category)
      formData.set('body', data.body)
      data.files.forEach(f => formData.append('files', f))

      const res = await fetch('/api/dashboard/support/tickets', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao abrir ticket.')

      toast.success('Ticket aberto! Nossa equipe responderá em breve.')
      if (json.ticket?.id) {
        router.push(`/dashboard/support/${json.ticket.id}`)
      } else {
        setShowForm(false)
        const refresh = await fetch('/api/dashboard/support/tickets').then(r => r.json())
        setTickets(refresh.tickets ?? [])
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao abrir ticket.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-on-surface">Suporte</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Abra tickets, anexe prints e converse com a equipe KiComanda.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="h-10 px-5 rounded-lg text-sm font-mono font-bold bg-primary-container text-on-primary-container hover:opacity-90"
          >
            Novo ticket
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-on-surface">Novo ticket</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-xs font-mono text-on-surface-variant hover:text-on-surface">
              Cancelar
            </button>
          </div>
          <NewTicketForm onSubmit={handleCreate} submitting={creating} />
        </div>
      )}

      <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant">
          <h2 className="text-sm font-semibold text-on-surface">Seus tickets</h2>
        </div>
        {loading ? (
          <p className="px-6 py-8 text-sm text-on-surface-variant">Carregando…</p>
        ) : tickets.length === 0 ? (
          <p className="px-6 py-8 text-sm text-on-surface-variant text-center">
            Nenhum ticket ainda. Clique em <strong className="text-on-surface">Novo ticket</strong> para falar conosco.
          </p>
        ) : (
          <div className="divide-y divide-outline-variant">
            {tickets.map(t => (
              <Link
                key={t.id}
                href={`/dashboard/support/${t.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-surface-container-low transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-xs font-mono text-primary">{ticketRef(t.id)}</p>
                  <p className="text-sm font-semibold text-on-surface truncate">{t.subject}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    <TicketCategoryLabel category={t.category} /> · {new Date(t.last_message_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <TicketStatusBadge status={t.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
