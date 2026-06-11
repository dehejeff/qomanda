'use client'

import { useRef, useState } from 'react'
import type { SupportTicketPriority, SupportTicketStatus } from '@/lib/support-tickets'
import { SUPPORT_CATEGORIES, SUPPORT_PRIORITIES, SUPPORT_STATUSES } from '@/lib/support-tickets'

export function TicketStatusBadge({ status }: { status: SupportTicketStatus }) {
  const label = SUPPORT_STATUSES.find(s => s.id === status)?.label ?? status
  const cls =
    status === 'open'
      ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      : status === 'in_progress'
        ? 'text-blue-400 border-blue-500/30 bg-blue-500/10'
        : status === 'waiting_customer'
          ? 'text-violet-400 border-violet-500/30 bg-violet-500/10'
          : status === 'resolved'
            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
            : 'text-on-surface-variant border-outline-variant'

  return (
    <span className={`text-[10px] font-mono uppercase px-2 py-1 rounded border ${cls}`}>
      {label}
    </span>
  )
}

export function TicketPriorityBadge({ priority }: { priority: SupportTicketPriority }) {
  const label = SUPPORT_PRIORITIES.find(p => p.id === priority)?.label ?? priority
  const cls =
    priority === 'urgent'
      ? 'text-red-400 border-red-500/30 bg-red-500/10'
      : priority === 'high'
        ? 'text-orange-400 border-orange-500/30 bg-orange-500/10'
        : 'text-on-surface-variant border-outline-variant'

  return (
    <span className={`text-[10px] font-mono uppercase px-2 py-1 rounded border ${cls}`}>
      {label}
    </span>
  )
}

export function TicketCategoryLabel({ category }: { category: string }) {
  const label = SUPPORT_CATEGORIES.find(c => c.id === category)?.label ?? category
  return <span className="text-xs text-on-surface-variant">{label}</span>
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function TicketThread({
  messages,
}: {
  messages: import('@/lib/support-tickets').SupportTicketMessage[]
}) {
  if (!messages.length) {
    return <p className="text-sm text-on-surface-variant text-center py-8">Nenhuma mensagem ainda.</p>
  }

  return (
    <div className="space-y-4">
      {messages.map(msg => {
        const isStaff = msg.author_type === 'staff'
        return (
          <div
            key={msg.id}
            className={`rounded-xl border px-4 py-3 ${
              isStaff
                ? 'border-primary/20 bg-primary/5 ml-0 md:ml-8'
                : 'border-outline-variant bg-surface-dim mr-0 md:mr-8'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div>
                <p className="text-sm font-semibold text-on-surface">
                  {msg.author_name ?? (isStaff ? 'Equipe KiComanda' : 'Restaurante')}
                </p>
                <p className="text-[10px] font-mono text-on-surface-variant">
                  {isStaff ? 'Suporte KiComanda' : 'Restaurante'} · {formatWhen(msg.created_at)}
                </p>
              </div>
            </div>
            <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed">{msg.body}</p>
            {msg.attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {msg.attachments.map(att => (
                  <a
                    key={att.id}
                    href={att.url ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface-container hover:border-primary/40 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">attach_file</span>
                    {att.file_name}
                  </a>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function TicketReplyForm({
  onSubmit,
  submitting,
  placeholder = 'Escreva sua mensagem…',
  submitLabel = 'Enviar',
  disabled,
}: {
  onSubmit: (body: string, files: File[]) => Promise<void>
  submitting: boolean
  placeholder?: string
  submitLabel?: string
  disabled?: boolean
}) {
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim() || disabled) return
    await onSubmit(body.trim(), files)
    setBody('')
    setFiles([])
    if (inputRef.current) inputRef.current.value = ''
  }

  function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    setFiles(prev => [...prev, ...selected].slice(0, 5))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-outline-variant pt-4">
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={4}
        disabled={disabled || submitting}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary resize-none disabled:opacity-50"
      />
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} className="text-xs font-mono px-2 py-1 rounded border border-outline-variant text-on-surface-variant">
              {f.name}
              <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="ml-2 text-red-400">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer h-9 px-3 rounded-lg text-xs font-mono border border-outline-variant text-on-surface-variant hover:text-on-surface flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">attach_file</span>
          Anexar
          <input ref={inputRef} type="file" multiple accept="image/*,.pdf,.txt,.doc,.docx" className="hidden" onChange={onFilesChange} disabled={disabled || submitting} />
        </label>
        <button
          type="submit"
          disabled={disabled || submitting || !body.trim()}
          className="h-9 px-5 rounded-lg text-xs font-mono font-bold bg-primary-container text-on-primary-container hover:opacity-90 disabled:opacity-50 ml-auto"
        >
          {submitting ? 'Enviando…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

export function NewTicketForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (data: { subject: string; category: string; body: string; files: File[] }) => Promise<void>
  submitting: boolean
}) {
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('other')
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSubmit({ subject, category, body, files })
    setSubject('')
    setCategory('other')
    setBody('')
    setFiles([])
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Assunto</label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            required
            placeholder="Ex.: PIX não confirma no checkout"
            className="h-10 px-3 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Categoria</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="h-10 px-3 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary"
          >
            {SUPPORT_CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Descrição</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          required
          rows={5}
          placeholder="Descreva o problema, dúvida ou solicitação. Inclua mesa, horário ou prints se aplicável."
          className="w-full px-3 py-2 rounded-lg text-sm bg-surface-dim border border-outline-variant text-on-surface outline-none focus:border-primary resize-none"
        />
      </div>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} className="text-xs font-mono px-2 py-1 rounded border border-outline-variant text-on-surface-variant">
              {f.name}
              <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="ml-2 text-red-400">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer h-9 px-3 rounded-lg text-xs font-mono border border-outline-variant text-on-surface-variant hover:text-on-surface flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">attach_file</span>
          Anexar prints ou documentos
          <input ref={inputRef} type="file" multiple accept="image/*,.pdf,.txt,.doc,.docx" className="hidden" onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files ?? [])].slice(0, 5))} />
        </label>
        <button
          type="submit"
          disabled={submitting || !subject.trim() || !body.trim()}
          className="h-10 px-6 rounded-lg text-sm font-mono font-bold bg-primary-container text-on-primary-container hover:opacity-90 disabled:opacity-50 ml-auto"
        >
          {submitting ? 'Abrindo…' : 'Abrir ticket'}
        </button>
      </div>
    </form>
  )
}
