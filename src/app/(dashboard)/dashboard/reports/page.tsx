'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEV_BYPASS } from '@/lib/dev-mock'
import { formatCurrency } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  PERIOD_OPTIONS,
  fetchReportData,
  resolvePeriodRange,
  type ReportPeriod,
  type ReportData,
} from '@/lib/dashboard-reports'

const EMPTY: ReportData = { revenue: 0, orderCount: 0, paymentCount: 0, avgTicket: 0, daily: [] }

function buildMockData(period: ReportPeriod): ReportData {
  const range = resolvePeriodRange(period)
  const daily: ReportData['daily'] = []
  const cursor = new Date(range.start)
  let revenue = 0
  let orderCount = 0
  while (cursor < range.end) {
    const r = Math.round((80 + Math.random() * 420) * 100) / 100
    const o = Math.floor(2 + Math.random() * 12)
    daily.push({ date: cursor.toLocaleDateString('en-CA'), revenue: r, orders: o })
    revenue += r
    orderCount += o
    cursor.setDate(cursor.getDate() + 1)
  }
  const paymentCount = Math.max(1, Math.floor(orderCount * 0.6))
  return { revenue, orderCount, paymentCount, avgTicket: revenue / paymentCount, daily }
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>('week')
  const [data, setData] = useState<ReportData>(EMPTY)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (p: ReportPeriod) => {
    setLoading(true)
    try {
      if (DEV_BYPASS) {
        setData(buildMockData(p))
        return
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setData(EMPTY); return }

      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!restaurant) { setData(EMPTY); return }

      setData(await fetchReportData(supabase, restaurant.id, p))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(period).catch(() => {
      toast.error('Erro ao carregar relatórios.')
      setLoading(false)
    })
  }, [period, load])

  const range = useMemo(() => resolvePeriodRange(period), [period])
  const maxRevenue = useMemo(() => Math.max(...data.daily.map(d => d.revenue), 1), [data.daily])
  const hasActivity = data.revenue > 0 || data.orderCount > 0

  return (
    <div className="space-y-stack-lg">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}>
            Relatórios
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Faturamento e pedidos consolidados · {range.label}
          </p>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-1 p-1 rounded-xl w-fit bg-surface-container-low border border-outline-variant overflow-x-auto">
        {PERIOD_OPTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPeriod(id)}
            className={`px-4 py-2 rounded-lg text-xs font-mono whitespace-nowrap transition-all ${
              period === id
                ? 'bg-primary-container text-on-primary-container'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary-container" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-card-gap">
            {[
              { label: 'Faturamento', value: formatCurrency(data.revenue), color: 'text-emerald-400' },
              { label: 'Pedidos', value: String(data.orderCount), color: 'text-on-surface' },
              { label: 'Pagamentos', value: String(data.paymentCount), color: 'text-primary' },
              { label: 'Ticket médio', value: formatCurrency(data.avgTicket), color: 'text-on-surface' },
            ].map(({ label, value, color }) => (
              <div key={label} className="tonal-layer-1 ghost-border rounded-xl p-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">{label}</p>
                <p className={`text-2xl font-black mt-1 font-mono ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Daily revenue chart */}
          <div className="tonal-layer-1 ghost-border rounded-xl p-stack-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>
                Faturamento por dia
              </h3>
              <span className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
                {data.daily.length} {data.daily.length === 1 ? 'dia' : 'dias'}
              </span>
            </div>

            {!hasActivity ? (
              <div className="py-16 text-center">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30 mb-3 block">bar_chart</span>
                <p className="text-sm font-mono text-on-surface-variant">Nenhuma atividade neste período.</p>
              </div>
            ) : (
              <div className="flex items-end gap-1.5 h-48 overflow-x-auto">
                {data.daily.map((d) => {
                  const heightPct = Math.round((d.revenue / maxRevenue) * 100)
                  const dayLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                  return (
                    <div key={d.date} className="flex-1 min-w-[28px] flex flex-col items-center gap-2 group">
                      <div className="relative w-full flex-1 flex items-end">
                        <div
                          className="w-full bg-primary-container/40 group-hover:bg-primary-container rounded-t transition-all"
                          style={{ height: `${Math.max(heightPct, 2)}%` }}
                          title={`${dayLabel}: ${formatCurrency(d.revenue)} · ${d.orders} pedidos`}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-on-surface-variant whitespace-nowrap">{dayLabel}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
