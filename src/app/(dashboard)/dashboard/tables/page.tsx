'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RestaurantTable } from '@/types'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'
import { DEV_BYPASS, mockTables, mockRestaurant } from '@/lib/dev-mock'
import { TableQrModal } from '@/components/dashboard/table-qr-modal'
import { CounterQrModal } from '@/components/dashboard/counter-qr-modal'
import { TableManageModal } from '@/components/dashboard/table-manage-modal'
import { TableCreateModal } from '@/components/dashboard/table-create-modal'
import { WaitlistModal } from '@/components/dashboard/waitlist-modal'
import { GroupReserveModal } from '@/components/dashboard/group-reserve-modal'
import { buildTableCheckInUrl } from '@/lib/table-checkin-url'
import { PlanUpgradeModal } from '@/components/dashboard/plan-upgrade-modal'
import { nextTableNumber, sortTablesByNumber } from '@/lib/sort-tables'
import { groupTablesBySection, shouldShowSectionHeaders } from '@/lib/table-sections'
import type { TableFeature } from '@/app/api/dashboard/table-features/route'

const STATUS_CONFIG: Record<string, { label: string; cardClass: string; labelClass: string; icon: string }> = {
  free:     { label: 'Livre',     cardClass: 'border-outline-variant hover:border-primary cursor-pointer group', labelClass: 'text-on-surface-variant group-hover:text-primary', icon: '' },
  occupied: { label: 'Ocupada',   cardClass: 'bg-primary-container border-primary/30 cursor-pointer',           labelClass: 'text-on-primary-container',                        icon: 'person' },
  reserved: { label: 'Reservada', cardClass: 'bg-surface-container-highest/50 border-outline-variant opacity-60', labelClass: 'text-on-surface-variant',                        icon: 'event_busy' },
}

