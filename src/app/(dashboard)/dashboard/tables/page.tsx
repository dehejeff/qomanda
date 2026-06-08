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
import { buildTableCheckInUrl } from '@/lib/table-checkin-url'
import { PlanUpgradeModal } from '@/components/dashboard/plan-upgrade-modal'
import { nextTableNumber, sortTablesByNumber } from '@/lib/sort-tables'

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
    let ch: ReturnType<typeof supabase.channel> | undefined

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: r } = await supabase.from('restaurants').select('id, slug, name, operational_mode').eq('owner_id', user.id).single()
      if (!r) return

      setRestaurantSlug(r.slug)
      setRestaurantName(r.name ?? '')
      setRestaurantId(r.id)
      setOperationalMode((r.operational_mode as 'dine_in' | 'counter' | 'both') ?? 'both')
      const { data } = await supabase.from('tables').select('*').eq('restaurant_id', r.id).is('archived_at', null).order('number')
      setTables(sortTablesByNumber((data ?? []) as RestaurantTable[]))
      setLoading(false)
      void loadPlanLimits()

      ch = supabase.channel('tables-status')
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
    return () => { if (ch) supabase.removeChannel(ch) }
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

  // Balcão é uma "mesa" especial (number=BALCAO) — não entra no grid/contagem de mesas.
  const realTables = tables.filter((t) => t.number.toUpperCase() !== 'BALCAO')
  const counterTable = tables.find((t) => t.number.toUpperCase() === 'BALCAO') ?? null
  const occupied = realTables.filter((t) => t.status === 'occupied').length
  const reserved = realTables.filter((t) => t.status === 'reserved').length
  const free     = realTables.filter((t) => t.status === 'free').length

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
              onClick={() => addTable('table')}
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
        {realTables.length === 0 ? (
          <div className="tonal-layer-1 ghost-border rounded-xl p-12 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30 mb-3 block">table_restaurant</span>
            <p className="text-sm font-mono text-on-surface-variant mb-4">Nenhuma mesa cadastrada</p>
            <button onClick={() => addTable('table')} className="px-6 py-2 bg-primary-container text-on-primary-container text-sm font-bold font-mono rounded-lg hover:opacity-90 transition-opacity">
              Adicionar primeira mesa
            </button>
          </div>
        ) : (
          <div className="tonal-layer-1 ghost-border rounded-xl p-6">
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {realTables.map((table) => {
                const s = STATUS_CONFIG[table.status] ?? STATUS_CONFIG.free
                const isConfirming = confirmDeleteId === table.id

                return (
                  <div
                    key={table.id}
                    className={`relative aspect-square rounded-lg flex flex-col items-center justify-center border transition-all ${s.cardClass}`}
                    onClick={() => {
                      if (isConfirming) return
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
          onClose={() => setQrTable(null)}
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
          onClose={() => setManageTable(null)}
          onTableUpdated={handleTableUpdated}
          onTableSwitched={handleTableSwitched}
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
