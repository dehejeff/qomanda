import { FINANCIAL_RETENTION_DAYS } from '@/lib/financial-retention'

/** Dias antes da exclusão em que o restaurante é avisado (e-mail + painel). */
export const NFE_RETENTION_REMINDER_DAYS = [20, 15, 5] as const

export type NfeRetentionReminderDay = (typeof NFE_RETENTION_REMINDER_DAYS)[number]

export function nfeAgeDaysForReminder(daysBefore: NfeRetentionReminderDay): number {
  return FINANCIAL_RETENTION_DAYS - daysBefore
}

export function formatPurgeDate(daysBefore: NfeRetentionReminderDay, from = new Date()): string {
  const purge = new Date(from)
  purge.setDate(purge.getDate() + daysBefore)
  return purge.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function buildNfeRetentionNotification(
  daysBefore: NfeRetentionReminderDay,
  nfeCount: number,
  purgeOn: string,
): { title: string; body: string; link: string } {
  const plural = nfeCount !== 1
  const title =
    daysBefore === 5
      ? `Último aviso: NF-e em ${daysBefore} dias`
      : `NF-e serão removidas em ${daysBefore} dias`

  const body =
    `${nfeCount} nota${plural ? 's' : ''} fiscal${plural ? 'is' : ''} ` +
    `será${plural ? 'ão' : ''} excluída${plural ? 's' : ''} da base Qomanda em ${daysBefore} dias ` +
    `(previsão: ${purgeOn}). Baixe e arquive os PDFs em Configurações → NF-e para sua guarda fiscal.`

  return {
    title,
    body,
    link: '/dashboard/settings?tab=notas#nfe-notas',
  }
}

export function buildNfeRetentionEmailHtml(input: {
  restaurantName: string
  ownerName: string
  daysBefore: NfeRetentionReminderDay
  nfeCount: number
  purgeOn: string
  settingsUrl: string
}): string {
  const { restaurantName, ownerName, daysBefore, nfeCount, purgeOn, settingsUrl } = input
  const plural = nfeCount !== 1
  const urgency =
    daysBefore === 5
      ? 'Este é o último aviso antes da exclusão automática.'
      : daysBefore === 15
        ? 'Faltam 15 dias — recomendamos fazer o backup o quanto antes.'
        : 'Faltam 20 dias — organize o arquivamento das notas no seu sistema.'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Retenção de NF-e — Qomanda</title></head>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
  <p style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:.08em">Qomanda · Retenção de dados</p>
  <h1 style="font-size:20px;margin:0 0 12px">Olá, ${ownerName}</h1>
  <p>
    O restaurante <strong>${restaurantName}</strong> tem
    <strong>${nfeCount} nota${plural ? 's' : ''} fiscal${plural ? 'is' : ''}</strong>
    que será${plural ? 'ão' : ''} removida${plural ? 's' : ''} da nossa base em
    <strong>${daysBefore} dias</strong> (previsão: ${purgeOn}).
  </p>
  <p>${urgency}</p>
  <p>
    A Qomanda mantém NF-e por ${FINANCIAL_RETENTION_DAYS} dias por custo operacional e minimização de dados.
    Totais de faturamento mensal permanecem no painel — apenas os arquivos detalhados (PDF/XML) saem do sistema.
  </p>
  <p style="margin:24px 0">
    <a href="${settingsUrl}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
      Abrir NF-e no painel
    </a>
  </p>
  <p style="font-size:12px;color:#666">
    Se o botão não funcionar, acesse Configurações → NF-e no painel Qomanda e baixe os PDFs (DANFE) das notas listadas.
  </p>
</body>
</html>`
}

export function buildNfeRetentionEmailText(input: {
  restaurantName: string
  ownerName: string
  daysBefore: NfeRetentionReminderDay
  nfeCount: number
  purgeOn: string
}): string {
  const { restaurantName, ownerName, daysBefore, nfeCount, purgeOn } = input
  const plural = nfeCount !== 1
  return [
    `Olá, ${ownerName}`,
    '',
    `${restaurantName}: ${nfeCount} nota${plural ? 's' : ''} fiscal${plural ? 'is' : ''} será${plural ? 'ão' : ''} removida${plural ? 's' : ''} da base Qomanda em ${daysBefore} dias (previsão: ${purgeOn}).`,
    '',
    'Baixe e arquive os PDFs em Configurações → NF-e no painel Qomanda.',
    '',
    `Retenção: ${FINANCIAL_RETENTION_DAYS} dias. Totais mensais de faturamento permanecem no sistema.`,
  ].join('\n')
}

export type RestaurantNotificationDto = {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  severity: 'info' | 'warning' | 'critical'
  readAt: string | null
  createdAt: string
  metadata: Record<string, unknown>
}
