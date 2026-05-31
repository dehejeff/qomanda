'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  TicketCategoryLabel,
  TicketPriorityBadge,
  TicketReplyForm,
  TicketStatusBadge,
  TicketThread,
} from '@/components/support/ticket-ui'
import type { SupportTicketDetail, SupportTicketPriority, SupportTicketStatus } from '@/lib/support-tickets'
import { SUPPORT_PRIORITIES, SUPPORT_STATUSES, ticketRef } from '@/lib/support-tickets'

export default function InternalSupportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [replying, setReplying] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    params.then(p => setTicketId(p.id))
  }, [params])

  useEffect(() => {
    if (!ticketId) return
    fetch(`/api/internal/support/tickets/${ticketId}`)
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

      const res = await fetch(`/api/internal/support/tickets/${ticketId}`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao responder.')
      setTicket(data.ticket)
      toast.success('Resposta enviada.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao responder.')
    } finally {
      setReplying(false)
    }
  }

  async function patchTicket(patch: { status?: SupportTicketStatus; priority?: SupportTicketPriority }) {
    if (!ticketId) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/internal/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao atualizar.')
      setTicket(data.ticket)
      toast.success('Ticket atualizado.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar.')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <p className="text-on-surface-variant">Carregando…</p>
  if (!ticket) return <p className="text-on-surface-variant">Ticket não encontrado.</p>

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/internal/support" className="text-xs font-mono text-on-surface-variant hover:text-on-surface">← Suporte</Link>
        <div className="flex flex-wrap items-start justify-between gap-4 mt-2">
          <div>
            <p className="text-xs font-mono text-primary">{ticketRef(ticket.id)}</p>
            <h1 className="text-2xl font-black text-on-surface">{ticket.subject}</h1>
            <p className="text-sm font-mono text-on-surface-variant mt-1">
              {ticket.restaurant_name} · <TicketCategoryLabel category={ticket.category} />
            </p>
            {ticket.created_by_email && (
              <p className="text-xs text-on-surface-variant mt-1">Aberto por {ticket.created_by_name ?? ticket.created_by_email}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <TicketStatusBadge status={ticket.status} />
            <TicketPriorityBadge priority={ticket.priority} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Status</label>
          <select
            value={ticket.status}
            disabled={updating}
            onChange={e => patchTicket({ status: e.target.value as SupportTicketStatus })}
            className="h-10 px-3 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary"
          >
            {SUPPORT_STATUSES.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Prioridade</label>
          <select
            value={ticket.priority}
            disabled={updating}
            onChange={e => patchTicket({ priority: e.target.value as SupportTicketPriority })}
            className="h-10 px-3 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary"
          >
            {SUPPORT_PRIORITIES.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-surface-container border border-outline-variant rounded-xl p-6 space-y-4">
        <TicketThread messages={ticket.messages} />
        <TicketReplyForm
          onSubmit={handleReply}
          submitting={replying}
          placeholder="Responder ao restaurante…"
          submitLabel="Enviar resposta"
        />
      </div>
    </div>
  )
}
