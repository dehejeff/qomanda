/** Variáveis substituíveis nos templates de WhatsApp da fila/reserva. */
export type WaitlistMessageVars = {
  saudacao: string
  nome: string
  restaurante: string
  mesa: string
  mesas: string
  secao: string
  prazo: string
  pessoas: string
}

export const WAITLIST_TEMPLATE_PLACEHOLDERS = [
  '{saudacao}',
  '{nome}',
  '{restaurante}',
  '{mesa}',
  '{mesas}',
  '{secao}',
  '{prazo}',
  '{pessoas}',
] as const

export const DEFAULT_WAITLIST_READY_TEMPLATE = [
  '{saudacao}',
  '',
  '*{restaurante}* — {secao}',
  '{mesa} disponível agora.',
  '',
  'Dirija-se ao restaurante em até *{prazo} min* para ocupar.',
  'Se não puder vir, avise a recepção para liberarmos a vaga.',
].join('\n')

export const DEFAULT_WAITLIST_RESERVE_TEMPLATE = [
  '{saudacao}',
  '',
  '*{restaurante}* confirmou sua reserva.',
  'Mesas: {mesas}',
  '{pessoas} pessoa(s)',
  '',
  'Aguardamos você!',
].join('\n')

const PLACEHOLDER_RE = /\{(saudacao|nome|restaurante|mesa|mesas|secao|prazo|pessoas)\}/g

export function renderWaitlistTemplate(
  template: string | null | undefined,
  vars: WaitlistMessageVars,
  fallback: string,
): string {
  const raw = template?.trim() || fallback
  return raw.replace(PLACEHOLDER_RE, (_, key: keyof WaitlistMessageVars) => vars[key] ?? '')
}

export function primaryGreeting(nome: string): string {
  return `Olá *${nome}*!`
}

export function secondaryGreeting(nome: string): string {
  return `Olá! A mesa do grupo de *${nome}* está pronta.`
}

export function formatTableLabel(number: string | null): string {
  return number ? `Mesa ${number}` : 'Sua mesa'
}

export function formatTablesLabel(numbers: string[]): string {
  if (numbers.length === 0) return '—'
  return numbers.map(n => `Mesa ${n}`).join(', ')
}

export function normalizeWaitlistTemplateInput(value: unknown, maxLen = 2000): string | null {
  if (value == null || value === '') return null
  const text = String(value).trim()
  if (!text) return null
  return text.slice(0, maxLen)
}
