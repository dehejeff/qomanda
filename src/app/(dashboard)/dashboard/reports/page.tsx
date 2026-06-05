'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEV_BYPASS } from '@/lib/dev-mock'
import { formatCurrency } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PERIOD_OPTIONS, resolvePeriodRange, type ReportPeriod } from '@/lib/dashboard-reports'
import {
  fetchAnalyticsData,
  WEEKDAY_LABELS,
  METHOD_LABELS,
  type AnalyticsData,
} from '@/lib/dashboard-analytics'

const EMPTY: AnalyticsData = {
  revenue: 0, orderCount: 0, paymentCount: 0, avgTicket: 0, daily: [],
  topItems: [], byHour: [], byWeekday: [], byMethod: [], peakHour: null, peakWeekday: null,
  avgPerTable: 0, avgPerCustomer: 0, tablesServed: 0, customersServed: 0,
}

function buildMockData(period: ReportPeriod): AnalyticsData {
  const range = resolvePeriodRange(period)
  const daily: AnalyticsData['daily'] = []
  const cursor = new Date(range.start)
  let revenue = 0, orderCount = 0
  while (cursor < range.end) {
    const r = Math.round((80 + Math.random() * 420) * 100) / 100
    const o = Math.floor(2 + Math.random() * 12)
    daily.push({ date: cursor.toLocaleDateString('en-CA'), revenue: r, orders: o })
    revenue += r; orderCount += o
    cursor.setDate(cursor.getDate() + 1)
  }
  const paymentCount = Math.max(1, Math.floor(orderCount * 0.6))
  const byHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    revenue: hour >= 11 && hour <= 22 ? Math.round(Math.random() * 600) : Math.round(Math.random() * 60),
    orders: hour >= 11 && hour <= 22 ? Math.floor(Math.random() * 14) : Math.floor(Math.random() * 2),
  }))
  const byWeekday = Array.from({ length: 7 }, (_, weekday) => ({ weekday, revenue: Math.round(Math.random() * 2000), orders: Math.floor(Math.random() * 40) }))
  const names = ['Picanha na brasa', 'Chopp 500ml', 'Moqueca de peixe', 'Batata frita', 'Pudim', 'Caipirinha', 'Risoto de camarão', 'Refrigerante']
  const topItems = names.map((name, i) => ({ name, quantity: 60 - i * 6, revenue: (60 - i * 6) * (15 + i * 4) }))
  const byMethod = [
    { method: 'pix', count: Math.floor(paymentCount * 0.5), amount: revenue * 0.5 },
    { method: 'credit', count: Math.floor(paymentCount * 0.3), amount: revenue * 0.3 },
    { method: 'cash', count: Math.floor(paymentCount * 0.15), amount: revenue * 0.15 },
    { method: 'debit', count: Math.floor(paymentCount * 0.05), amount: revenue * 0.05 },
  ]
  const peakHour = byHour.reduce((b, h) => (h.revenue > byHour[b].revenue ? h.hour : b), 0)
  const peakWeekday = byWeekday.reduce((b, w) => (w.revenue > byWeekday[b].revenue ? w.weekday : b), 0)
  const tablesServed = Math.max(1, Math.floor(paymentCount * 0.7))
  const customersServed = Math.max(1, Math.floor(paymentCount * 0.9))
  return {
    revenue, orderCount, paymentCount, avgTicket: revenue / paymentCount, daily, topItems, byHour, byWeekday, byMethod, peakHour, peakWeekday,
    tablesServed, customersServed, avgPerTable: revenue / tablesServed, avgPerCustomer: revenue / customersServed,
  }
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>('week')
  const [data, setData] = useState<AnalyticsData>(EMPTY)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (p: ReportPeriod) => {
    setLoading(true)
    try {
      if (DEV_BYPASS) { setData(buildMockData(p)); return }
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setData(EMPTY); return }
      const { data: restaurant } = await supabase.from('restaurants').select('id').eq('owner_id', user.id).single()
      if (!restaurant) { setData(EMPTY); return }
      setData(await fetchAnalyticsData(supabase, restaurant.id, p))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(period).catch(() => { toast.error('Erro ao carregar relatórios.'); setLoading(false) })
  }, [period, load])

  const range = useMemo(() => resolvePeriodRange(period), [period])
  const maxRevenue = useMemo(() => Math.max(...data.daily.map(d => d.revenue), 1), [data.daily])
  const maxHour = useMemo(() => Math.max(...data.byHour.map(h => h.revenue), 1), [data.byHour])
  const maxWeekday = useMemo(() => Math.max(...data.byWeekday.map(w => w.revenue), 1), [data.byWeekday])
  const maxItemQty = useMemo(() => Math.max(...data.topItems.map(i => i.quantity), 1), [data.topItems])
  const methodTotal = useMemo(() => data.byMethod.reduce((a, m) => a + m.amount, 0), [data.byMethod])
  const hasActivity = data.revenue > 0 || data.orderCount > 0

  return (
    <div className="space-y-stack-lg">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}>
            Analytics
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Vendas, itens, horários de pico e métodos de pagamento · {range.label}
          </p>
        </div>
        {hasActivity && (
          <div className="flex gap-2">
            <a
              href={`/api/dashboard/reports/export?period=${period}&format=csv`}
              className="h-9 px-3 rounded-lg text-xs font-mono border border-outline-variant text-on-surface-variant hover:text-on-surface flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              CSV
            </a>
            <a
              href={`/api/dashboard/reports/export?period=${period}&format=html`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 rounded-lg text-xs font-mono border border-outline-variant text-on-surface-variant hover:text-on-surface flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              Imprimir / PDF
            </a>
          </div>
        )}
      </div>

      <div className="flex gap-1 p-1 rounded-xl w-fit bg-surface-container-low border border-outline-variant overflow-x-auto">
        {PERIOD_OPTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPeriod(id)}
            className={`px-4 py-2 rounded-lg text-xs font-mono whitespace-nowrap transition-all ${
              period === id ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary-container" /></div>
      ) : !hasActivity ? (
        <div className="tonal-layer-1 ghost-border rounded-xl py-20 text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30 mb-3 block">insights</span>
          <p className="text-sm font-mono text-on-surface-variant">Nenhuma atividade neste período.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
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

          {/* Ticket médio por mesa e por cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-card-gap">
            <InsightCard
              icon="table_restaurant"
              label="Ticket médio por mesa"
              value={formatCurrency(data.avgPerTable)}
              hint={`${data.tablesServed} ${data.tablesServed === 1 ? 'mesa/comanda' : 'mesas/comandas'} no período`}
            />
            <InsightCard
              icon="person"
              label="Ticket médio por cliente"
              value={formatCurrency(data.avgPerCustomer)}
              hint={`${data.customersServed} ${data.customersServed === 1 ? 'cliente' : 'clientes'} identificados`}
            />
          </div>

          {/* Insights de pico */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-card-gap">
            <InsightCard
              icon="schedule"
              label="Horário de pico"
              value={data.peakHour != null ? `${String(data.peakHour).padStart(2, '0')}h–${String((data.peakHour + 1) % 24).padStart(2, '0')}h` : '—'}
              hint="Maior faturamento por faixa de hora"
            />
            <InsightCard
              icon="event"
              label="Dia mais forte"
              value={data.peakWeekday != null ? WEEKDAY_LABELS[data.peakWeekday] : '—'}
              hint="Dia da semana com maior faturamento"
            />
          </div>

          {/* Faturamento por dia */}
          <Card title="Faturamento por dia" badge={`${data.daily.length} ${data.daily.length === 1 ? 'dia' : 'dias'}`}>
            <div className="flex items-stretch gap-2 h-56 overflow-x-auto">
              {data.daily.map(d => {
                const heightPct = d.revenue > 0 ? Math.max((d.revenue / maxRevenue) * 100, 4) : 0
                const dayLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                return (
                  <div key={d.date} className="flex-1 min-w-[32px] h-full flex flex-col items-center gap-2 group">
                    <span className="text-[10px] font-mono text-on-surface-variant h-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      {d.revenue > 0 ? formatCurrency(d.revenue) : ''}
                    </span>
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className="w-full bg-primary-container/50 group-hover:bg-primary-container rounded-t-md transition-all"
                        style={{ height: `${heightPct}%` }}
                        title={`${dayLabel}: ${formatCurrency(d.revenue)} · ${d.orders} ${d.orders === 1 ? 'pedido' : 'pedidos'}`}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-on-surface-variant whitespace-nowrap">{dayLabel}</span>
                  </div>
                )
              })}
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-card-gap">
            {/* Itens mais vendidos */}
            <Card title="Itens mais vendidos">
              {data.topItems.length === 0 ? (
                <EmptyMini label="Sem itens no período." />
              ) : (
                <ul className="space-y-3">
                  {data.topItems.map((it, i) => (
                    <li key={it.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-on-surface truncate flex items-center gap-2">
                          <span className="text-[10px] font-mono text-on-surface-variant w-4">{i + 1}.</span>
                          {it.name}
                        </span>
                        <span className="font-mono text-on-surface-variant shrink-0 ml-2">
                          {it.quantity}× · {formatCurrency(it.revenue)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-container-low overflow-hidden">
                        <div className="h-full rounded-full bg-primary-container" style={{ width: `${(it.quantity / maxItemQty) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Métodos de pagamento */}
            <Card title="Métodos de pagamento">
              {data.byMethod.length === 0 ? (
                <EmptyMini label="Sem pagamentos no período." />
              ) : (
                <ul className="space-y-3">
                  {data.byMethod.map(m => {
                    const pct = methodTotal > 0 ? (m.amount / methodTotal) * 100 : 0
                    return (
                      <li key={m.method} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-on-surface">{METHOD_LABELS[m.method] ?? m.method}</span>
                          <span className="font-mono text-on-surface-variant">
                            {pct.toFixed(0)}% · {formatCurrency(m.amount)} · {m.count}×
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-container-low overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </div>

          {/* Horários de pico */}
          <Card title="Faturamento por hora" badge="fuso de Brasília">
            <div className="flex items-stretch gap-[3px] h-40">
              {data.byHour.map(h => {
                const heightPct = h.revenue > 0 ? Math.max((h.revenue / maxHour) * 100, 3) : 0
                const isPeak = h.hour === data.peakHour
                return (
                  <div key={h.hour} className="flex-1 h-full flex flex-col items-center gap-1 group">
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className={`w-full rounded-t-sm transition-all ${isPeak ? 'bg-primary' : 'bg-primary-container/40 group-hover:bg-primary-container'}`}
                        style={{ height: `${heightPct}%` }}
                        title={`${String(h.hour).padStart(2, '0')}h: ${formatCurrency(h.revenue)} · ${h.orders} ${h.orders === 1 ? 'pedido' : 'pedidos'}`}
                      />
                    </div>
                    {h.hour % 3 === 0 && <span className="text-[8px] font-mono text-on-surface-variant">{h.hour}h</span>}
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Dias da semana */}
          <Card title="Faturamento por dia da semana">
            <div className="flex items-stretch gap-2 h-40">
              {data.byWeekday.map(w => {
                const heightPct = w.revenue > 0 ? Math.max((w.revenue / maxWeekday) * 100, 3) : 0
                const isPeak = w.weekday === data.peakWeekday
                return (
                  <div key={w.weekday} className="flex-1 h-full flex flex-col items-center gap-1.5 group">
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className={`w-full rounded-t-md transition-all ${isPeak ? 'bg-primary' : 'bg-primary-container/40 group-hover:bg-primary-container'}`}
                        style={{ height: `${heightPct}%` }}
                        title={`${WEEKDAY_LABELS[w.weekday]}: ${formatCurrency(w.revenue)} · ${w.orders} ${w.orders === 1 ? 'pedido' : 'pedidos'}`}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-on-surface-variant">{WEEKDAY_LABELS[w.weekday]}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function Card({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="tonal-layer-1 ghost-border rounded-xl p-stack-lg">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>{title}</h3>
        {badge && <span className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">{badge}</span>}
      </div>
      {children}
    </div>
  )
}

function InsightCard({ icon, label, value, hint }: { icon: string; label: string; value: string; hint: string }) {
  return (
    <div className="tonal-layer-1 ghost-border rounded-xl p-4 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl bg-primary-container/20 flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-primary-container">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">{label}</p>
        <p className="text-xl font-black font-mono text-on-surface mt-0.5">{value}</p>
        <p className="text-[11px] text-on-surface-variant mt-0.5 truncate">{hint}</p>
      </div>
    </div>
  )
}

function EmptyMini({ label }: { label: string }) {
  return <p className="text-sm font-mono text-on-surface-variant py-8 text-center">{label}</p>
}
