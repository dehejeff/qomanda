'use client'

import { useState, useCallback } from 'react'
import {
  type Lead,
  type LeadStatus,
  LEAD_STATUSES,
  RESTAURANT_TYPE_LABELS,
  getStatusMeta,
} from '@/lib/crm-leads'
import { LeadModal } from './LeadModal'

type Props = {
  initialLeads: Lead[]
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'agora'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d atrás`
  return new Date(iso).toLocaleDateString('pt-BR')
}

function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const meta = getStatusMeta(lead.status)
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl p-3.5 transition-all hover:scale-[1.01] active:scale-[0.99] group"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-white leading-tight line-clamp-1">{lead.restaurantName}</p>
        <span className="text-[10px] font-mono shrink-0 mt-0.5" style={{ color: '#475569' }}>{relativeTime(lead.createdAt)}</span>
      </div>
      <p className="text-xs mb-2 line-clamp-1" style={{ color: '#64748b' }}>{RESTAURANT_TYPE_LABELS[lead.restaurantType]}</p>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <span className="material-symbols-outlined text-[12px]" style={{ color: '#64748b' }}>person</span>
        </div>
        <span className="text-xs truncate" style={{ color: '#94a3b8' }}>{lead.name}</span>
        {lead.notes && (
          <span className="material-symbols-outlined text-[14px] ml-auto" style={{ color: meta.color, opacity: 0.7 }}>note</span>
        )}
      </div>
    </button>
  )
}

export function CrmBoard({ initialLeads }: Props) {
  const [leads,    setLeads]    = useState<Lead[]>(initialLeads)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [search,   setSearch]   = useState('')

  const filteredLeads = search.trim()
    ? leads.filter(l =>
        l.restaurantName.toLowerCase().includes(search.toLowerCase()) ||
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.whatsapp.includes(search)
      )
    : leads

  const grouped = LEAD_STATUSES.reduce<Record<LeadStatus, Lead[]>>((acc, s) => {
    acc[s.value] = filteredLeads.filter(l => l.status === s.value)
    return acc
  }, {} as Record<LeadStatus, Lead[]>)

  const handleUpdate = useCallback((id: string, patch: { status?: LeadStatus; notes?: string }) => {
    setLeads(prev => prev.map(l => {
      if (l.id !== id) return l
      return {
        ...l,
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.notes  !== undefined ? { notes:  patch.notes  } : {}),
        updatedAt: new Date().toISOString(),
      }
    }))
  }, [])

  const handleDelete = useCallback((id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id))
  }, [])

  const totalLeads = leads.length
  const wonCount   = leads.filter(l => l.status === 'fechado_ganho').length
  const activeCount = leads.filter(l => !['fechado_ganho','fechado_perdido'].includes(l.status)).length

  return (
    <>
      {/* Stats bar */}
      <div className="flex items-center gap-6 mb-6">
        <div>
          <p className="text-2xl font-black text-white">{totalLeads}</p>
          <p className="text-xs font-mono uppercase tracking-widest" style={{ color: '#475569' }}>Total leads</p>
        </div>
        <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div>
          <p className="text-2xl font-black" style={{ color: '#22c55e' }}>{wonCount}</p>
          <p className="text-xs font-mono uppercase tracking-widest" style={{ color: '#475569' }}>Fechados</p>
        </div>
        <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div>
          <p className="text-2xl font-black" style={{ color: '#f59e0b' }}>{activeCount}</p>
          <p className="text-xs font-mono uppercase tracking-widest" style={{ color: '#475569' }}>Em andamento</p>
        </div>
        <div className="flex-1" />
        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px]" style={{ color: '#475569' }}>search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar lead..."
            className="rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-600 outline-none w-52 transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          />
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
        {LEAD_STATUSES.map(col => {
          const colLeads = grouped[col.value] ?? []
          return (
            <div
              key={col.value}
              className="flex-shrink-0 flex flex-col rounded-2xl"
              style={{
                width: 240,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
                <span className="text-xs font-semibold text-white flex-1 truncate">{col.label}</span>
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: `${col.color}22`, color: col.color }}
                >
                  {colLeads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 min-h-[120px]">
                {colLeads.map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onClick={() => setSelected(lead)}
                  />
                ))}
                {colLeads.length === 0 && (
                  <div className="flex items-center justify-center h-16">
                    <p className="text-[11px] font-mono" style={{ color: '#30363D' }}>vazio</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      <LeadModal
        lead={selected}
        onClose={() => setSelected(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </>
  )
}
