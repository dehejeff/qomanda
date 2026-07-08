/**
 * Parser do QR code impresso na NFC-e (modelo 65).
 *
 * Todo DANFE NFC-e traz um QR com a URL de consulta da SEFAZ do estado,
 * contendo a chave de acesso (44 dígitos) no parâmetro `p`:
 *   https://sat.sefaz.xx.gov.br/...?p=<chave>|<versão>|<ambiente>|...
 *
 * Aceitamos também a chave digitada/colada (44 dígitos, com ou sem espaços),
 * para o caso de a câmera falhar ou a nota ser consultada de outro jeito.
 */

export type ParsedNfceQr = {
  /** Chave de acesso da nota (44 dígitos) */
  accessKey: string
  /** URL de consulta pública (o próprio conteúdo do QR), se houver */
  consultUrl: string | null
}

const ACCESS_KEY_LENGTH = 44

/** Extrai chave de acesso + URL de consulta do conteúdo do QR (ou chave colada). */
export function parseNfceQrContent(raw: string): ParsedNfceQr | null {
  const content = raw.trim()
  if (!content) return null

  // Caso 1: URL de consulta (conteúdo padrão do QR da NFC-e)
  if (/^https?:\/\//i.test(content)) {
    const digits = content.match(/\d{44}/)
    if (!digits) return null
    if (!isValidAccessKey(digits[0])) return null
    return { accessKey: digits[0], consultUrl: content }
  }

  // Caso 2: chave de acesso digitada/colada (aceita espaços e pontuação)
  const onlyDigits = content.replace(/\D/g, '')
  if (onlyDigits.length === ACCESS_KEY_LENGTH && isValidAccessKey(onlyDigits)) {
    return { accessKey: onlyDigits, consultUrl: null }
  }

  return null
}

/**
 * Valida a chave de acesso pelo dígito verificador (módulo 11, último dígito).
 * Evita aceitar sequências de 44 dígitos que não são chave de nota.
 */
export function isValidAccessKey(key: string): boolean {
  if (!/^\d{44}$/.test(key)) return false
  const digits = key.split('').map(Number)
  const dv = digits[43]
  let weight = 2
  let sum = 0
  for (let i = 42; i >= 0; i--) {
    sum += digits[i] * weight
    weight = weight === 9 ? 2 : weight + 1
  }
  const mod = sum % 11
  const expected = mod === 0 || mod === 1 ? 0 : 11 - mod
  return dv === expected
}
