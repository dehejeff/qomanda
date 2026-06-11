'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  TicketCategoryLabel,
  TicketReplyForm,
  TicketStatusBadge,
  TicketThread,
} from '@/components/support/ticket-ui'
import type { SupportTicketDetail } from '@/lib/support-tickets'
import { ticketRef } from '@/lib/support-tickets'

export default function RestaurantSupportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [replying, setReplying] = useState(false)

  useEffect(() => {
    params.then(p => setTicketId(p.id))
  }, [params])

  useEffect(() => {
    if (!ticketId) return
    fetch(`/api/dashboard/support/tickets/${ticketId}`)
      .then(r => r.json())
      .then(d => setTicket(d.ticket ?? null))
      .finally(() => setLoading(false))
  }, [ticketId])

  async function handleReply(body: string, files: File[]) {
    if (!ticketId) return
    setReplying(true)
    try {
      const formData = new FormData()
      formData.set('body', body)
      files.forEach(f => formData.append('files', f))

      const res = await fetch(`/api/dashboard/support/tickets/${ticketId}`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar.')
      setTicket(data.ticket)
      toast.success('Mensagem enviada.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar.')
    } finally {
      setReplying(false)
    }
  }

  if (loading) return <p className="text-on-surface-variant">Carregando…</p>
  if (!ticket) return <p className="text-on-surface-variant">Ticket não encontrado.</p>

  const closed = ticket.status === 'closed'

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/dashboard/support" className="text-xs font-mono text-on-surface-variant hover:text-on-surface">← Suporte</Link>
        <div className="flex flex-wrap items-start justify-between gap-3 mt-2">
          <div>
            <p className="text-xs font-mono text-primary">{ticketRef(ticket.id)}</p>
            <h1 className="text-xl font-black text-on-surface">{ticket.subject}</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              <TicketCategoryLabel category={ticket.category} /> · aberto em {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <TicketStatusBadge status={ticket.status} />
        </div>
      </div>

      <div className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-4">
        <TicketThread messages={ticket.messages} />
        <TicketReplyForm
          onSubmit={handleReply}
          submitting={replying}
          disabled={closed}
          placeholder={closed ? 'Ticket encerrado.' : 'Responder à equipe KiComanda…'}
          submitLabel="Enviar resposta"
        />
      </div>
    </div>
  )
}
