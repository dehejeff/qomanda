'use client'

import { useState, useEffect, useRef } from 'react'
import {
  type Lead,
  type LeadStatus,
  LEAD_STATUSES,
  RESTAURANT_TYPE_LABELS,
  getStatusMeta,
} from '@/lib/crm-leads'

type Props = {
  lead: Lead | null
  onClose: () => void
  onUpdate: (id: string, patch: { status?: LeadStatus; notes?: string }) => void
  onDelete: (id: string) => void
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtWhatsApp(digits: string) {
  const d = digits.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return digits
}

export function LeadModal({ lead, onClose, onUpdate, onDelete }: Props) {
  const [notes,    setNotes]    = useState(lead?.notes ?? '')
  const [status,   setStatus]   = useState<LeadStatus>(lead?.status ?? 'novo')
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (lead) {
      setNotes(lead.notes ?? '')
      setStatus(lead.status)
      setConfirmDelete(false)
    }
  }, [lead])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!lead) return null

  const statusMeta = getStatusMeta(status)
  const wonLost = status === 'fechado_ganho' || status === 'fechado_perdido'

  async function handleSave() {
    if (!lead) return
    setSaving(true)
    try {
      const patch: { status?: LeadStatus; notes?: string } = {}
      if (status !== lead.status) patch.status = status
      if (notes !== (lead.notes ?? '')) patch.notes = notes
      if (Object.keys(patch).length > 0) {
        const res = await fetch(`/api/internal/crm/leads/${lead.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (res.ok) onUpdate(lead.id, patch)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!lead) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/internal/crm/leads/${lead.id}`, { method: 'DELETE' })
      if (res.ok) { onDelete(lead.id); onClose() }
    } finally {
      setDeleting(false)
    }
  }

  const whatsappHref = `https://wa.me/55${lead.whatsapp.replace(/\D/g, '')}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col max-h-[90vh] overflow-hidden"
        style={{ background: '#131c30', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: `${statusMeta.color}22`, color: statusMeta.color, border: `1px solid ${statusMeta.color}44` }}
              >
                {statusMeta.label}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white truncate">{lead.restaurantName}</h2>
            <p className="text-sm mt-0.5" style={{ color: '#94a3b8' }}>{RESTAURANT_TYPE_LABELS[lead.restaurantType]}</p>
          </div>
          <button onClick={onClose} className="ml-4 text-slate-400 hover:text-white transition-colors flex-shrink-0">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Contact */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#475569' }}>Contato</p>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[18px]" style={{ color: '#64748b' }}>person</span>
              <span className="text-sm text-white font-medium">{lead.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[18px]" style={{ color: '#64748b' }}>phone</span>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium transition-colors hover:text-green-400"
                style={{ color: '#22c55e' }}
              >
                {fmtWhatsApp(lead.whatsapp)}
                <span className="material-symbols-outlined text-[14px] ml-1 align-middle">open_in_new</span>
              </a>
            </div>
            {lead.email && (
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[18px]" style={{ color: '#64748b' }}>mail</span>
                <a href={`mailto:${lead.email}`} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">{lead.email}</a>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[18px]" style={{ color: '#64748b' }}>schedule</span>
              <span className="text-sm" style={{ color: '#64748b' }}>{fmtDate(lead.createdAt)}</span>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#475569' }}>Status do pipeline</p>
            <div className="grid grid-cols-2 gap-1.5">
              {LEAD_STATUSES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className="rounded-lg px-3 py-2 text-left text-xs font-medium transition-all"
                  style={{
                    background: status === s.value ? `${s.color}22` : 'rgba(255,255,255,0.03)',
                    border: status === s.value ? `1.5px solid ${s.color}` : '1px solid rgba(255,255,255,0.06)',
                    color: status === s.value ? s.color : '#64748b',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#475569' }}>Observações</p>
            <textarea
              ref={textareaRef}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Anotações sobre o lead, histórico de contato, próximos passos..."
              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none resize-none transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 flex items-center gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              Remover
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">warning</span>
              {deleting ? 'Removendo...' : 'Confirmar remoção'}
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-bold transition-opacity disabled:opacity-60"
            style={{ background: wonLost ? statusMeta.color : '#ffb690', color: '#0b1326' }}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
