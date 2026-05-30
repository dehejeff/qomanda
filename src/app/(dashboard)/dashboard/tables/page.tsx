'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RestaurantTable } from '@/types'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'
import { DEV_BYPASS, mockTables, mockRestaurant } from '@/lib/dev-mock'
import { TableQrModal } from '@/components/dashboard/table-qr-modal'
import { TableManageModal } from '@/components/dashboard/table-manage-modal'

const STATUS_CONFIG: Record<string, { label: string; cardClass: string; labelClass: string; icon: string }> = {
  free:     { label: 'Livre',     cardClass: 'border-outline-variant hover:border-primary cursor-pointer group', labelClass: 'text-on-surface-variant group-hover:text-primary', icon: '' },
  occupied: { label: 'Ocupada',   cardClass: 'bg-primary-container border-primary/30 cursor-pointer',           labelClass: 'text-on-primary-container',                        icon: 'person' },
  reserved: { label: 'Reservada', cardClass: 'bg-surface-container-highest/50 border-outline-variant opacity-60', labelClass: 'text-on-surface-variant',                        icon: 'event_busy' },
}

export default function TablesPage() {
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [restaurantSlug, setRestaurantSlug] = useState('')
  const [restaurantId, setRestaurantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [qrTable, setQrTable] = useState<RestaurantTable | null>(null)
  const [manageTable, setManageTable] = useState<RestaurantTable | null>(null)

  useEffect(() => {
    if (DEV_BYPASS) {
      setRestaurantSlug(mockRestaurant.slug)
      setRestaurantId(mockRestaurant.id)
      setTables(mockTables)
      setLoading(false)
      return
    }
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: r } = await supabase.from('restaurants').select('id, slug').eq('owner_id', user.id).single()
      if (!r) return
      setRestaurantSlug(r.slug)
      setRestaurantId(r.id)
      const { data } = await supabase.from('tables').select('*').eq('restaurant_id', r.id).order('number')
      setTables((data ?? []) as RestaurantTable[])
      setLoading(false)
    })
  }, [])

  async function addTable() {
    setAdding(true)
    if (DEV_BYPASS) {
      const next = String(tables.length + 1)
      const newTable: RestaurantTable = { id: `table-${Date.now()}`, restaurant_id: restaurantId, number: next, qr_code_url: null, status: 'free', created_at: new Date().toISOString() }
      setTables((prev) => [...prev, newTable])
      toast.success(`Mesa ${next} criada!`)
      setAdding(false)
      return
    }
    const supabase = createClient()
    const next = String(tables.length + 1)
    const { data, error } = await supabase.from('tables').insert({ restaurant_id: restaurantId, number: next, status: 'free' }).select().single()
    if (error) { toast.error('Erro ao adicionar mesa'); setAdding(false); return }
    setTables((prev) => [...prev, data as RestaurantTable])
    toast.success(`Mesa ${next} criada!`)
    setAdding(false)
  }

  async function deleteTable(id: string) {
    setDeleting(true)
    if (DEV_BYPASS) {
      setTables((prev) => prev.filter((t) => t.id !== id))
      setConfirmDeleteId(null)
      setDeleting(false)
      toast.success('Mesa removida.')
      return
    }
    const supabase = createClient()
    const { error } = await supabase.from('tables').delete().eq('id', id)
    if (error) { toast.error('Erro ao remover mesa'); setDeleting(false); return }
    setTables((prev) => prev.filter((t) => t.id !== id))
    setConfirmDeleteId(null)
    setDeleting(false)
    toast.success('Mesa removida.')
  }

  function getQrUrl(table: RestaurantTable) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    return `${base}/${restaurantSlug}?mesa=${table.number}`
  }

  function handleTableUpdated(tableId: string, status: RestaurantTable['status']) {
    setTables((prev) => prev.map((t) => t.id === tableId ? { ...t, status } : t))
  }

  function handleTableSwitched(fromId: string, toId: string) {
    setTables((prev) => prev.map((t) => {
      if (t.id === fromId) return { ...t, status: 'free' as const }
      if (t.id === toId)   return { ...t, status: 'occupied' as const }
      return t
    }))
  }

  const occupied = tables.filter((t) => t.status === 'occupied').length
  const reserved = tables.filter((t) => t.status === 'reserved').length
  const free     = tables.filter((t) => t.status === 'free').length

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-primary-container" />
    </div>
  )

  return (
    <>
      <div className="space-y-stack-lg">
        {/* Header */}
        <div className="flex justify-between items-center gap-3">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}>Mesas</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">{tables.length} mesas cadastradas</p>
          </div>
          <button
            onClick={addTable}
            disabled={adding}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-container text-on-primary-container text-sm font-bold font-mono rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="material-symbols-outlined text-[18px]">add</span>}
            <span className="hidden sm:inline">Nova Mesa</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 md:gap-card-gap">
          {[
            { label: 'OCUPADAS',   value: occupied, color: 'text-primary' },
            { label: 'RESERVADAS', value: reserved, color: 'text-amber-400' },
            { label: 'LIVRES',     value: free,     color: 'text-emerald-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 bg-surface-container border border-outline-variant rounded-xl">
              <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-2">{label}</p>
              <p className={`text-2xl font-bold ${color}`} style={{ fontFamily: 'Geist, sans-serif' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 md:gap-6">
          <span className="text-xs font-mono text-on-surface-variant">Legenda:</span>
          {[
            { cls: 'border border-outline-variant',                       label: 'Livre' },
            { cls: 'bg-primary-container border-primary/30',              label: 'Ocupada' },
            { cls: 'bg-surface-container-highest border-outline-variant', label: 'Reservada' },
          ].map(({ cls, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-sm border ${cls}`} />
              <span className="text-xs font-mono text-on-surface-variant">{label}</span>
            </div>
          ))}
          <span className="hidden md:block text-xs font-mono text-on-surface-variant/50 ml-auto">
            Livre → QR Code · Ocupada/Reservada → Gerenciar
          </span>
        </div>

        {/* Table grid */}
        {tables.length === 0 ? (
          <div className="tonal-layer-1 ghost-border rounded-xl p-12 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30 mb-3 block">table_restaurant</span>
            <p className="text-sm font-mono text-on-surface-variant mb-4">Nenhuma mesa cadastrada</p>
            <button onClick={addTable} className="px-6 py-2 bg-primary-container text-on-primary-container text-sm font-bold font-mono rounded-lg hover:opacity-90 transition-opacity">
              Adicionar primeira mesa
            </button>
          </div>
        ) : (
          <div className="tonal-layer-1 ghost-border rounded-xl p-6">
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {tables.map((table) => {
                const s = STATUS_CONFIG[table.status] ?? STATUS_CONFIG.free
                const isConfirming = confirmDeleteId === table.id

                return (
                  <div
                    key={table.id}
                    className={`relative aspect-square rounded-lg flex flex-col items-center justify-center border transition-all ${s.cardClass}`}
                    onClick={() => {
                      if (isConfirming) return
                      if (table.status === 'free') setQrTable(table)
                      else setManageTable(table)
                    }}
                  >
                    {isConfirming ? (
                      /* Confirmation overlay */
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-error/10 border-error/30 rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-[9px] font-mono text-error text-center leading-tight px-1">Excluir?</p>
                        <div className="flex gap-1 mt-1">
                          <button
                            onClick={() => deleteTable(table.id)}
                            disabled={deleting}
                            className="px-2 py-0.5 bg-error text-white text-[9px] font-mono font-bold rounded hover:opacity-90"
                          >
                            {deleting ? '...' : 'Sim'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-0.5 bg-surface-container-highest text-on-surface-variant text-[9px] font-mono rounded hover:bg-surface-variant"
                          >
                            Não
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className={`text-xs font-bold font-mono ${s.labelClass}`}>
                          T-{table.number.padStart(2, '0')}
                        </span>
                        {s.icon
                          ? <span className={`material-symbols-outlined text-sm ${s.labelClass}`}>{s.icon}</span>
                          : <span className="material-symbols-outlined text-[14px] text-on-surface-variant/40 mt-0.5 group-hover:text-primary transition-colors">qr_code</span>
                        }

                        {/* Delete button — só em mesas livres */}
                        {table.status === 'free' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(table.id) }}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-error/20 text-on-surface-variant/50 hover:text-error"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Counter area */}
            <div className="mt-8 flex justify-center">
              <div className="px-8 py-3 bg-surface-container-highest/30 border border-outline-variant border-dashed rounded-xl flex items-center gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-sm">countertops</span>
                <span className="text-xs font-mono">Área do Balcão e Cozinha</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QR Code Modal — mesas livres */}
      {qrTable && (
        <TableQrModal
          table={qrTable}
          url={getQrUrl(qrTable)}
          onClose={() => setQrTable(null)}
        />
      )}

      {/* Manage Modal — mesas ocupadas ou reservadas */}
      {manageTable && (
        <TableManageModal
          table={manageTable}
          freeTables={tables.filter((t) => t.status === 'free')}
          onClose={() => setManageTable(null)}
          onTableUpdated={handleTableUpdated}
          onTableSwitched={handleTableSwitched}
        />
      )}
    </>
  )
}
