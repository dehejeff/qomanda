import type { AnalyticsData } from '@/lib/dashboard-analytics'
import { WEEKDAY_LABELS, METHOD_LABELS } from '@/lib/dashboard-analytics'

function brl(n: number): string {
  return (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function num(n: number): string {
  return (n ?? 0).toFixed(2).replace('.', ',')
}
function hourLabel(h: number | null): string {
  if (h == null) return '—'
  return `${String(h).padStart(2, '0')}h–${String((h + 1) % 24).padStart(2, '0')}h`
}
function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return ''
  const s = String(value)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function row(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvEscape).join(',')
}

/** CSV multi-seção (com BOM p/ Excel) do Analytics. */
export function buildAnalyticsCsv(data: AnalyticsData, periodLabel: string): string {
  const lines: string[] = []
  lines.push(row(['KiComanda — Analytics', periodLabel]))
  lines.push('')

  lines.push(row(['Resumo', 'Valor']))
  lines.push(row(['Faturamento', num(data.revenue)]))
  lines.push(row(['Pedidos', data.orderCount]))
  lines.push(row(['Pagamentos', data.paymentCount]))
  lines.push(row(['Ticket médio', num(data.avgTicket)]))
  lines.push(row(['Ticket médio por mesa', num(data.avgPerTable)]))
  lines.push(row(['Ticket médio por cliente', num(data.avgPerCustomer)]))
  lines.push(row(['Mesas/comandas atendidas', data.tablesServed]))
  lines.push(row(['Clientes atendidos', data.customersServed]))
  lines.push(row(['Horário de pico', hourLabel(data.peakHour)]))
  lines.push(row(['Dia mais forte', data.peakWeekday != null ? WEEKDAY_LABELS[data.peakWeekday] : '—']))
  lines.push('')

  lines.push(row(['Faturamento por dia', 'Faturamento', 'Pedidos']))
  for (const d of data.daily) lines.push(row([d.date, num(d.revenue), d.orders]))
  lines.push('')

  lines.push(row(['Itens mais vendidos', 'Quantidade', 'Receita']))
  for (const it of data.topItems) lines.push(row([it.name, it.quantity, num(it.revenue)]))
  lines.push('')

  lines.push(row(['Métodos de pagamento', 'Qtd', 'Valor']))
  for (const m of data.byMethod) lines.push(row([METHOD_LABELS[m.method] ?? m.method, m.count, num(m.amount)]))
  lines.push('')

  lines.push(row(['Faturamento por hora', 'Faturamento', 'Pedidos']))
  for (const h of data.byHour) lines.push(row([`${String(h.hour).padStart(2, '0')}h`, num(h.revenue), h.orders]))
  lines.push('')

  lines.push(row(['Faturamento por dia da semana', 'Faturamento', 'Pedidos']))
  for (const w of data.byWeekday) lines.push(row([WEEKDAY_LABELS[w.weekday], num(w.revenue), w.orders]))

  return '﻿' + lines.join('\n')
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Relatório HTML imprimível (Ctrl+P → salvar como PDF). */
export function buildAnalyticsHtml(data: AnalyticsData, periodLabel: string, restaurantName: string): string {
  const kpis: [string, string][] = [
    ['Faturamento', brl(data.revenue)],
    ['Pedidos', String(data.orderCount)],
    ['Pagamentos', String(data.paymentCount)],
    ['Ticket médio', brl(data.avgTicket)],
    ['Ticket médio / mesa', brl(data.avgPerTable)],
    ['Ticket médio / cliente', brl(data.avgPerCustomer)],
    ['Horário de pico', hourLabel(data.peakHour)],
    ['Dia mais forte', data.peakWeekday != null ? WEEKDAY_LABELS[data.peakWeekday] : '—'],
  ]
  const kpiHtml = kpis.map(([l, v]) => `<div class="kpi"><span class="kl">${esc(l)}</span><span class="kv">${esc(v)}</span></div>`).join('')

  const topItemsHtml = data.topItems.length
    ? data.topItems.map(it => `<tr><td>${esc(it.name)}</td><td class="r">${it.quantity}</td><td class="r">${brl(it.revenue)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="muted">Sem itens no período.</td></tr>'

  const methodHtml = data.byMethod.length
    ? data.byMethod.map(m => `<tr><td>${esc(METHOD_LABELS[m.method] ?? m.method)}</td><td class="r">${m.count}</td><td class="r">${brl(m.amount)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="muted">Sem pagamentos.</td></tr>'

  const weekdayHtml = data.byWeekday.map(w => `<tr><td>${WEEKDAY_LABELS[w.weekday]}</td><td class="r">${brl(w.revenue)}</td><td class="r">${w.orders}</td></tr>`).join('')

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Analytics — ${esc(restaurantName)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 32px; }
  h1 { font-size: 22px; margin: 0; }
  .sub { color: #666; font-size: 13px; margin: 4px 0 24px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
  .kpi { border: 1px solid #e5e5e5; border-radius: 10px; padding: 12px; }
  .kl { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #888; }
  .kv { display: block; font-size: 18px; font-weight: 800; margin-top: 4px; }
  h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 2px solid #f97316; padding-bottom: 4px; display: inline-block; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
  th { font-size: 10px; text-transform: uppercase; color: #888; }
  td.r, th.r { text-align: right; }
  .muted { color: #999; text-align: center; padding: 16px; }
  .foot { margin-top: 32px; color: #aaa; font-size: 11px; }
  @media print { body { padding: 0; } .noprint { display: none; } }
</style></head><body>
  <h1>Analytics — ${esc(restaurantName)}</h1>
  <p class="sub">${esc(periodLabel)} · gerado em ${new Date().toLocaleString('pt-BR')}</p>
  <button class="noprint" onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;border:0;border-radius:8px;background:#f97316;color:#fff;font-weight:700;cursor:pointer">Imprimir / Salvar PDF</button>
  <div class="kpis">${kpiHtml}</div>

  <h2>Itens mais vendidos</h2>
  <table><thead><tr><th>Item</th><th class="r">Qtd</th><th class="r">Receita</th></tr></thead><tbody>${topItemsHtml}</tbody></table>

  <h2>Métodos de pagamento</h2>
  <table><thead><tr><th>Método</th><th class="r">Qtd</th><th class="r">Valor</th></tr></thead><tbody>${methodHtml}</tbody></table>

  <h2>Faturamento por dia da semana</h2>
  <table><thead><tr><th>Dia</th><th class="r">Faturamento</th><th class="r">Pedidos</th></tr></thead><tbody>${weekdayHtml}</tbody></table>

  <p class="foot">KiComanda · relatório operacional</p>
</body></html>`
}
