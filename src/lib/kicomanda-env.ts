/** Lê env com fallback para nomes legados QOMANDA_* (transição de marca). */
export function readEnv(primary: string, legacy?: string): string {
  const primaryVal = process.env[primary]?.trim()
  if (primaryVal) return primaryVal
  if (legacy) return process.env[legacy]?.trim() ?? ''
  return ''
}

export function staffEmailAllowlistEnv(): string {
  return readEnv('KICOMANDA_STAFF_EMAILS', 'QOMANDA_STAFF_EMAILS')
}

export function fromEmailEnv(): string {
  return readEnv('KICOMANDA_FROM_EMAIL', 'QOMANDA_FROM_EMAIL')
}
