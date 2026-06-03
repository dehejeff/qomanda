import type { FinancialAuditEventDto } from '@/lib/financial-audit'

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function brl(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR')
}

export function buildAuditCsv(
  restaurantName: string,
  events: FinancialAuditEventDto[],
  filters: { from?: string; to?: string; confirmationCode?: string },
): string {
  const header = [
    `# Auditoria financeira — ${restaurantName}`,
    `# Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    filters.from ? `# De: ${filters.from}` : '',
    filters.to ? `# Até: ${filters.to}` : '',
    filters.confirmationCode ? `# Código: ${filters.confirmationCode}` : '',
    '',
    [
      'data',
      'evento',
      'entidade',
      'entity_id',
      'status_anterior',
      'status_novo',
      'valor',
      'metodo',
      'codigo_confirmacao',
      'session_id',
      'customer_id',
      'integrity_hash',
    ].join(','),
  ]
    .filter(Boolean)
    .join('\n')

  const rows = events.map(e =>
    [
      csvEscape(formatDateTime(e.createdAt)),
      csvEscape(e.eventLabel),
      csvEscape(e.entityType),
      csvEscape(e.entityId),
      csvEscape(e.previousStatus),
      csvEscape(e.newStatus),
      csvEscape(e.amount),
      csvEscape(e.method),
      csvEscape(e.confirmationCode),
      csvEscape(e.sessionId),
      csvEscape(e.customerId),
      csvEscape(e.integrityHash),
    ].join(','),
  )

  return `${header}\n${rows.join('\n')}\n`
}

export function buildAuditHtmlReport(input: {
  restaurantName: string
  restaurantSlug: string
  events: FinancialAuditEventDto[]
  monthlyStats: Array<{
    periodLabel: string
    revenueTotal: number
    gmvDigital: number
    paymentCount: number
  }>
  retentionDays: number
  filters: { from?: string; to?: string; confirmationCode?: string }
}): string {
  const { restaurantName, events, monthlyStats, retentionDays, filters } = input
  const filterLine = [
    filters.from && `De ${filters.from}`,
    filters.to && `Até ${filters.to}`,
    filters.confirmationCode && `Código ${filters.confirmationCode}`,
  ]
    .filter(Boolean)
    .join(' · ')

  const eventRows = events
    .map(
      e => `<tr>
        <td>${formatDateTime(e.createdAt)}</td>
        <td>${e.eventLabel}</td>
        <td>${e.entityType}</td>
        <td class="mono">${e.entityId.slice(0, 8)}…</td>
        <td>${e.previousStatus ?? '—'} → ${e.newStatus ?? '—'}</td>
        <td>${brl(e.amount)}</td>
        <td>${e.method ?? '—'}</td>
        <td class="mono">${e.confirmationCode ?? '—'}</td>
        <td class="mono hash" title="${e.integrityHash}">${e.integrityHash.slice(0, 16)}…</td>
      </tr>`,
    )
    .join('')

  const statsRows = monthlyStats
    .map(
      s => `<tr>
        <td>${s.periodLabel}</td>
        <td>${brl(s.revenueTotal)}</td>
        <td>${brl(s.gmvDigital)}</td>
        <td>${s.paymentCount}</td>
      </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Auditoria — ${restaurantName}</title>
  <style>
    body { font-family: system-ui, sans-serif; font-size: 12px; color: #111; margin: 24px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { color: #555; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    th { background: #f4f4f4; font-size: 10px; text-transform: uppercase; }
    .mono { font-family: ui-monospace, monospace; font-size: 10px; }
    .hash { max-width: 120px; overflow: hidden; }
    @media print {
      body { margin: 12px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;cursor:pointer">
    Imprimir / Salvar como PDF
  </button>
  <h1>Auditoria financeira — ${restaurantName}</h1>
  <p class="meta">
    Gerado em ${new Date().toLocaleString('pt-BR')}
    ${filterLine ? ` · ${filterLine}` : ''}
    · Retenção de detalhes: ${retentionDays} dias · Totais mensais abaixo são permanentes
  </p>

  <h2>Histórico mensal (permanente)</h2>
  <table>
    <thead><tr><th>Período</th><th>Receita</th><th>GMV digital</th><th>Pagamentos</th></tr></thead>
    <tbody>${statsRows || '<tr><td colspan="4">Sem agregados ainda</td></tr>'}</tbody>
  </table>

  <h2>Eventos de auditoria (${events.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Data</th><th>Evento</th><th>Entidade</th><th>ID</th><th>Status</th>
        <th>Valor</th><th>Método</th><th>Cód.</th><th>Hash</th>
      </tr>
    </thead>
    <tbody>${eventRows || '<tr><td colspan="9">Nenhum evento no período</td></tr>'}</tbody>
  </table>
</body>
</html>`
}
