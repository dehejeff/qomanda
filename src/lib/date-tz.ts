/**
 * Helpers de data no fuso do restaurante (Brasil, America/Sao_Paulo, UTC-3 fixo).
 *
 * Por que existe: na Vercel o servidor roda em UTC. Calcular "início do dia" com
 * `setHours(0,0,0,0)` produz meia-noite UTC = 21:00 do dia anterior no Brasil,
 * fazendo vendas/pedidos de ontem à noite vazarem para "hoje". Estes helpers
 * fixam o boundary no fuso do Brasil, independente de onde o código roda.
 */

export const RESTAURANT_TZ = 'America/Sao_Paulo'
const BR_OFFSET = '-03:00' // Brasil não tem horário de verão desde 2019

/** Data de "hoje" (YYYY-MM-DD) no fuso do restaurante. */
export function brToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: RESTAURANT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Instante (Date) da meia-noite no Brasil para uma data YYYY-MM-DD. */
export function brMidnight(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00${BR_OFFSET}`)
}

/** Início do dia (meia-noite Brasil) `daysAgo` dias atrás, como Date em UTC. */
export function startOfBrDay(daysAgo = 0, now = new Date()): Date {
  const midnight = brMidnight(brToday(now))
  return new Date(midnight.getTime() - daysAgo * 86_400_000)
}

/** Início do dia de hoje (Brasil) em ISO — para filtros `gte` no Supabase. */
export function startOfTodayIso(now = new Date()): string {
  return startOfBrDay(0, now).toISOString()
}

/** Primeiro dia do mês (Brasil) com deslocamento de `monthsAgo` meses, como Date. */
export function startOfBrMonth(monthsAgo = 0, now = new Date()): Date {
  const today = brToday(now)
  const [year, month] = today.split('-').map(Number)
  const target = new Date(year, month - 1 - monthsAgo, 1)
  const y = target.getFullYear()
  const m = String(target.getMonth() + 1).padStart(2, '0')
  return brMidnight(`${y}-${m}-01`)
}

/** Dia da semana no fuso do restaurante: 0=Dom … 6=Sáb. */
export function brWeekday(now = new Date()): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: RESTAURANT_TZ, weekday: 'short' }).format(now)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd)
}

/** Hora local 'HH:MM' (24h) no fuso do restaurante. */
export function brTimeHHMM(now = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: RESTAURANT_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now)
}

/** Chave de dia (YYYY-MM-DD) no fuso do restaurante para um timestamp ISO. */
export function brDayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: RESTAURANT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}
