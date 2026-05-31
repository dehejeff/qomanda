'use client'

import { useEffect, useState } from 'react'
import type { RestaurantTable } from '@/types'
import { TableQrModal } from '@/components/dashboard/table-qr-modal'
import { TableManageModal } from '@/components/dashboard/table-manage-modal'
import { sortTablesByNumber } from '@/lib/sort-tables'

type Props = {
  tables: RestaurantTable[]
  restaurantSlug: string
  restaurantId?: string
}

export function OverviewFloorMap({ tables, restaurantSlug, restaurantId }: Props) {
  const [qrTable, setQrTable] = useState<RestaurantTable | null>(null)
  const [manageTable, setManageTable] = useState<RestaurantTable | null>(null)
  const [localTables, setLocalTables] = useState(tables)

  useEffect(() => {
    setLocalTables(sortTablesByNumber(tables))
  }, [tables])

  function handleTableClick(table: RestaurantTable) {
    if (table.status === 'free') setQrTable(table)
    else setManageTable(table)
  }

  function handleTableUpdated(tableId: string, status: RestaurantTable['status']) {
    setLocalTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, status } : t)))
    setManageTable((prev) => (prev?.id === tableId ? { ...prev, status } : prev))
  }

  function handleTableSwitched(fromId: string, toId: string) {
    setLocalTables((prev) =>
      prev.map((t) => {
        if (t.id === fromId) return { ...t, status: 'free' as const }
        if (t.id === toId) return { ...t, status: 'occupied' as const }
        return t
      }),
    )
  }

  const freeTables = localTables.filter((t) => t.status === 'free')

  return (
    <>
      <div className="tonal-layer-1 ghost-border rounded-xl p-6">
        {localTables.length === 0 ? (
          <p className="text-center text-on-surface-variant text-sm py-8 font-mono">Nenhuma mesa cadastrada</p>
        ) : (
          <div className="grid grid-cols-5 sm:grid-cols-6 gap-3">
            {localTables.map((t) => {
              const occupied = t.status === 'occupied'
              const reserved = t.status === 'reserved'
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTableClick(t)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center border transition-colors cursor-pointer ${
                    occupied
                      ? 'bg-primary-container border-primary/20 shadow-lg'
                      : reserved
                      ? 'bg-surface-container-highest/50 border-outline-variant opacity-60'
                      : 'border-outline-variant hover:border-primary'
                  }`}
                >
                  <span className={`text-xs font-bold font-mono ${occupied ? 'text-on-primary-container' : 'text-on-surface-variant'}`}>
                    T-{t.number.padStart(2, '0')}
                  </span>
                  {occupied && <span className="material-symbols-outlined text-on-primary-container text-sm">person</span>}
                  {reserved && <span className="material-symbols-outlined text-on-surface-variant text-sm">event_busy</span>}
                </button>
              )
            })}
          </div>
        )}
        <div className="mt-6 flex justify-center">
          <div className="px-8 py-3 bg-surface-container-highest/30 border border-outline-variant border-dashed rounded-xl flex items-center gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-sm">countertops</span>
            <span className="text-xs font-mono">Área do Balcão e Cozinha</span>
          </div>
        </div>
      </div>

      {qrTable && (
        <TableQrModal
          table={qrTable}
          url={`${typeof window !== 'undefined' ? window.location.origin : ''}/${restaurantSlug}?mesa=${qrTable.number}`}
          onClose={() => setQrTable(null)}
        />
      )}

      {manageTable && (
        <TableManageModal
          table={manageTable}
          freeTables={freeTables.filter((t) => t.id !== manageTable.id)}
          onClose={() => setManageTable(null)}
          onTableUpdated={handleTableUpdated}
          onTableSwitched={handleTableSwitched}
        />
      )}
    </>
  )
}