export default function TablesPage() {
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [restaurantSlug, setRestaurantSlug] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantId, setRestaurantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [qrTable, setQrTable] = useState<RestaurantTable | null>(null)
  const [showCounterQr, setShowCounterQr] = useState(false)
  const [manageTable, setManageTable] = useState<RestaurantTable | null>(null)
  const [operationalMode, setOperationalMode] = useState<'dine_in' | 'counter' | 'both'>('both')
  const [planName, setPlanName] = useState('Starter')
  const [maxTables, setMaxTables] = useState<number | null>(20)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showWaitlist, setShowWaitlist] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showGroupReserve, setShowGroupReserve] = useState(false)
  const [features, setFeatures] = useState<TableFeature[]>([])
  const [featureAssignments, setFeatureAssignments] = useState<{ table_id: string; feature_id: string }[]>([])

  async function loadPlanLimits() {
    try {
      const res = await fetch('/api/dashboard/tables')
      if (res.ok) {
        const data = await res.json()
        setPlanName(data.planName ?? 'Starter')
        setMaxTables(data.maxTables ?? null)
      }
    } catch { /* ignore */ }
  }

  async function loadFeatures() {
    try {
      const res = await fetch('/api/dashboard/table-features')
      if (res.ok) {
        const data = await res.json()
        setFeatures((data.features ?? []) as TableFeature[])
        setFeatureAssignments(data.assignments ?? [])
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (DEV_BYPASS) {
      setRestaurantSlug(mockRestaurant.slug)
      setRestaurantName(mockRestaurant.name)
      setRestaurantId(mockRestaurant.id)
      setTables(mockTables)
      setLoading(false)
      return
    }

    const supabase = createClient()
    const CHANNEL = 'tables-status'
    let ch: ReturnType<typeof supabase.channel> | undefined
    let cancelled = false

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) return

      const { data: r } = await supabase.from('restaurants').select('id, slug, name, operational_mode').eq('owner_id', user.id).single()
      if (cancelled || !r) return

      setRestaurantSlug(r.slug)
      setRestaurantName(r.name ?? '')
      setRestaurantId(r.id)
      setOperationalMode((r.operational_mode as 'dine_in' | 'counter' | 'both') ?? 'both')
      const { data } = await supabase.from('tables').select('*').eq('restaurant_id', r.id).is('archived_at', null).order('number')
      if (cancelled) return
      setTables(sortTablesByNumber((data ?? []) as RestaurantTable[]))
      setLoading(false)
      void loadPlanLimits()
      void loadFeatures()

      // O cliente do browser é singleton: remove qualquer canal antigo com o
      // mesmo tópico (sobrevive a StrictMode/HMR) antes de criar/assinar de novo.
      for (const existing of supabase.getChannels()) {
        if (existing.topic === `realtime:${CHANNEL}`) supabase.removeChannel(existing)
      }

      ch = supabase.channel(CHANNEL)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'tables',
          filter: `restaurant_id=eq.${r.id}`,
        }, (payload) => {
          const updated = payload.new as RestaurantTable
          setTables(prev => sortTablesByNumber(prev.map(t => t.id === updated.id ? { ...t, ...updated } : t)))
          if (updated.status === 'free') {
            toast.success(`Mesa ${updated.number} liberada`)
          }
        })
        .subscribe()
    }

    init()
    return () => {
      cancelled = true
      if (ch) supabase.removeChannel(ch)
    }
  }, [])

  async function addTable(kind: 'table' | 'counter' = 'table') {
    setAdding(true)
    if (DEV_BYPASS) {
      const next = kind === 'counter' ? 'BALCAO' : nextTableNumber(tables)
      const newTable: RestaurantTable = { id: `table-${Date.now()}`, restaurant_id: restaurantId, number: next, qr_code_url: null, status: 'free', created_at: new Date().toISOString() }
      setTables(prev => sortTablesByNumber([...prev, newTable]))
      toast.success(kind === 'counter' ? 'Balcão adicionado!' : `Mesa ${next} criada!`)
      setAdding(false)
      return
    }

    const res = await fetch('/api/dashboard/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    })
    const data = await res.json()
    setAdding(false)

    if (res.status === 403 && data.code === 'TABLE_LIMIT_REACHED') {
      setPlanName(data.planName ?? planName)
      setMaxTables(data.maxTables ?? maxTables)
      setUpgradeModalOpen(true)
      return
    }

    if (!res.ok) {
      toast.error(data.error ?? 'Erro ao adicionar')
      return
    }

    setTables(prev => sortTablesByNumber([...prev.filter(t => t.id !== data.table.id), data.table as RestaurantTable]))
    void loadPlanLimits()
    toast.success(kind === 'counter' ? 'Balcão adicionado!' : `Mesa ${data.table.number} criada!`)
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
    try {
      const res = await fetch(`/api/dashboard/tables?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao remover mesa')
        setDeleting(false)
        return
      }
      setTables((prev) => prev.filter((t) => t.id !== id))
      setConfirmDeleteId(null)
      toast.success(data.archived
        ? 'Mesa arquivada (tinha histórico de pagamentos).'
        : 'Mesa removida.')
    } catch {
      toast.error('Erro ao remover mesa')
    } finally {
      setDeleting(false)
    }
  }

  function getQrUrl(table: RestaurantTable) {
    const base =
      typeof window !== 'undefined'
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
    const token = table.check_in_token
    if (!token) {
      console.warn(`[Tables] Mesa ${table.number} sem check_in_token — regenere o QR após migração.`)
      return null
    }
    return buildTableCheckInUrl(base, restaurantSlug, table.number, token)
  }

  function getCounterUrl() {
    const base =
      typeof window !== 'undefined'
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
    return `${base}/${restaurantSlug}/balcao`
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

  function handleTablesFreed(tableIds: string[]) {
    const idSet = new Set(tableIds)
    setTables((prev) => prev.map((t) => idSet.has(t.id) ? { ...t, status: 'free' as const } : t))
  }

  // Balcão é uma "mesa" especial (number=BALCAO) — não entra no grid/contagem de mesas.
  const realTables = tables.filter((t) => t.number.toUpperCase() !== 'BALCAO')
  const counterTable = tables.find((t) => t.number.toUpperCase() === 'BALCAO') ?? null
  const occupied = realTables.filter((t) => t.status === 'occupied').length
  const reserved = realTables.filter((t) => t.status === 'reserved').length
  const free     = realTables.filter((t) => t.status === 'free').length
  const tableSections = groupTablesBySection(realTables, features, featureAssignments)
  const showSectionHeaders = shouldShowSectionHeaders(features)

  function renderTableCard(table: RestaurantTable) {
    const s = STATUS_CONFIG[table.status] ?? STATUS_CONFIG.free
    const isConfirming = confirmDeleteId === table.id
    const isSelected = selectedIds.has(table.id)

    return (
      <div
        key={table.id}
        className={`relative aspect-square rounded-lg flex flex-col items-center justify-center border transition-all ${s.cardClass} ${isSelected ? 'ring-2 ring-primary' : ''} ${selectMode && table.status !== 'free' ? 'opacity-40' : ''} ${selectMode && table.status === 'free' ? 'cursor-pointer' : ''}`}
        onClick={() => {
          if (isConfirming) return
          if (selectMode) { if (table.status === 'free') toggleSelect(table.id); return }
          if (table.status === 'free') {
            if (!getQrUrl(table)) {
              toast.error('Mesa sem token de QR. Rode a migração de tokens ou recrie a mesa.')
              return
            }
            setQrTable(table)
          } else setManageTable(table)
        }}
      >
        {isConfirming ? (
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
            {!selectMode && table.status === 'free' && (
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
  }

  // ── Reserva de grupo pelo grid (Flow A) ──
  const selectedTables = realTables.filter((t) => selectedIds.has(t.id))
  const selectedSeats = selectedTables.reduce((s, t) => s + (t.capacity ?? 0), 0)

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }
  function exitSelect() { setSelectMode(false); setSelectedIds(new Set()) }

  async function reserveGroup(name: string, partySize: number, whatsapp: string) {
    const ids = [...selectedIds]
    const res = await fetch('/api/dashboard/waitlist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reserveTables', name, partySize, whatsapp, tableIds: ids }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    setTables((prev) => prev.map((t) => ids.includes(t.id) ? { ...t, status: 'reserved' } : t))
    toast.success(`${ids.length} mesa${ids.length !== 1 ? 's' : ''} reservada${ids.length !== 1 ? 's' : ''} para ${name}.`)
    exitSelect()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-primary-container" />
    </div>
  )

  return (
    <>
      <div className="space-y-stack-lg">
        {operationalMode === 'counter' && (
          <div className="rounded-xl border border-primary/30 bg-primary-container/10 px-5 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <span className="material-symbols-outlined text-[22px] text-primary shrink-0">countertops</span>
              <div>
                <p className="text-sm font-semibold text-on-surface">Modo Balcão — pedidos por número</p>
                <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                  Sem mesas físicas. Gere o QR do balcão abaixo, imprima e coloque no balcão/caixa.
                  O cliente escaneia e pede pelo celular.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCounterQr(true)}
              className="shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-container text-on-primary-container font-bold font-mono text-sm rounded-lg hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
              QR do balcão
            </button>
          </div>
        )}
        {/* Header */}
        <div className="flex justify-between items-center gap-3">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}>Mesas</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              {realTables.length} mesas cadastradas
              {maxTables != null && (
                <span className="font-mono text-xs ml-2">
                  · {realTables.length}/{maxTables} ({planName})
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
              className={`flex items-center gap-2 px-4 py-2.5 border text-sm font-bold font-mono rounded-lg transition-colors ${
                selectMode
                  ? 'border-primary text-primary bg-primary-container/20'
                  : 'border-outline-variant text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{selectMode ? 'close' : 'select_all'}</span>
              <span className="hidden sm:inline">{selectMode ? 'Cancelar seleção' : 'Reservar mesas'}</span>
            </button>
            <button
              onClick={() => setShowWaitlist(true)}
              className="flex items-center gap-2 px-4 py-2.5 border border-outline-variant text-on-surface-variant text-sm font-bold font-mono rounded-lg hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">deck</span>
              <span className="hidden sm:inline">Fila de espera</span>
            </button>
            {operationalMode === 'both' && !counterTable && (
              <button
                onClick={() => addTable('counter')}
                disabled={adding}
                className="flex items-center gap-2 px-4 py-2.5 border border-outline-variant text-on-surface-variant text-sm font-bold font-mono rounded-lg hover:text-on-surface transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">countertops</span>
                <span className="hidden sm:inline">Balcão</span>
              </button>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={adding}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-container text-on-primary-container text-sm font-bold font-mono rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="material-symbols-outlined text-[18px]">add</span>}
              <span className="hidden sm:inline">Nova Mesa</span>
            </button>
          </div>
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

        {selectMode && (
          <div className="rounded-xl border border-primary/30 bg-primary-container/10 px-4 py-3 text-xs font-mono text-on-surface-variant">
            <span className="text-primary font-bold">Modo reserva:</span> toque nas mesas livres para selecionar.
            {' '}Depois confirme o grupo na barra inferior.
          </div>
        )}

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

        {!showSectionHeaders && realTables.length > 0 && (
          <p className="text-xs font-mono text-on-surface-variant/70 -mt-2">
            Para separar por seção (Varanda, Salão…), defina a seção ao criar ou editar uma mesa.
          </p>
        )}

        {/* Table grid */}
        {realTables.length === 0 ? (
          <div className="tonal-layer-1 ghost-border rounded-xl p-12 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30 mb-3 block">table_restaurant</span>
            <p className="text-sm font-mono text-on-surface-variant mb-4">Nenhuma mesa cadastrada</p>
            <button onClick={() => setShowCreateModal(true)} className="px-6 py-2 bg-primary-container text-on-primary-container text-sm font-bold font-mono rounded-lg hover:opacity-90 transition-opacity">
              Adicionar primeira mesa
            </button>
          </div>
        ) : (
          <div className="tonal-layer-1 ghost-border rounded-xl p-6 space-y-8">
            {tableSections.map((section, idx) => (
              <div key={section.id} className={idx > 0 && showSectionHeaders ? 'pt-2 border-t border-outline-variant/40' : ''}>
                {showSectionHeaders && (
                  <div className="flex flex-wrap items-baseline gap-2 mb-4">
                    <h3 className="text-sm font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>
                      {section.emoji && <span className="mr-1.5">{section.emoji}</span>}
                      {section.name}
                    </h3>
                    <span className="text-xs font-mono text-on-surface-variant">
                      {section.tables.length} mesa{section.tables.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                  {section.tables.map((table) => renderTableCard(table))}
                </div>
              </div>
            ))}

            {/* Balcão — no modo "both" (counter puro usa o card do topo) */}
            {operationalMode === 'both' && (
              <div className="mt-8 flex justify-center">
                <div className="px-6 py-4 bg-surface-container-highest/30 border border-outline-variant border-dashed rounded-xl flex flex-col items-center gap-3 text-on-surface-variant max-w-sm w-full">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">countertops</span>
                    <span className="text-xs font-mono">Balcão (pedido por número)</span>
                  </div>
                  <button
                    onClick={() => setShowCounterQr(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-container text-on-primary-container font-bold font-mono text-sm rounded-lg hover:opacity-90 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                    QR do balcão
                  </button>
                  <p className="text-[11px] font-mono text-center leading-relaxed">
                    Imprima e coloque no balcão. O cliente escaneia e pede pelo celular — fora do limite de mesas.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR Code Modal — mesas livres */}
      {qrTable && getQrUrl(qrTable) && (
        <TableQrModal
          table={qrTable}
          url={getQrUrl(qrTable)!}
          restaurantName={restaurantName || undefined}
          onClose={() => { setQrTable(null); void loadFeatures() }}
        />
      )}

      {/* QR Code Modal — balcão */}
      {showCounterQr && (
        <CounterQrModal
          url={getCounterUrl()}
          restaurantName={restaurantName || undefined}
          onClose={() => setShowCounterQr(false)}
        />
      )}

      {/* Manage Modal — mesas ocupadas ou reservadas */}
      {manageTable && (
        <TableManageModal
          table={manageTable}
          freeTables={realTables.filter((t) => t.status === 'free')}
          onClose={() => { setManageTable(null); void loadFeatures() }}
          onTableUpdated={handleTableUpdated}
          onTableSwitched={handleTableSwitched}
          onTablesFreed={handleTablesFreed}
        />
      )}

      {showWaitlist && <WaitlistModal onClose={() => setShowWaitlist(false)} />}

      {/* Barra flutuante do modo seleção (Flow A: reservar grupo) */}
      {selectMode && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-[60] md:left-[260px] bg-surface-container border-t border-outline-variant px-4 py-3 flex items-center justify-between gap-3 shadow-2xl">
          <div className="text-sm min-w-0">
            <span className="font-bold text-on-surface">{selectedIds.size} mesa{selectedIds.size !== 1 ? 's' : ''}</span>
            <span className="font-mono text-on-surface-variant"> · {selectedSeats} lugares</span>
            <span className="hidden sm:inline text-xs text-on-surface-variant ml-2">— toque nas mesas livres</span>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={exitSelect} className="px-4 py-2 border border-outline-variant rounded-lg text-sm font-mono text-on-surface-variant hover:text-on-surface">
              Cancelar
            </button>
            <button disabled={selectedIds.size === 0} onClick={() => setShowGroupReserve(true)}
              className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg text-sm font-bold font-mono disabled:opacity-40">
              Reservar grupo
            </button>
          </div>
        </div>
      )}

      {showGroupReserve && (
        <GroupReserveModal
          tables={selectedTables.map((t) => ({ id: t.id, number: t.number, capacity: t.capacity ?? null }))}
          onClose={() => setShowGroupReserve(false)}
          onConfirm={reserveGroup}
        />
      )}

      {showCreateModal && (
        <TableCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(table) => {
            setTables(prev => sortTablesByNumber([...prev.filter(t => t.id !== table.id), table]))
            void loadPlanLimits()
            void loadFeatures()
          }}
          onLimitReached={(data) => {
            setPlanName(data.planName ?? planName)
            setMaxTables(data.maxTables ?? maxTables)
            setUpgradeModalOpen(true)
          }}
        />
      )}

      {maxTables != null && (
        <PlanUpgradeModal
          open={upgradeModalOpen}
          onClose={() => setUpgradeModalOpen(false)}
          planName={planName}
          maxTables={maxTables}
          currentCount={tables.length}
          onUpgraded={async () => {
            await loadPlanLimits()
            await addTable()
          }}
        />
      )}
    </>
  )
}
