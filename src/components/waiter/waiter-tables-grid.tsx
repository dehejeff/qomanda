'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resolveWaiterRestaurantId } from '@/lib/waiter-restaurant-id'
import { tableStatus } from '@/lib/design-tokens'
import { WaiterTableSheet } from './waiter-table-sheet'

type TableRow = { id: string; number: string; status: keyof typeof tableStatus | 'closing' }

const MOBILE_TABLE_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  free: { bg: '#161B22', border: 'rgba(88,66,55,0.4)', text: '#8B949E' },
  occupied: { bg: 'rgba(0,230,118,0.12)', border: 'rgba(0,230,118,0.35)', text: '#00E676' },
  reserved: { bg: '#21262D', border: 'rgba(88,66,55,0.3)', text: '#30363D' },
  closing: { bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.35)', text: '#fca5a5' },
}

async function fetchTables(): Promise<TableRow[]> {
  const res = await fetch('/api/dashboard/waiter/tables')
  if (res.ok) {
    const json = await res.json() as { tables?: TableRow[] }
    if (json.tables?.length) return json.tables
  }

  const supabase = createClient()
  const restaurantId = await resolveWaiterRestaurantId(supabase)
  if (!restaurantId) return []

  const { data: tableRows } = await supabase
    .from('tables')
    .select('id, number, status')
    .eq('restaurant_id', restaurantId)
    .neq('number', 'BALCAO')
    .order('number')

  const { data: closingSessions } = await supabase
    .from('sessions')
    .select('table_id')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'closing')

  const closingIds = new Set((closingSessions ?? []).map(s => s.table_id))

  return (tableRows ?? []).map(t => ({
    ...t,
    status: (closingIds.has(t.id) ? 'closing' : t.status) as TableRow['status'],
  }))
}

export function WaiterTablesGrid() {
  const [tables, setTables] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setTables(await fetchTables())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    const ch = supabase
      .channel('garcom-tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => load())
      .subscribe()
    // Poll de 20s como fallback caso realtime não esteja na publication
    const poll = setInterval(() => { void load() }, 20_000)
    return () => { supabase.removeChannel(ch); clearInterval(poll) }
  }, [load])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: '#00E676' }} />
      </div>
    )
  }

  const occupied = tables.filter(t => t.status === 'occupied' || t.status === 'closing').length

  return (
    <>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-black" style={{ letterSpacing: '-0.02em' }}>Mesas</h1>
          <p className="text-sm mt-1 font-mono" style={{ color: '#8B949E' }}>
            Toque para detalhes · encerrar ou ver fidelidade · {occupied} ocupada{occupied !== 1 ? 's' : ''}
          </p>
        </div>

        {tables.length === 0 ? (
          <div className="rounded-2xl py-14 text-center" style={{ background: '#161B22', border: '1px solid rgba(88,66,55,0.4)' }}>
            <p className="text-sm font-mono" style={{ color: '#8B949E' }}>Nenhuma mesa cadastrada</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {tables.map(t => {
              const isClosing = t.status === 'closing'
              const status = isClosing ? 'closing' : ((t.status in tableStatus ? t.status : 'free') as keyof typeof tableStatus)
              const meta = isClosing ? { legend: 'Fechando', icon: 'hourglass_top' } : tableStatus[status as keyof typeof tableStatus]
              const style = MOBILE_TABLE_STYLE[status] ?? MOBILE_TABLE_STYLE.free

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTableId(t.id)}
                  className="rounded-2xl p-3 text-center aspect-square flex flex-col items-center justify-center active:scale-95 transition-transform"
                  style={{ background: style.bg, border: `1px solid ${style.border}` }}
                >
                  {meta.icon && (
                    <span className="material-symbols-outlined text-[18px] mb-0.5" style={{ color: style.text }}>{meta.icon}</span>
                  )}
                  <p className="text-2xl font-black font-mono" style={{ color: status === 'occupied' || isClosing ? '#00E676' : '#FFFFFF' }}>{t.number}</p>
                  <p className="text-[9px] font-mono uppercase tracking-wider mt-1" style={{ color: style.text }}>{meta.legend}</p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selectedTableId && (
        <WaiterTableSheet tableId={selectedTableId} onClose={() => setSelectedTableId(null)} onUpdated={load} />
      )}
    </>
  )
}
