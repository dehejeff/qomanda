/** Apenas dígitos. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export type NormalizedWhatsApp = {
  /** Dígitos completos com código do país (estilo E.164 sem +). Ex: 5511987654321, 351912345678 */
  e164: string
  countryCode: string
  isBrazil: boolean
}

function isBrazilLocalNumber(d: string): boolean {
  if (d.length === 11 && /^[1-9]{2}9[0-9]{8}$/.test(d)) return true
  if (d.length === 10 && /^[1-9]{2}[6-9][0-9]{7}$/.test(d)) return true
  return false
}

/** Normaliza parte nacional BR (DDD + número), incluindo 9º dígito legado. */
function normalizeBrazilNational(national: string): string {
  let n = national
  if (n.length === 10 && /^[1-9]{2}[6-9]/.test(n)) {
    n = `${n.slice(0, 2)}9${n.slice(2)}`
  }
  return n
}

function normalizeBrazil(d: string): NormalizedWhatsApp {
  let national = d.startsWith('55') ? d.slice(2) : d
  national = normalizeBrazilNational(national)
  return {
    e164: `55${national}`,
    countryCode: '55',
    isBrazil: true,
  }
}

/**
 * Normaliza WhatsApp para armazenamento e busca.
 * - BR sem código: assume +55 e corrige 9º dígito.
 * - BR com 55: mantém país e normaliza nacional.
 * - Internacional: preserva código do país (usuário informa número completo).
 */
export function normalizeWhatsApp(input: string): NormalizedWhatsApp {
  const d = digitsOnly(input)
  if (!d) {
    return { e164: '', countryCode: '', isBrazil: false }
  }

  if (d.startsWith('55') && d.length >= 12) {
    return normalizeBrazil(d)
  }

  if (isBrazilLocalNumber(d)) {
    return normalizeBrazil(d)
  }

  // Número internacional — mantém dígitos com código do país
  return {
    e164: d,
    countryCode: d.slice(0, Math.min(3, d.length)),
    isBrazil: false,
  }
}

/** Variantes para lookup (BR legado, com/sem 55, internacional). */
export function whatsappLookupVariants(input: string): string[] {
  const raw = digitsOnly(input)
  const { e164, isBrazil } = normalizeWhatsApp(input)
  const variants = new Set<string>()

  if (raw) variants.add(raw)
  if (e164) variants.add(e164)

  if (isBrazil && e164.startsWith('55')) {
    const national = e164.slice(2)
    variants.add(national)
    if (national.length === 11 && national[2] === '9') {
      const legacy = national.slice(0, 2) + national.slice(3)
      variants.add(legacy)
      variants.add(`55${legacy}`)
    }
  }

  if (raw.startsWith('55') && raw.length > 2) {
    variants.add(raw.slice(2))
  }

  return [...variants].filter(v => v.length >= 8 && v.length <= 15)
}

export function isValidWhatsApp(input: string): boolean {
  const { e164, isBrazil } = normalizeWhatsApp(input)
  if (!e164) return false

  if (isBrazil) {
    const national = e164.slice(2)
    return national.length === 11 && /^[1-9]{2}9[0-9]{8}$/.test(national)
  }

  return e164.length >= 8 && e164.length <= 15
}

/** @deprecated use normalizeWhatsApp */
export function normalizeBrazilWhatsApp(input: string): string {
  const { e164, isBrazil } = normalizeWhatsApp(input)
  return isBrazil ? e164.slice(2) : e164
}

/** @deprecated use isValidWhatsApp */
export function isValidBrazilWhatsApp(input: string): boolean {
  const { isBrazil } = normalizeWhatsApp(input)
  return isBrazil && isValidWhatsApp(input)
}

/**
 * Formata entrada de telefone: máscara BR ou prefixo + para internacional.
 */
export function formatPhoneInput(value: string): string {
  const trimmed = value.trim()
  if (trimmed.startsWith('+')) {
    const digits = digitsOnly(trimmed).slice(0, 15)
    return digits ? `+${digits}` : '+'
  }

  const d = digitsOnly(value)
  // Código do país digitado sem + (ex: 55..., 351...)
  if (d.length > 11 || (d.startsWith('55') && d.length > 11)) {
    return `+${d.slice(0, 15)}`
  }

  return formatBrazilWhatsApp(value)
}

/** Máscara visual para celular BR (sem código do país). */
export function formatBrazilWhatsApp(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Exibição amigável (com + para internacional). */
export function formatWhatsAppDisplay(stored: string): string {
  const d = digitsOnly(stored)
  if (!d) return ''

  if (d.startsWith('55') && d.length === 13) {
    return formatBrazilWhatsApp(d.slice(2))
  }

  if (isBrazilLocalNumber(d)) {
    return formatBrazilWhatsApp(d)
  }

  return `+${d}`
}

// Alias legado usado nos formulários BR
export const formatWhatsApp = formatBrazilWhatsApp
